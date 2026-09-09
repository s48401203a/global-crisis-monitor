# D:\crisis\app\app\api\routes_events.py
# 注意:全部使用 def 而非 async def(红线 #1)。
# FastAPI 会把同步端点自动放入线程池执行。
from fastapi import APIRouter, Query
from sqlalchemy import text

from ..db import get_session

router = APIRouter(prefix="/api")


@router.get("/events")
def list_events(
    hours: int = Query(24, ge=1, le=9000),
    category: str | None = None,
    min_severity: float = 0.0,
    limit: int = Query(2000, ge=1, le=10000),
):
    """返回 GeoJSON FeatureCollection,前端可直接作为 MapLibre source"""
    # 注意: 不能写 (:cat IS NULL OR ...) —— psycopg 无法推断 NULL 参数类型
    cat_clause = "AND category = :cat" if category else ""
    with get_session() as s:
        rows = s.execute(text(f"""
            SELECT id, category, type, severity, confidence, status,
                   magnitude_value, magnitude_unit, headline, primary_source,
                   occurred_at, first_seen_at, country_iso3, metrics,
                   ST_AsGeoJSON(centroid::geometry) AS pt,
                   ST_AsGeoJSON(footprint::geometry) AS fp
              FROM event
             WHERE occurred_at > now() - (CAST(:h AS text) || ' hours')::interval
               AND status <> 'deleted'
               AND severity >= :ms
               {cat_clause}
             ORDER BY occurred_at DESC
             LIMIT :lim
        """), {"h": str(hours), "ms": min_severity,
               "cat": category, "lim": limit}).fetchall()

    import json
    feats = []
    for r in rows:
        feats.append({
            "type": "Feature",
            "geometry": json.loads(r.pt),
            "properties": {
                "id": r.id, "category": r.category, "type": r.type,
                "severity": r.severity, "confidence": r.confidence,
                "status": r.status,
                "magnitude": r.magnitude_value, "unit": r.magnitude_unit,
                "headline": r.headline, "source": r.primary_source,
                "occurred_at": r.occurred_at.isoformat(),
                "first_seen_at": r.first_seen_at.isoformat(),
                "country": r.country_iso3,
                "metrics": r.metrics,
                "footprint": json.loads(r.fp) if r.fp else None,
            },
        })
    return {"type": "FeatureCollection", "features": feats}
