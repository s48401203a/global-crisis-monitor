from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import text

from ..db import get_session

router = APIRouter(prefix="/api")


@router.get("/stats")
def stats(hours: int = Query(24, ge=1, le=9000), bbox: str | None = None):
    """按类型 / 国家 / 严重度分桶；聚合信号（is_aggregate）单列，不与真实事件混算。"""
    clauses = ["occurred_at > now() - (CAST(:h AS text) || ' hours')::interval",
               "status <> 'deleted'"]
    params: dict = {"h": str(hours)}
    if bbox:
        try:
            w, s_, e, n = [float(x) for x in bbox.split(",")]
        except ValueError:
            raise HTTPException(400, "bbox 应为 west,south,east,north")
        clauses.append("ST_Intersects(centroid::geometry, ST_MakeEnvelope(:w, :s, :e, :n, 4326))")
        params.update({"w": w, "s": s_, "e": e, "n": n})
    where = " AND ".join(clauses)
    with get_session() as s:
        by_type = s.execute(text(f"""
            SELECT type, is_aggregate, count(*) AS n,
                   count(*) FILTER (WHERE severity >= 0.7) AS hi
              FROM event WHERE {where} GROUP BY type, is_aggregate ORDER BY n DESC
        """), params).fetchall()
        by_country = s.execute(text(f"""
            SELECT country_iso3, count(*) AS n FROM event
             WHERE {where} AND country_iso3 IS NOT NULL AND NOT is_aggregate
             GROUP BY country_iso3 ORDER BY n DESC LIMIT 15
        """), params).fetchall()
        totals = s.execute(text(f"""
            SELECT count(*) FILTER (WHERE NOT is_aggregate) AS events,
                   count(*) FILTER (WHERE is_aggregate) AS aggregates,
                   count(*) FILTER (WHERE category='natural') AS natural,
                   count(*) FILTER (WHERE category='conflict' AND NOT is_aggregate) AS conflict_events,
                   count(*) FILTER (WHERE category='conflict' AND is_aggregate) AS conflict_signals,
                   count(*) FILTER (WHERE severity >= 0.7 AND NOT is_aggregate) AS high,
                   count(*) FILTER (WHERE status = 'closed') AS closed
              FROM event WHERE {where}
        """), params).fetchone()
        alerts_24h = s.execute(text(
            "SELECT count(*) FROM alert WHERE dispatched_at > now() - interval '24 hours'")).scalar()
    return {
        "hours": hours,
        "totals": dict(totals._mapping),
        "by_type": [{"type": r.type, "aggregate": bool(r.is_aggregate), "count": r.n, "high": r.hi}
                    for r in by_type],
        "by_country_top": [{"iso3": r.country_iso3, "count": r.n} for r in by_country],
        "alerts_24h": alerts_24h,
    }
