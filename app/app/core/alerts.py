# D:\crisis\app\app\core\alerts.py
import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import text

from ..config import settings
from ..db import get_session

log = logging.getLogger(__name__)


def evaluate_alerts() -> list[dict]:
    """
    扫描近期事件,产出应告警列表。
    由 APScheduler 每 60 秒调用一次,与采集解耦——
    这样采集失败不会连带丢失告警,告警逻辑变更也不必重跑采集。
    """
    fired: list[dict] = []
    with get_session() as s:
        # 取近 2 小时内新建或修订、且尚未被静默的事件
        rows = s.execute(text("""
            SELECT e.id, e.category, e.type, e.severity, e.confidence,
                   e.magnitude_value, e.headline, e.status, e.metrics,
                   ST_Y(e.centroid::geometry) AS lat,
                   ST_X(e.centroid::geometry) AS lon,
                   -- 是否落在任一启用的关注区域内
                   EXISTS (SELECT 1 FROM watch_region w
                            WHERE w.enabled
                              AND ST_Intersects(w.geom, e.centroid)) AS in_region
              FROM event e
              LEFT JOIN alert_mute m ON m.event_id = e.id
             WHERE e.updated_at > now() - INTERVAL '2 hours'
               AND e.status IN ('active','revised')
               AND (m.event_id IS NULL
                    OR m.muted_until < now()
                    OR e.severity > m.last_severity + 0.15)  -- 等级跃升突破静默
        """)).fetchall()

        for r in rows:
            rule = _match_rule(r)
            if not rule:
                continue

            # 写入静默窗口(替代 Redis 的 SETEX)
            s.execute(text("""
                INSERT INTO alert_mute (event_id, muted_until, last_severity)
                VALUES (:eid, now() + (:mins || ' minutes')::interval, :sev)
                ON CONFLICT (event_id) DO UPDATE
                   SET muted_until = now() + (:mins || ' minutes')::interval,
                       last_severity = :sev
            """), {"eid": r.id, "mins": settings.alert_mute_minutes,
                   "sev": r.severity})

            s.execute(text("""
                INSERT INTO alert (event_id, rule_name, channel, detail)
                VALUES (:eid, :rule, 'web', :detail)
            """), {"eid": r.id, "rule": rule,
                   "detail": r.headline[:300]})

            fired.append({
                "event_id": r.id, "rule": rule, "type": r.type,
                "severity": r.severity, "headline": r.headline,
                "lat": r.lat, "lon": r.lon,
                "in_region": r.in_region,
            })

    if fired:
        log.info("触发 %d 条告警", len(fired))
    return fired


def _match_rule(r) -> str | None:
    """
    阈值按 category/type 分别配置,不使用统一的 severity 阈值。
    理由:M7 地震的 severity 1.0 与冲突信号的 0.7 语义不可通约。
    """
    if r.type == "earthquake":
        mag = r.magnitude_value or 0
        # 关注区域内用更低阈值 —— 这是本系统对用户最有价值的一条规则
        if r.in_region and mag >= settings.alert_eq_local_mag:
            return f"地震-关注区域内 M≥{settings.alert_eq_local_mag}"
        if mag >= settings.alert_eq_global_mag:
            return f"地震-全球 M≥{settings.alert_eq_global_mag}"
        return None

    if r.category == "conflict":
        # 战区基线层（war_hotspots）只供地图展示，不参与告警，避免刷屏淹没真实地震告警
        # 判据：type=war（当前仅基线产出）或 metrics.baseline=true（预留）
        if r.type == "war":
            return None
        metrics = getattr(r, "metrics", None)
        if isinstance(metrics, str):
            try:
                import json

                metrics = json.loads(metrics)
            except Exception:
                metrics = None
        if isinstance(metrics, dict) and metrics.get("baseline") in (True, "true", "True", 1, "1"):
            return None
        # 冲突媒体信号必须先过置信度门槛,再看是否在关注区域
        if r.confidence < settings.alert_conflict_min_confidence:
            return None
        return "冲突信号-高置信度" if not r.in_region else "冲突信号-关注区域内"

    if r.type in ("cyclone", "flood", "volcano"):
        # 这几类走 GDACS 的橙色以上,对应 severity 约 0.6
        if r.severity >= 0.6:
            return f"{r.type}-橙色以上"
        if r.in_region and r.severity >= 0.4:
            return f"{r.type}-关注区域内"
        return None

    if r.type == "wildfire":
        if r.in_region and r.severity >= 0.3:
            return "野火-关注区域内"
        if r.severity >= 0.7:
            return "野火-大规模"
        return None

    return None
