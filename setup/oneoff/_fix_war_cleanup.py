"""Cleanup war rows then re-ingest with stable IDs."""
from __future__ import annotations

from sqlalchemy import text

from app.collectors.war_hotspots import WarHotspotsCollector, HOTSPOTS
from app.db import get_session


def main() -> None:
    with get_session() as s:
        before = s.execute(text("SELECT count(*) FROM event WHERE type='war'")).scalar()
        print("war rows before DELETE:", before)
        s.execute(text("DELETE FROM event WHERE type='war'"))
        after = s.execute(text("SELECT count(*) FROM event WHERE type='war'")).scalar()
        print("war rows after DELETE:", after)

    WarHotspotsCollector().run()
    with get_session() as s:
        n = s.execute(text("SELECT count(*) FROM event WHERE type='war'")).scalar()
        pts = s.execute(
            text(
                "SELECT count(DISTINCT ST_AsText(centroid::geometry)) "
                "FROM event WHERE type='war'"
            )
        ).scalar()
        ids = s.execute(
            text(
                "SELECT o.source_event_id FROM observation o "
                "JOIN event e ON o.event_id=e.id WHERE e.type='war' "
                "ORDER BY o.source_event_id"
            )
        ).fetchall()
        print("war rows after re-ingest:", n, "distinct pts:", pts, "hotspots:", len(HOTSPOTS))
        print("ids:", [r[0] for r in ids])


if __name__ == "__main__":
    main()
