"""事件生命周期与数据保留。

close_stale_events：对"源侧提供当前有效列表"的源（EONET open、GDACS 当前事件、CMA 生效预警），
  若某事件连续 N 轮未再出现（observation.ingested_at 未刷新），置 status=closed。
run_retention：observation.raw 超期清空（保留行供去重）、alert 超期删除、deleted 事件物理删除、
  watch_sample 超期删除。
"""
from __future__ import annotations

import logging

from sqlalchemy import text

from ..config import settings
from ..db import get_session
from .sources import by_name

log = logging.getLogger(__name__)

# 源 → 认为"列表式"的源；连续缺席轮数
LIFECYCLE_SOURCES = {"eonet": 3, "gdacs": 3, "cma": 3}


def close_stale_events() -> int:
    """返回本轮关闭的事件数。"""
    specs = by_name()
    closed = 0
    with get_session() as s:
        for src, rounds in LIFECYCLE_SOURCES.items():
            spec = specs.get(src)
            if not spec or not spec.enabled:
                continue
            grace = spec.interval * rounds + 120
            rows = s.execute(text("""
                UPDATE event e
                   SET status = 'closed', closed_at = now(), updated_at = now()
                 WHERE e.primary_source = :src
                   AND e.status IN ('active', 'revised', 'unconfirmed')
                   AND NOT EXISTS (
                        SELECT 1 FROM observation o
                         WHERE o.event_id = e.id
                           AND o.ingested_at > now() - (:grace || ' seconds')::interval)
                   -- 该源最近确实成功采集过，否则是源故障而不是事件结束
                   AND EXISTS (
                        SELECT 1 FROM source_health h
                         WHERE h.source = :src
                           AND h.last_success_at > now() - (:grace || ' seconds')::interval)
                RETURNING e.id
            """), {"src": src, "grace": str(grace)}).fetchall()
            if rows:
                closed += len(rows)
                log.info("[lifecycle] %s: %d 个事件已关闭", src, len(rows))
    if closed:
        try:
            from ..api.ws import broadcast
            broadcast("events.changed", {"source": "lifecycle", "count": closed, "ids": []})
        except Exception:
            pass
    return closed


def run_retention() -> dict:
    out = {}
    with get_session() as s:
        out["raw_cleared"] = s.execute(text("""
            UPDATE observation SET raw = '{}'::jsonb
             WHERE ingested_at < now() - (:d || ' days')::interval AND raw <> '{}'::jsonb
        """), {"d": str(settings.retention_raw_days)}).rowcount
        out["alerts_deleted"] = s.execute(text("""
            DELETE FROM alert WHERE dispatched_at < now() - (:d || ' days')::interval
        """), {"d": str(settings.retention_alert_days)}).rowcount
        out["deleted_purged"] = s.execute(text("""
            DELETE FROM event WHERE status = 'deleted'
               AND updated_at < now() - (:d || ' days')::interval
        """), {"d": str(settings.retention_deleted_days)}).rowcount
        out["samples_deleted"] = s.execute(text("""
            DELETE FROM watch_sample WHERE day < CURRENT_DATE - :d
        """), {"d": int(settings.retention_sample_days)}).rowcount
        s.execute(text("""
            INSERT INTO source_health (source, last_attempt_at, last_success_at)
            VALUES ('retention', now(), now())
            ON CONFLICT (source) DO UPDATE SET last_attempt_at = now(), last_success_at = now()
        """))
    if any(out.values()):
        log.info("[retention] %s", out)
    return out
