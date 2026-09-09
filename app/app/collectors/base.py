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
                        # GDELT 等公共 API 限流:指数退避
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
        """
        from ..core.ingest import ingest_events   # 延迟导入避免循环依赖

        started = datetime.now(timezone.utc)
        self._touch_attempt(started)
        try:
            raw = self.fetch()
            events = self.normalize(raw)
            n = ingest_events(events)
            self._touch_success(n)
            log.info("[%s] 采集成功,处理 %d 条", self.name, n)
            self._publish_changes()
            return n
        except Exception as e:
            self._touch_failure(repr(e))
            log.error("[%s] 采集失败: %r", self.name, e)
            return 0

    def _publish_changes(self) -> None:
        """一轮入库后广播变更 id，前端据此增量拉取。"""
        try:
            from ..api.ws import broadcast
            from ..core.ingest import last_changed_ids
            ids = last_changed_ids()
            if ids:
                broadcast("events.changed", {"source": self.name, "count": len(ids), "ids": ids[:500]})
        except Exception as e:
            log.debug("[%s] 广播变更失败: %r", self.name, e)

    def _touch_attempt(self, ts: datetime) -> None:
        touch_attempt(self.name, ts)

    def _touch_success(self, n: int) -> None:
        touch_success(self.name)

    def _touch_failure(self, err: str) -> None:
        touch_failure(self.name, err)


# ---------- source_health 写入（采集器与 EMSC WebSocket 共用） ----------

def touch_attempt(source: str, ts: datetime | None = None) -> None:
    ts = ts or datetime.now(timezone.utc)
    with get_session() as s:
        s.execute(text("""
            INSERT INTO source_health (source, last_attempt_at)
            VALUES (:src, :ts)
            ON CONFLICT (source) DO UPDATE SET last_attempt_at = :ts
        """), {"src": source, "ts": ts})


def touch_success(source: str) -> None:
    with get_session() as s:
        s.execute(text("""
            INSERT INTO source_health (source, last_attempt_at, last_success_at,
                                       consecutive_failures, total_success)
            VALUES (:src, now(), now(), 0, 1)
            ON CONFLICT (source) DO UPDATE
               SET last_success_at = now(), consecutive_failures = 0,
                   total_success = source_health.total_success + 1, last_error = NULL
        """), {"src": source})


def touch_failure(source: str, err: str) -> None:
    with get_session() as s:
        s.execute(text("""
            INSERT INTO source_health (source, last_attempt_at, consecutive_failures,
                                       total_failure, last_error)
            VALUES (:src, now(), 1, 1, :err)
            ON CONFLICT (source) DO UPDATE
               SET consecutive_failures = source_health.consecutive_failures + 1,
                   total_failure = source_health.total_failure + 1,
                   last_error = :err
        """), {"src": source, "err": err[:500]})
