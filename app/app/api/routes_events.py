# 事件 API v2。全部 def（同步 psycopg）。
#   GET /api/events        列表（GeoJSON）：hours/since/bbox/types/category/min_severity/fields/limit + ETag
#   GET /api/events/{id}   详情：full 字段 + observations + alerts
from __future__ import annotations

import hashlib
import json
from datetime import datetime

from fastapi import APIRouter, HTTPException, Query, Request, Response
from sqlalchemy import text

from ..core.grade import grade_for_row
from ..db import get_session

router = APIRouter(prefix="/api")

# summary 只保留前端渲染必需的 metrics 键，去掉 raw/samples 等大字段
SUMMARY_METRIC_KEYS = (
    "depth_km", "usgs_alert", "gdacs_alert", "cma_level", "cma_alertscore",
    "event_count", "latest_slot_count", "article_count", "aggregate", "ratio",
    "baseline_discharge", "peak_day", "frp_sum", "pixels", "war_level", "iso3",
    "track_points", "tsunami_flag",
)


def _feature(r, *, fields: str) -> dict:
    metrics = r.metrics if isinstance(r.metrics, dict) else {}
    if fields == "summary":
        metrics = {k: metrics[k] for k in SUMMARY_METRIC_KEYS if k in metrics}
    props = {
        "id": r.id, "category": r.category, "type": r.type,
        "severity": r.severity, "confidence": r.confidence,
        "status": r.status,
        "magnitude": r.magnitude_value, "unit": r.magnitude_unit,
        "headline": r.headline, "source": r.primary_source,
        "occurred_at": r.occurred_at.isoformat(),
        "first_seen_at": r.first_seen_at.isoformat(),
        "updated_at": r.updated_at.isoformat(),
        "country": r.country_iso3,
        "is_aggregate": bool(r.is_aggregate),
        "grade": grade_for_row(r),
        "metrics": metrics,
    }
    if fields == "full" or r.type == "cyclone":
        # 台风轨迹是地图必需几何，summary 也带；其余 footprint 只在 full 返回
        props["footprint"] = json.loads(r.fp) if r.fp else None
    return {"type": "Feature", "geometry": json.loads(r.pt), "properties": props}


@router.get("/events")
def list_events(
    request: Request,
    response: Response,
    hours: int = Query(24, ge=1, le=9000),
    since: datetime | None = Query(None, description="只返回 updated_at > since 的事件（含 deleted/closed），用于增量"),
    bbox: str | None = Query(None, description="west,south,east,north"),
    types: str | None = Query(None, description="逗号分隔的 type 列表"),
    category: str | None = None,
    min_severity: float = 0.0,
    fields: str = Query("full", pattern="^(summary|full)$"),
    limit: int = Query(2000, ge=1, le=10000),
):
    """返回 GeoJSON FeatureCollection。meta 含 server_time（下一次 since 用）与 count。"""
    clauses = ["occurred_at > now() - (CAST(:h AS text) || ' hours')::interval",
               "severity >= :ms"]
    params: dict = {"h": str(hours), "ms": min_severity, "lim": limit}
    if since is not None:
        clauses.append("updated_at > :since")
        params["since"] = since
    else:
        clauses.append("status <> 'deleted'")
    # 注意: 不能写 (:cat IS NULL OR ...) —— psycopg 无法推断 NULL 参数类型
    if category:
        clauses.append("category = :cat")
        params["cat"] = category
    if types:
        tl = [t.strip() for t in types.split(",") if t.strip()]
        if tl:
            clauses.append("type = ANY(:types)")
            params["types"] = tl
    if bbox:
        try:
            w, s_, e, n = [float(x) for x in bbox.split(",")]
        except ValueError:
            raise HTTPException(400, "bbox 应为 west,south,east,north")
        clauses.append("ST_Intersects(centroid::geometry, ST_MakeEnvelope(:w, :s, :e, :n, 4326))")
        params.update({"w": w, "s": s_, "e": e, "n": n})

    with get_session() as s:
        rows = s.execute(text(f"""
            SELECT id, category, type, severity, confidence, status,
                   magnitude_value, magnitude_unit, headline, primary_source,
                   occurred_at, first_seen_at, updated_at, country_iso3, metrics,
                   is_aggregate,
                   ST_AsGeoJSON(centroid::geometry) AS pt,
                   ST_AsGeoJSON(footprint::geometry) AS fp
              FROM event
             WHERE {' AND '.join(clauses)}
             ORDER BY occurred_at DESC
             LIMIT :lim
        """), params).fetchall()
        server_time = s.execute(text("SELECT now() AT TIME ZONE 'UTC'")).scalar()

    # ETag：由 (最大 updated_at, 行数, 参数) 决定；命中返回 304 省下 2 MB 传输
    max_upd = max((r.updated_at for r in rows), default=None)
    etag_src = f"{max_upd.isoformat() if max_upd else ''}|{len(rows)}|{request.url.query}"
    etag = '"' + hashlib.sha1(etag_src.encode()).hexdigest()[:20] + '"'
    if request.headers.get("if-none-match") == etag:
        return Response(status_code=304, headers={"ETag": etag})
    response.headers["ETag"] = etag
    response.headers["Cache-Control"] = "no-cache"

    feats = [_feature(r, fields=fields) for r in rows]
    return {
        "type": "FeatureCollection",
        "features": feats,
        # server_time 用 UTC 'Z' 结尾：避免 '+08:00' 在 URL 里被当成空格
        "meta": {"count": len(feats), "server_time": server_time.strftime("%Y-%m-%dT%H:%M:%S.%f") + "Z",
                 "fields": fields, "truncated": len(rows) >= limit},
    }


@router.get("/events/{event_id}")
def event_detail(event_id: int):
    with get_session() as s:
        r = s.execute(text("""
            SELECT id, category, type, severity, confidence, status,
                   magnitude_value, magnitude_unit, headline, primary_source,
                   occurred_at, first_seen_at, updated_at, country_iso3, metrics,
                   is_aggregate, revision, closed_at,
                   ST_AsGeoJSON(centroid::geometry) AS pt,
                   ST_AsGeoJSON(footprint::geometry) AS fp
              FROM event WHERE id = :id
        """), {"id": event_id}).fetchone()
        if not r:
            raise HTTPException(404, "event not found")
        obs = s.execute(text("""
            SELECT source, source_event_id, ingested_at
              FROM observation WHERE event_id = :id ORDER BY ingested_at DESC LIMIT 20
        """), {"id": event_id}).fetchall()
        alerts = s.execute(text("""
            SELECT id, rule_name, channel, dispatched_at
              FROM alert WHERE event_id = :id ORDER BY dispatched_at DESC LIMIT 20
        """), {"id": event_id}).fetchall()
    f = _feature(r, fields="full")
    f["properties"]["revision"] = r.revision
    f["properties"]["closed_at"] = r.closed_at.isoformat() if r.closed_at else None
    f["observations"] = [{"source": o.source, "source_event_id": o.source_event_id,
                          "ingested_at": o.ingested_at.isoformat()} for o in obs]
    f["alerts"] = [{"id": a.id, "rule": a.rule_name, "channel": a.channel,
                    "dispatched_at": a.dispatched_at.isoformat()} for a in alerts]
    return f
