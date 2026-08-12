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
        # truststore 已在 main.py 注入,此处不再处理证书
        headers = kw.pop("headers", None) or {}
        headers.setdefault(
            "User-Agent",
            "CrisisMonitor/1.0 (+local; research; contact=local-admin)",
        )
        last_err: Exception | None = None
        for attempt in range(4):
            try:
                with httpx.Client(timeout=self.timeout, follow_redirects=True) as c:
                    r = c.get(url, headers=headers, **kw)
                    if r.status_code == 429:
                        # GDELT 等公共 API 限流:指数退避
                        import time
                        time.sleep(min(2 ** attempt * 3, 45))
                        last_err = httpx.HTTPStatusError(
                            f"429 for {url}", request=r.request, response=r
                        )
                        continue
                    r.raise_for_status()
                    return r
            except Exception as e:
                last_err = e
                import time
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
            return n
        except Exception as e:
            self._touch_failure(repr(e))
            log.error("[%s] 采集失败: %r", self.name, e)
            return 0

    def _touch_attempt(self, ts: datetime) -> None:
        with get_session() as s:
            s.execute(text("""
                INSERT INTO source_health (source, last_attempt_at)
                VALUES (:src, :ts)
                ON CONFLICT (source) DO UPDATE SET last_attempt_at = :ts
            """), {"src": self.name, "ts": ts})

    def _touch_success(self, n: int) -> None:
        with get_session() as s:
            s.execute(text("""
                UPDATE source_health
                   SET last_success_at = now(), consecutive_failures = 0,
                       total_success = total_success + 1, last_error = NULL
                 WHERE source = :src
            """), {"src": self.name})

    def _touch_failure(self, err: str) -> None:
        with get_session() as s:
            s.execute(text("""
                UPDATE source_health
                   SET consecutive_failures = consecutive_failures + 1,
                       total_failure = total_failure + 1,
                       last_error = :err
                 WHERE source = :src
            """), {"src": self.name, "err": err[:500]})
