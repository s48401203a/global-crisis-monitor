from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Query
from sqlalchemy import text

from ..core.grade import grade_for_row
from ..db import get_session

router = APIRouter(prefix="/api")


@router.get("/alerts")
def list_alerts(
    since: datetime | None = None,
    rule: str | None = None,
    limit: int = Query(100, ge=1, le=1000),
):
    """告警历史（最近优先），附事件摘要与 grade。"""
    clauses = ["1=1"]
    params: dict = {"lim": limit}
    if since is not None:
        clauses.append("a.dispatched_at > :since")
        params["since"] = since
    if rule:
        clauses.append("a.rule_name = :rule")
        params["rule"] = rule
    with get_session() as s:
        rows = s.execute(text(f"""
            SELECT a.id AS alert_id, a.rule_name, a.channel, a.dispatched_at,
                   e.id, e.category, e.type, e.severity, e.confidence, e.status,
                   e.magnitude_value, e.magnitude_unit, e.headline, e.primary_source,
                   e.occurred_at, e.country_iso3, e.metrics,
                   ST_Y(e.centroid::geometry) AS lat, ST_X(e.centroid::geometry) AS lon
              FROM alert a JOIN event e ON e.id = a.event_id
             WHERE {' AND '.join(clauses)}
             ORDER BY a.dispatched_at DESC
             LIMIT :lim
        """), params).fetchall()
    return {"alerts": [{
        "id": r.alert_id, "event_id": r.id, "rule": r.rule_name, "channel": r.channel,
        "dispatched_at": r.dispatched_at.isoformat(),
        "type": r.type, "category": r.category, "severity": r.severity,
        "headline": r.headline, "source": r.primary_source, "country": r.country_iso3,
        "occurred_at": r.occurred_at.isoformat(), "lat": r.lat, "lon": r.lon,
        "grade": grade_for_row(r),
    } for r in rows]}
