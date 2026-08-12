# D:\crisis\app\app\core\dedupe.py
from sqlalchemy import text
from sqlalchemy.orm import Session

from .schemas import NormalizedEvent

# 主源优先级:数字越小越权威,决定事件采信哪个源的坐标与量级
SOURCE_PRIORITY = {"usgs": 1, "emsc": 2, "gdacs": 3,
                   "eonet": 4, "openmeteo": 5, "gdelt": 9}

# 地震匹配参数。这三个值需在 Phase 1 用真实数据校准:
# 过松会把相邻的独立地震合并,过紧则同一地震在图上出现多个点。
EQ_TIME_WINDOW_S = 90
EQ_DISTANCE_M = 100_000
EQ_MAG_TOLERANCE = 0.5


def find_matching_event(s: Session, ev: NormalizedEvent) -> int | None:
    """在已有 event 中查找同一物理事件,返回 event.id 或 None。"""

    # 同源同 ID 优先(observation 唯一键):保证 upsert 修订不产生重复 event 行
    row = s.execute(text("""
        SELECT event_id FROM observation
         WHERE source = :src AND source_event_id = :sid
           AND event_id IS NOT NULL
         LIMIT 1
    """), {"src": ev.source, "sid": ev.source_event_id}).fetchone()
    if row:
        return row[0]

    if ev.type == "earthquake":
        # 地震:时间窗窄、距离严、量级相近
        row = s.execute(text("""
            SELECT id FROM event
             WHERE type = 'earthquake'
               AND status <> 'deleted'
               AND ABS(EXTRACT(EPOCH FROM (occurred_at - :t))) < :win
               AND ST_DWithin(centroid, ST_MakePoint(:lon,:lat)::geography, :dist)
               AND (
                     magnitude_value IS NULL OR :mag IS NULL
                     OR ABS(magnitude_value - :mag) < :magtol
                   )
             ORDER BY ST_Distance(centroid, ST_MakePoint(:lon,:lat)::geography)
             LIMIT 1
        """), {
            "t": ev.occurred_at, "win": EQ_TIME_WINDOW_S,
            "lon": ev.lon, "lat": ev.lat, "dist": EQ_DISTANCE_M,
            "mag": ev.magnitude_value, "magtol": EQ_MAG_TOLERANCE,
        }).fetchone()
        return row[0] if row else None

    if ev.category == "conflict":
        # 冲突信号已按 国家+15分钟窗口 聚合,source_event_id 天然唯一,
        # 走 observation 的 upsert 路径即可,此处不做空间匹配。
        return None

    # 台风/野火/火山:持续型事件,源侧有稳定 ID,按 ID 关联而非时空匹配。
    # 时空匹配会把台风移动前后的位置误判为两个事件。
    row = s.execute(text("""
        SELECT e.id FROM event e
          JOIN observation o ON o.event_id = e.id
         WHERE o.source = :src AND o.source_event_id = :sid
         LIMIT 1
    """), {"src": ev.source, "sid": ev.source_event_id}).fetchone()
    return row[0] if row else None


def should_take_over(new_source: str, current_primary: str | None) -> bool:
    """新来的源是否比现有主源更权威(决定是否覆盖坐标与量级)"""
    if not current_primary:
        return True
    return SOURCE_PRIORITY.get(new_source, 99) < SOURCE_PRIORITY.get(current_primary, 99)
