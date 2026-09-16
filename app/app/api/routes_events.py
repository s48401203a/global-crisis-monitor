# 事件 API v2。全部 def（同步 psycopg）。
#   GET /api/events          列表（GeoJSON）：hours/since_seq/cursor/since/bbox/types/...
#   GET /api/events/reconcile 窗口内 id 对账（快照完整性）
#   GET /api/events/{id}     详情：full 字段 + observations + alerts
from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Query, Request, Response
from sqlalchemy import text

from ..core.grade import grade_for_row
from ..db import get_session

router = APIRouter(prefix="/api")

SUMMARY_METRIC_KEYS = (
    "depth_km", "usgs_alert", "gdacs_alert", "cma_level", "cma_alertscore",
    "event_count", "latest_slot_count", "article_count", "aggregate", "ratio",
    "baseline_discharge", "peak_day", "frp_sum", "pixels", "war_level", "iso3",
    "track_points", "tsunami_flag",
)


def _iso_z(dt) -> str:
    if dt is None:
        return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f") + "Z"
    if getattr(dt, "tzinfo", None) is None:
        return dt.strftime("%Y-%m-%dT%H:%M:%S.%f") + "Z"
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f") + "Z"


def _feature(r, *, fields: str) -> dict:
    metrics = r.metrics if isinstance(r.metrics, dict) else {}
    if fields == "summary":
        metrics = {k: metrics[k] for k in SUMMARY_METRIC_KEYS if k in metrics}
    peak = getattr(r, "severity_peak", None)
    if peak is None:
        peak = r.severity
    seq = getattr(r, "change_seq", None)
    props = {
        "id": r.id, "category": r.category, "type": r.type,
        "severity": r.severity, "severity_peak": peak, "confidence": r.confidence,
        "status": r.status,
        "magnitude": r.magnitude_value, "unit": r.magnitude_unit,
        "headline": r.headline, "source": r.primary_source,
        "occurred_at": r.occurred_at.isoformat(),
        "first_seen_at": r.first_seen_at.isoformat(),
        "updated_at": r.updated_at.isoformat(),
        "change_seq": int(seq) if seq is not None else None,
        "country": r.country_iso3,
        "is_aggregate": bool(r.is_aggregate),
        "grade": grade_for_row(r),
        "metrics": metrics,
    }
    if fields == "full" or r.type == "cyclone":
        props["footprint"] = json.loads(r.fp) if r.fp else None
    return {"type": "Feature", "geometry": json.loads(r.pt), "properties": props}


def _select_cols() -> str:
    return """
            SELECT id, category, type, severity, severity_peak, confidence, status,
                   magnitude_value, magnitude_unit, headline, primary_source,
                   occurred_at, first_seen_at, updated_at, country_iso3, metrics,
                   is_aggregate, change_seq,
                   ST_AsGeoJSON(centroid::geometry) AS pt,
                   ST_AsGeoJSON(footprint::geometry) AS fp
              FROM event
    """


@router.get("/events/reconcile")
def reconcile_events(
    hours: int = Query(24, ge=1, le=9000),
):
    """当前时间窗口内未删除事件的 id 集合，供客户端对账。含 closed。"""
    with get_session() as s:
        rows = s.execute(text("""
            SELECT id, status, change_seq FROM event
             WHERE occurred_at > now() - (CAST(:h AS text) || ' hours')::interval
               AND status <> 'deleted'
             ORDER BY id
        """), {"h": str(hours)}).fetchall()
        hw = s.execute(text("SELECT COALESCE(MAX(change_seq), 0) FROM event")).scalar()
        server_time = s.execute(text("SELECT clock_timestamp() AT TIME ZONE 'UTC'")).scalar()
    ids = [int(r.id) for r in rows]
    closed_ids = [int(r.id) for r in rows if r.status == "closed"]
    return {
        "hours": hours,
        "ids": ids,
        "closed_ids": closed_ids,
        "count": len(ids),
        "high_water": int(hw or 0),
        "server_time": _iso_z(server_time),
        "protocol": "snapshot-reconcile",
    }


