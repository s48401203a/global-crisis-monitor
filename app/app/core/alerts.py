import json
import logging

from sqlalchemy import text

from ..config import settings
from ..db import get_session

log = logging.getLogger(__name__)

# 严重度跃升多少可突破静默窗口
SEVERITY_JUMP = 0.15
# 只对"首见于最近 N 小时"的事件评估；重启回补的旧事件不再告警
FRESH_HOURS = 2
# 事件本身发生时间的硬上限：更早的事件即使刚入库也不算"新告警"
OCCURRED_MAX_AGE_HOURS = 12


def evaluate_alerts() -> list[dict]:
    """
    扫描近期事件,产出应告警列表。
    由 APScheduler 每 60 秒调用一次,与采集解耦——
    这样采集失败不会连带丢失告警,告警逻辑变更也不必重跑采集。

    判新与静默语义（2026-09 修正）：
    - 候选 = first_seen_at 在最近 FRESH_HOURS 内（而非 updated_at，避免 upsert 刷新导致重复）
      且 occurred_at 在 OCCURRED_MAX_AGE_HOURS 内；
    - 已告警过的事件：只有 muted_until 已过且严重度较上次跃升 ≥ SEVERITY_JUMP 才再次告警；
    - 聚合信号（is_aggregate）按当日累计计数与置信度评估，见 _match_rule。
    """
    fired: list[dict] = []
    with get_session() as s:
        rows = s.execute(text("""
            SELECT e.id, e.category, e.type, e.severity, e.confidence,
                   e.magnitude_value, e.headline, e.status, e.metrics, e.is_aggregate,
                   ST_Y(e.centroid::geometry) AS lat,
                   ST_X(e.centroid::geometry) AS lon,
                   m.last_severity AS muted_severity,
                   -- 是否落在任一启用的关注区域内
                   EXISTS (SELECT 1 FROM watch_region w
                            WHERE w.enabled
                              AND ST_Intersects(w.geom, e.centroid)) AS in_region
              FROM event e
              LEFT JOIN alert_mute m ON m.event_id = e.id
             WHERE e.status IN ('active','revised')
               AND e.occurred_at > now() - (:occ_h || ' hours')::interval
               AND (
                     -- 首见且从未告警
                     (m.event_id IS NULL
                      AND e.first_seen_at > now() - (:fresh_h || ' hours')::interval)
                     -- 或：静默已过且严重度跃升
                     OR (m.event_id IS NOT NULL
                         AND m.muted_until < now()
                         AND e.severity >= COALESCE(m.last_severity, 0) + :jump)
                   )
        """), {"occ_h": str(OCCURRED_MAX_AGE_HOURS), "fresh_h": str(FRESH_HOURS),
               "jump": SEVERITY_JUMP}).fetchall()

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
            """), {"eid": r.id, "mins": str(settings.alert_mute_minutes),
                   "sev": r.severity})

            s.execute(text("""
                INSERT INTO alert (event_id, rule_name, channel, detail)
                VALUES (:eid, :rule, 'web', :detail)
            """), {"eid": r.id, "rule": rule,
                   "detail": (r.headline or "")[:300]})

            fired.append({
                "event_id": r.id, "rule": rule, "type": r.type,
                "severity": r.severity, "headline": r.headline,
                "lat": r.lat, "lon": r.lon,
                "in_region": r.in_region,
                "escalation": r.muted_severity is not None,
            })

    if fired:
        log.info("触发 %d 条告警", len(fired))
    return fired


def _metrics(r) -> dict:
    m = getattr(r, "metrics", None)
    if isinstance(m, str):
        try:
            m = json.loads(m)
        except Exception:
            m = None
    return m if isinstance(m, dict) else {}


def _match_rule(r) -> str | None:
    """
    阈值按 category/type 分别配置,不使用统一的 severity 阈值。
    理由:M7 地震的 severity 1.0 与冲突信号的 0.7 语义不可通约。
    """
    if r.type == "earthquake":
        mag = r.magnitude_value or 0
        lon = float(getattr(r, "lon", 0) or 0)
        lat = float(getattr(r, "lat", 0) or 0)
        in_cn = 73.0 <= lon <= 135.0 and 18.0 <= lat <= 54.0
        # 关注区域 / 中国用更低阈值，避免只剩全球大震才响
        if (r.in_region or in_cn) and mag >= settings.alert_eq_local_mag:
            return f"地震-关注区域内 M≥{settings.alert_eq_local_mag}"
        if mag >= settings.alert_eq_global_mag:
            return f"地震-全球 M≥{settings.alert_eq_global_mag}"
        return None

    if r.category == "conflict":
        # 战区基线层已移出 event 表；历史残留 type=war 与 metrics.baseline 仍跳过
        if r.type == "war":
            return None
        metrics = _metrics(r)
        if metrics.get("baseline") in (True, "true", "True", 1, "1"):
            return None
        # 冲突信号必须先过置信度门槛
        if (r.confidence or 0) < settings.alert_conflict_min_confidence:
            return None
        if r.type == "armed_clash" or getattr(r, "is_aggregate", False) or metrics.get("aggregate"):
            # 国家×日聚合：当日累计达到阈值才告警（避免每 15 分钟一次）
            n = int(metrics.get("event_count") or r.magnitude_value or 0)
            if n < settings.alert_conflict_min_events:
                return None
            return "武装冲突-当日高强度" if not r.in_region else "武装冲突-关注区域内"
        return "冲突信号-高置信度" if not r.in_region else "冲突信号-关注区域内"

    if r.type == "rainstorm":
        return "暴雨预警-橙色以上"

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
