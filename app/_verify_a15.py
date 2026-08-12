"""One-shot verification for TASK-A1..A5."""
from __future__ import annotations

from sqlalchemy import text

from app.db import get_session


def main() -> None:
    with get_session() as s:
        cols = [
            r[0]
            for r in s.execute(
                text(
                    "SELECT column_name FROM information_schema.columns "
                    "WHERE table_name='alert' ORDER BY ordinal_position"
                )
            ).fetchall()
        ]
        print("alert columns:", cols)
        time_col = "fired_at" if "fired_at" in cols else ("created_at" if "created_at" in cols else None)

        print("=== A1 alerts recent ===")
        if time_col:
            q = (
                f"SELECT rule_name, count(*) FROM alert "
                f"WHERE {time_col} > now() - interval '6 hours' "
                f"GROUP BY 1 ORDER BY 2 DESC"
            )
            print(s.execute(text(q)).fetchall() or "(empty)")
        else:
            print(s.execute(text("SELECT rule_name, count(*) FROM alert GROUP BY 1 ORDER BY 2 DESC LIMIT 20")).fetchall())

        print("=== A3 war rows vs distinct points ===")
        print(
            s.execute(
                text(
                    "SELECT type, count(*), "
                    "count(DISTINCT ST_AsText(centroid::geometry)) AS distinct_pts "
                    "FROM event WHERE type='war' GROUP BY 1"
                )
            ).fetchall()
        )
        print(
            "war source_event_id samples:",
            s.execute(
                text(
                    "SELECT o.source_event_id FROM observation o "
                    "JOIN event e ON o.event_id=e.id WHERE e.type='war' "
                    "ORDER BY o.source_event_id DESC LIMIT 8"
                )
            ).fetchall(),
        )

        print("=== A4 timezone ===", s.execute(text("SHOW timezone")).scalar())
        print("=== A4 gdacs sample ===")
        print(
            s.execute(
                text(
                    "SELECT o.source_event_id, e.occurred_at "
                    "FROM observation o JOIN event e ON o.event_id=e.id "
                    "WHERE o.source='gdacs' "
                    "ORDER BY e.occurred_at DESC LIMIT 5"
                )
            ).fetchall()
        )

        print("=== A5 flood severity ===")
        print(
            s.execute(
                text(
                    "SELECT type, min(severity), avg(severity), max(severity), count(*) "
                    "FROM event WHERE type='flood' GROUP BY 1"
                )
            ).fetchall()
        )


if __name__ == "__main__":
    main()
