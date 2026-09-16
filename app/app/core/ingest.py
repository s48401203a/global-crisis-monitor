# D:\crisis\app\app\core\ingest.py
from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field

from sqlalchemy import text

from ..db import get_session
from .dedupe import find_matching_event, should_take_over
from .schemas import NormalizedEvent
from .severity import compute_severity

log = logging.getLogger(__name__)


@dataclass
class IngestResult:
    """单次 ingest 的独立结果，不与其他采集线程共享。"""
    input_count: int = 0
    committed_ids: list[int] = field(default_factory=list)
    failed: list[dict] = field(default_factory=list)

    @property
    def success_count(self) -> int:
        return len(self.committed_ids)

    @property
    def empty(self) -> bool:
        return self.input_count == 0

    @property
    def outcome(self) -> str:
        if self.input_count == 0:
            return "empty"
        if self.failed and not self.committed_ids:
            return "failed"
        if self.failed:
            return "partial"
        return "ok"


def ingest_events(events: list[NormalizedEvent]) -> IngestResult:
    """归一化事件 → 去重 → upsert。返回本次调用独立的结构化结果。

    只在 savepoint 成功（含 observation）后把 id 记入 committed_ids。
    合法空输入、部分失败、全部失败由 outcome 区分。
    """
    result = IngestResult(input_count=len(events or []))
    if not events:
        return result

    with get_session() as s:
        for ev in events:
            try:
                with s.begin_nested():
                    sev = compute_severity(ev)
                    eid = find_matching_event(s, ev)
                    if eid is None:
                        eid = _insert_event(s, ev, sev)
                    else:
                        if not _update_event(s, eid, ev, sev):
                            continue
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
                    result.committed_ids.append(int(eid))
            except Exception as e:
                log.warning("入库失败 %s/%s: %r", ev.source, ev.source_event_id, e)
                result.failed.append({
                    "source": ev.source,
                    "source_event_id": ev.source_event_id,
                    "error": repr(e),
                })
    return result


def _insert_event(s, ev: NormalizedEvent, sev: float) -> int:
    fp = json.dumps(ev.footprint_geojson) if ev.footprint_geojson else None
    act = json.dumps(ev.actors, ensure_ascii=False) if ev.actors else None
    row = s.execute(text("""
        INSERT INTO event (category, type, severity, severity_peak, confidence, status,
                           magnitude_value, magnitude_unit,
                           centroid, footprint, occurred_at, headline,
                           primary_source, metrics, actors, is_aggregate)
        VALUES (:cat, :typ, :sev, :sev, :conf,
                CASE WHEN :conf < 0.7 THEN 'unconfirmed' ELSE 'active' END,
                :mv, :mu,
                ST_MakePoint(:lon,:lat)::geography,
                CASE WHEN CAST(:fp AS text) IS NULL THEN NULL
                     ELSE ST_GeomFromGeoJSON(CAST(:fp AS text))::geography END,
                :occ, :head, :src, CAST(:met AS text)::jsonb,
                CASE WHEN CAST(:act AS text) IS NULL THEN NULL
                     ELSE CAST(:act AS text)::jsonb END,
                :agg)
        RETURNING id
    """), {
        "cat": ev.category, "typ": ev.type, "sev": sev, "conf": ev.confidence,
        "mv": ev.magnitude_value, "mu": ev.magnitude_unit,
        "lon": ev.lon, "lat": ev.lat, "fp": fp,
        "occ": ev.occurred_at, "head": ev.headline, "src": ev.source,
        "met": json.dumps(ev.metrics, ensure_ascii=False, default=str),
        "act": act,
        "agg": bool(ev.metrics.get("aggregate")),
    }).fetchone()
    eid = row[0]

    if ev.source in ("cma", "cenc"):
        s.execute(text("UPDATE event SET country_iso3 = 'CHN' WHERE id = :eid"), {"eid": eid})
    else:
        s.execute(text("""
            UPDATE event e SET country_iso3 = COALESCE(
                (SELECT iso3 FROM country
                  WHERE ST_Intersects(geom, e.centroid) LIMIT 1),
                (SELECT iso3 FROM country
                  WHERE ST_DWithin(geom, e.centroid, 20000)
                  ORDER BY ST_Distance(geom, e.centroid) LIMIT 1))
             WHERE e.id = :eid
        """), {"eid": eid})
    return eid


def _update_event(s, eid: int, ev: NormalizedEvent, sev: float) -> bool:
    """返回 False 表示跳过（deleted 不救活）。closed 会重开并清空 closed_at。"""
    cur = s.execute(text(
        "SELECT primary_source, severity, status FROM event WHERE id = :eid"
    ), {"eid": eid}).fetchone()
    if cur and cur[2] == "deleted":
        return False
    take_over = should_take_over(ev.source, cur[0] if cur else None)
    was_closed = bool(cur and cur[2] == "closed")

    fp = json.dumps(ev.footprint_geojson) if ev.footprint_geojson else None
    s.execute(text("""
        UPDATE event
           SET severity = CASE WHEN :take THEN :sev ELSE severity END,
               severity_peak = CASE WHEN :take THEN GREATEST(COALESCE(severity_peak, 0), :sev)
                                    ELSE severity_peak END,
               revision = revision + 1,
               updated_at = clock_timestamp(),
               change_seq = nextval('event_change_seq'),
               status = CASE
                            WHEN :was_closed AND :conf >= 0.7 THEN 'active'
                            WHEN :was_closed THEN 'unconfirmed'
                            WHEN status = 'unconfirmed' AND :conf >= 0.7 THEN 'active'
                            ELSE 'revised'
                        END,
               closed_at = CASE WHEN :was_closed THEN NULL ELSE closed_at END,
               confidence = GREATEST(confidence, :conf),
               centroid = CASE WHEN :take THEN ST_MakePoint(:lon,:lat)::geography
                               ELSE centroid END,
               magnitude_value = CASE WHEN :take THEN COALESCE(:mv, magnitude_value)
                                      ELSE magnitude_value END,
               magnitude_unit = CASE WHEN :take THEN COALESCE(:mu, magnitude_unit)
                                     ELSE magnitude_unit END,
               type = CASE WHEN :take THEN :typ ELSE type END,
               headline = CASE WHEN :take THEN :head ELSE headline END,
               metrics = CASE WHEN :take THEN CAST(:met AS text)::jsonb ELSE metrics END,
               primary_source = CASE WHEN :take THEN :src ELSE primary_source END,
               footprint = CASE WHEN CAST(:fp AS text) IS NULL THEN footprint
                                ELSE ST_GeomFromGeoJSON(CAST(:fp AS text))::geography END,
               occurred_at = CASE WHEN :agg THEN :occ ELSE occurred_at END,
               is_aggregate = :agg OR is_aggregate
         WHERE id = :eid
    """), {
        "eid": eid, "sev": sev, "conf": ev.confidence, "take": take_over,
        "was_closed": was_closed,
        "lon": ev.lon, "lat": ev.lat, "mv": ev.magnitude_value,
        "mu": ev.magnitude_unit, "typ": ev.type, "head": ev.headline,
        "met": json.dumps(ev.metrics, ensure_ascii=False, default=str),
        "src": ev.source, "fp": fp, "occ": ev.occurred_at,
        "agg": bool(ev.metrics.get("aggregate")),
    })
    return True
