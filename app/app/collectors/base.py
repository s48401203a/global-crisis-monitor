# D:\crisis\app\app\collectors\base.py
import logging
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from typing import Any

import httpx
from sqlalchemy import text

from ..core.schemas import NormalizedEvent
from ..db import get_session

log = logging.getLogger(__name__)


class BaseCollector(ABC):
    """数据源适配器基类。子类只需实现 fetch 与 normalize。"""

    name: str = "base"
    timeout: float = 25.0

    @abstractmethod
    def fetch(self) -> Any:
        """拉取原始数据。网络异常直接抛出,由 run() 统一处理。"""

    @abstractmethod
    def normalize(self, raw: Any) -> list[NormalizedEvent]:
        """原始数据 → 统一事件模型列表"""

    def dedupe_key(self, ev: NormalizedEvent) -> tuple[str, str]:
        """源侧唯一键,对应 observation 表的唯一索引"""
        return (ev.source, ev.source_event_id)

    # ---------- 以下为通用实现,子类无需覆盖 ----------

    def http_get(self, url: str, **kw) -> httpx.Response:
        """带重试的 GET；代理/UA/超时由 app.net 统一决定。"""
        import time
        from ..net import make_client

        headers = kw.pop("headers", None) or {}
        last_err: Exception | None = None
        for attempt in range(4):
            try:
                with make_client(timeout=self.timeout, headers=headers) as c:
                    r = c.get(url, **kw)
                    if r.status_code == 429:
                        time.sleep(min(2 ** attempt * 3, 45))
                        last_err = httpx.HTTPStatusError(
                            f"429 for {url}", request=r.request, response=r
                        )
                        continue
                    r.raise_for_status()
                    return r
            except Exception as e:
                last_err = e
                time.sleep(min(2 ** attempt, 20))
        if last_err:
            raise last_err
        raise RuntimeError(f"http_get failed for {url}")

    def run(self) -> int:
        """
        单次采集。返回入库(含更新)的事件数。
        关键:单源失败绝不能影响其他源,所有异常在此捕获并记录到 source_health。
        合法空结果记成功；部分写入失败记 partial；全部入库失败不记绿色。
        """
        from ..core.ingest import ingest_events

        started = datetime.now(timezone.utc)
        self._touch_attempt(started)
        try:
            raw = self.fetch()
            events = self.normalize(raw)
            result = ingest_events(events)
            outcome = result.outcome
            if outcome == "failed":
                err = result.failed[0]["error"] if result.failed else "ingest failed"
                self._touch_failure(
                    f"ingest all failed {len(result.failed)}/{result.input_count}: {err}"
                )
                log.error("[%s] 全部入库失败 %d/%d", self.name, len(result.failed), result.input_count)
                return 0
            if outcome == "partial":
                self._touch_partial(result.success_count, len(result.failed), result.failed[0])
                log.warning("[%s] 部分入库 %d ok / %d fail",
                            self.name, result.success_count, len(result.failed))
            else:
                self._touch_success(result.success_count, empty=result.empty)
                log.info("[%s] 采集成功,处理 %d 条", self.name, result.success_count)
            self._publish_changes(result.committed_ids)
            return result.success_count
        except Exception as e:
            self._touch_failure(repr(e))
            log.error("[%s] 采集失败: %r", self.name, e)
            return 0

    def _publish_changes(self, ids: list[int] | None = None) -> None:
        """提交成功后广播本轮已提交 id，不读共享全局集合。"""
        try:
            from ..api.ws import broadcast
            ids = list(ids or [])
            if ids:
                broadcast("events.changed", {"source": self.name, "count": len(ids), "ids": ids[:500]})
        except Exception as e:
            log.debug("[%s] 广播变更失败: %r", self.name, e)

    def _touch_attempt(self, ts: datetime) -> None:
        touch_attempt(self.name, ts)

    def _touch_success(self, n: int, *, empty: bool = False) -> None:
        touch_success(self.name, ok_count=n, empty=empty)

    def _touch_partial(self, ok: int, fail: int, sample: dict) -> None:
        touch_partial(self.name, ok, fail, str(sample.get("error") or sample))

    def _touch_failure(self, err: str) -> None:
        touch_failure(self.name, err)


def touch_attempt(source: str, ts: datetime | None = None) -> None:
    ts = ts or datetime.now(timezone.utc)
    with get_session() as s:
        s.execute(text("""
            INSERT INTO source_health (source, last_attempt_at)
            VALUES (:src, :ts)
            ON CONFLICT (source) DO UPDATE SET last_attempt_at = :ts
        """), {"src": source, "ts": ts})


def touch_success(source: str, ok_count: int = 0, *, empty: bool = False) -> None:
    status = "empty" if empty else "ok"
    with get_session() as s:
        s.execute(text("""
            INSERT INTO source_health (source, last_attempt_at, last_success_at,
                                       consecutive_failures, total_success,
                                       last_ingest_status, last_ingest_ok, last_ingest_fail,
                                       last_error)
            VALUES (:src, now(), now(), 0, 1, :st, :ok, 0, NULL)
            ON CONFLICT (source) DO UPDATE
               SET last_success_at = now(), consecutive_failures = 0,
                   total_success = source_health.total_success + 1, last_error = NULL,
                   last_ingest_status = :st, last_ingest_ok = :ok, last_ingest_fail = 0
        """), {"src": source, "st": status, "ok": int(ok_count)})


def touch_partial(source: str, ok: int, fail: int, err: str) -> None:
    with get_session() as s:
        s.execute(text("""
            INSERT INTO source_health (source, last_attempt_at, last_success_at,
                                       consecutive_failures, total_success, total_failure,
                                       last_error, last_ingest_status, last_ingest_ok, last_ingest_fail)
            VALUES (:src, now(), now(), 0, 1, 1, :err, 'partial', :ok, :fail)
            ON CONFLICT (source) DO UPDATE
               SET last_success_at = now(), consecutive_failures = 0,
                   total_success = source_health.total_success + 1,
                   total_failure = source_health.total_failure + 1,
                   last_error = :err,
                   last_ingest_status = 'partial',
                   last_ingest_ok = :ok, last_ingest_fail = :fail
        """), {"src": source, "ok": int(ok), "fail": int(fail), "err": (err or "")[:500]})


def touch_failure(source: str, err: str) -> None:
    with get_session() as s:
        s.execute(text("""
            INSERT INTO source_health (source, last_attempt_at, consecutive_failures,
                                       total_failure, last_error,
                                       last_ingest_status, last_ingest_ok, last_ingest_fail)
            VALUES (:src, now(), 1, 1, :err, 'failed', 0, 1)
            ON CONFLICT (source) DO UPDATE
               SET consecutive_failures = source_health.consecutive_failures + 1,
                   total_failure = source_health.total_failure + 1,
                   last_error = :err,
                   last_ingest_status = 'failed',
                   last_ingest_ok = 0, last_ingest_fail = 1
        """), {"src": source, "err": (err or "")[:500]})
