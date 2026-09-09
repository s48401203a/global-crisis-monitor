"""Recompute flood severity for openmeteo-style events that store metrics.ratio."""
from __future__ import annotations

import json
from datetime import datetime, timezone

from sqlalchemy import text

from app.core.schemas import NormalizedEvent
from app.core.severity import compute_severity
from app.db import get_session


def main() -> None:
    with get_session() as s:
        rows = s.execute(
            text(
                "SELECT id, magnitude_value, metrics FROM event WHERE type='flood'"
            )
        ).fetchall()
        updated = 0
        samples = []
        for r in rows:
            metrics = r.metrics or {}
            if isinstance(metrics, str):
                try:
                    metrics = json.loads(metrics)
                except Exception:
                    metrics = {}
            ev = NormalizedEvent(
                source="recompute",
                source_event_id=str(r.id),
                category="natural",
                type="flood",
                lat=0.0,
                lon=0.0,
                occurred_at=datetime.now(timezone.utc),
                headline="",
                magnitude_value=r.magnitude_value,
                magnitude_unit="m3/s",
                metrics=metrics if isinstance(metrics, dict) else {},
            )
            sev = compute_severity(ev)
            s.execute(
                text("UPDATE event SET severity=:s WHERE id=:id"),
                {"s": sev, "id": r.id},
            )
            updated += 1
            if len(samples) < 5:
                samples.append((r.id, r.magnitude_value, metrics.get("ratio"), sev))
        print("updated", updated, "samples", samples)
        print(
            s.execute(
                text(
                    "SELECT min(severity), avg(severity), max(severity), count(*) "
                    "FROM event WHERE type='flood'"
                )
            ).fetchone()
        )


if __name__ == "__main__":
    main()
