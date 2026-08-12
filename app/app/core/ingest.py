# D:\crisis\app\app\core\ingest.py
import json, logging
from sqlalchemy import text

from ..db import get_session
from .schemas import NormalizedEvent
from .severity import compute_severity
from .dedupe import find_matching_event, should_take_over

log = logging.getLogger(__name__)


def ingest_events(events: list[NormalizedEvent]) -> int:
    """归一化事件 → 去重 → upsert。返回处理条数。"""
    if not events:
        return 0

    n = 0
    with get_session() as s:
        for ev in events:
            try:
                # savepoint: 单条失败不整批 abort(规格 8.8 意图)
                with s.begin_nested():
                    sev = compute_severity(ev)
                    eid = find_matching_event(s, ev)

                    if eid is None:
                        eid = _insert_event(s, ev, sev)
                    else:
                        _update_event(s, eid, ev, sev)

                    # 红线:必须 upsert。事件会被修订,USGS 初报 M6.2
                    # 可能两小时后改为 M6.8,纯 INSERT 会产生重复记录。
                    s.execute(text("""
                        INSERT INTO observation (event_id, source, source_event_id, raw)
                        VALUES (:eid, :src, :sid, CAST(:raw AS text)::jsonb)
                        ON CONFLICT (source, source_event_id) DO UPDATE
                           SET raw = EXCLUDED.raw,
                               ingested_at = now(),
                               event_id = EXCLUDED.event_id
                    """), {"eid": eid, "src": ev.source,
                           "sid": ev.source_event_id,
                           "raw": json.dumps(ev.raw, ensure_ascii=False, default=str)})
                    n += 1
            except Exception as e:
                # 单条失败不影响整批
                log.warning("入库失败 %s/%s: %r", ev.source, ev.source_event_id, e)
    return n


def _insert_event(s, ev: NormalizedEvent, sev: float) -> int:
    # footprint 必须 CAST AS text,否则 NULL 参数类型歧义(psycopg AmbiguousParameter)
    fp = json.dumps(ev.footprint_geojson) if ev.footprint_geojson else None
    act = json.dumps(ev.actors, ensure_ascii=False) if ev.actors else None
    row = s.execute(text("""
        INSERT INTO event (category, type, severity, confidence, status,
                           magnitude_value, magnitude_unit,
                           centroid, footprint, occurred_at, headline,
                           primary_source, metrics, actors)
        VALUES (:cat, :typ, :sev, :conf,
                CASE WHEN :conf < 0.7 THEN 'unconfirmed' ELSE 'active' END,
                :mv, :mu,
                ST_MakePoint(:lon,:lat)::geography,
                CASE WHEN CAST(:fp AS text) IS NULL THEN NULL
                     ELSE ST_GeomFromGeoJSON(CAST(:fp AS text))::geography END,
                :occ, :head, :src, CAST(:met AS text)::jsonb,
                CASE WHEN CAST(:act AS text) IS NULL THEN NULL
                     ELSE CAST(:act AS text)::jsonb END)
        RETURNING id
    """), {
        "cat": ev.category, "typ": ev.type, "sev": sev, "conf": ev.confidence,
        "mv": ev.magnitude_value, "mu": ev.magnitude_unit,
        "lon": ev.lon, "lat": ev.lat, "fp": fp,
        "occ": ev.occurred_at, "head": ev.headline, "src": ev.source,
        "met": json.dumps(ev.metrics, ensure_ascii=False, default=str),
        "act": act,
    }).fetchone()
    eid = row[0]

    # 空间连接得出所属国家,供按国家聚合统计
    s.execute(text("""
        UPDATE event SET country_iso3 = (
            SELECT iso3 FROM country
             WHERE ST_Intersects(geom, (SELECT centroid FROM event WHERE id = :eid))
             LIMIT 1)
         WHERE id = :eid
    """), {"eid": eid})
    return eid


def _update_event(s, eid: int, ev: NormalizedEvent, sev: float) -> None:
    cur = s.execute(text(
        "SELECT primary_source, severity FROM event WHERE id = :eid"
    ), {"eid": eid}).fetchone()
    take_over = should_take_over(ev.source, cur[0] if cur else None)

    fp = json.dumps(ev.footprint_geojson) if ev.footprint_geojson else None
    s.execute(text("""
        UPDATE event
           SET severity = GREATEST(severity, :sev),
               revision = revision + 1,
               updated_at = now(),
               status = CASE WHEN status = 'unconfirmed' AND :conf >= 0.7
                             THEN 'active' ELSE 'revised' END,
               confidence = GREATEST(confidence, :conf),
               -- 仅当新源更权威时才覆盖坐标与量级
               centroid = CASE WHEN :take THEN ST_MakePoint(:lon,:lat)::geography
                               ELSE centroid END,
               magnitude_value = CASE WHEN :take THEN COALESCE(:mv, magnitude_value)
                                      ELSE magnitude_value END,
               primary_source = CASE WHEN :take THEN :src ELSE primary_source END,
               -- footprint 总是取最新(台风路径持续延长)
               footprint = CASE WHEN CAST(:fp AS text) IS NULL THEN footprint
                                ELSE ST_GeomFromGeoJSON(CAST(:fp AS text))::geography END
         WHERE id = :eid
    """), {
        "eid": eid, "sev": sev, "conf": ev.confidence, "take": take_over,
        "lon": ev.lon, "lat": ev.lat, "mv": ev.magnitude_value,
        "src": ev.source, "fp": fp,
    })