@router.get("/events")
def list_events(
    request: Request,
    response: Response,
    hours: int = Query(24, ge=1, le=9000),
    since: datetime | None = Query(None, description="兼容：updated_at > since；新客户端请用 since_seq"),
    since_seq: int | None = Query(None, description="增量：change_seq > since_seq（含 deleted/closed）"),
    cursor: int | None = Query(None, description="分页游标：上一页最后一条 change_seq"),
    bbox: str | None = Query(None, description="west,south,east,north"),
    types: str | None = Query(None, description="逗号分隔的 type 列表"),
    category: str | None = None,
    min_severity: float = 0.0,
    fields: str = Query("full", pattern="^(summary|full)$"),
    limit: int = Query(2000, ge=1, le=10000),
):
    """GeoJSON FeatureCollection。

    协议：
    - 快照（无 since_seq/since）：窗口内未删除事件，按 change_seq 升序稳定分页。
    - 增量（since_seq 或 since）：不按 occurred_at 过滤，以便投递窗口外的 deleted/closed。
    - 截断时 meta.truncated=true 且给出 next_cursor；客户端必须续读，不得把本页
      server_time / high_water 当作已完整水位。
    """
    incremental = since_seq is not None or since is not None
    clauses: list[str] = ["severity >= :ms"]
    params: dict = {"h": str(hours), "ms": min_severity, "lim": limit}

    watermark = cursor
    if watermark is None and since_seq is not None:
        watermark = since_seq
    if watermark is not None:
        clauses.append("change_seq > :wm")
        params["wm"] = int(watermark)

    if incremental:
        if since is not None and since_seq is None and cursor is None:
            clauses.append("updated_at > :since")
            params["since"] = since
    else:
        clauses.append("occurred_at > now() - (CAST(:h AS text) || ' hours')::interval")
        clauses.append("status <> 'deleted'")

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
            {_select_cols()}
             WHERE {' AND '.join(clauses)}
             ORDER BY change_seq ASC, id ASC
             LIMIT :lim
        """), params).fetchall()
        server_time = s.execute(text("SELECT clock_timestamp() AT TIME ZONE 'UTC'")).scalar()
        hw_row = s.execute(text("SELECT COALESCE(MAX(change_seq), 0) FROM event")).scalar()

    max_upd = max((r.updated_at for r in rows), default=None)
    etag_src = f"{max_upd.isoformat() if max_upd else ''}|{len(rows)}|{request.url.query}"
    etag = '"' + hashlib.sha1(etag_src.encode()).hexdigest()[:20] + '"'
    if request.headers.get("if-none-match") == etag:
        return Response(status_code=304, headers={"ETag": etag})
    response.headers["ETag"] = etag
    response.headers["Cache-Control"] = "no-cache"

    feats = [_feature(r, fields=fields) for r in rows]
    truncated = len(rows) >= limit
    last_seq = int(rows[-1].change_seq) if rows and rows[-1].change_seq is not None else watermark
    next_cursor = last_seq if truncated and last_seq is not None else None
    return {
        "type": "FeatureCollection",
        "features": feats,
        "meta": {
            "count": len(feats),
            "server_time": _iso_z(server_time),
            "fields": fields,
            "truncated": truncated,
            "next_cursor": next_cursor,
            "high_water": int(hw_row or 0),
            "page_high_water": last_seq,
            "mode": "changes" if incremental else "snapshot",
            "complete": not truncated,
        },
    }


@router.get("/events/{event_id}")
def event_detail(event_id: int):
    with get_session() as s:
        r = s.execute(text("""
            SELECT id, category, type, severity, severity_peak, confidence, status,
                   magnitude_value, magnitude_unit, headline, primary_source,
                   occurred_at, first_seen_at, updated_at, country_iso3, metrics,
                   is_aggregate, revision, closed_at, change_seq,
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
