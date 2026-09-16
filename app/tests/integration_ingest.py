"""采集结果隔离与成败口径（临时库）：
  两源并发通知不串台；savepoint 回滚不进已提交集合；整批失败非绿；合法空结果成功。
"""
from __future__ import annotations

import sys
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone

from sqlalchemy import text

from app.collectors.base import BaseCollector
from app.core.ingest import ingest_events
from app.core.schemas import NormalizedEvent
from app.db import get_session
from tests.isolated_db import isolated_database

MARK = "[IT-INGEST]"


def _ev(source: str, sid: str, *, bad: bool = False, lat: float | None = None,
        lon: float | None = None, mag: float = 5.5) -> NormalizedEvent:
    fp = {"type": "LineString"} if bad else None  # 缺 coordinates → GeoJSON 失败
    seed = abs(hash(sid)) % 8000
    return NormalizedEvent(
        source=source, source_event_id=sid, category="natural", type="earthquake",
        lat=lat if lat is not None else -40.0 + (seed % 80),
        lon=lon if lon is not None else -170.0 + (seed % 340),
        occurred_at=datetime.now(timezone.utc) - timedelta(minutes=3, seconds=seed % 50),
        headline=f"{MARK} {source} {sid}", magnitude_value=mag, magnitude_unit="M",
        footprint_geojson=fp, metrics={"depth_km": 10},
    )


class _Fake(BaseCollector):
    name = "ittest"

    def __init__(self, events, name="ittest"):
        self.name = name
        self._events = events

    def fetch(self):
        return self._events

    def normalize(self, raw):
        return list(raw)


def main() -> int:
    fails = 0

    def check(name, cond, extra=""):
        nonlocal fails
        print(("OK  " if cond else "FAIL"), name, extra)
        if not cond:
            fails += 1

    empty = ingest_events([])
    check("legal empty outcome", empty.outcome == "empty" and empty.success_count == 0)

    a = ingest_events([_ev("usgs", "ing-a1"), _ev("usgs", "ing-a2")])
    b = ingest_events([_ev("cenc", "ing-b1")])
    check("ingest returns own ids", a.outcome == "ok" and len(a.committed_ids) == 2)
    check("second ingest isolated", b.outcome == "ok" and len(b.committed_ids) == 1)
    check("ids do not leak across calls", set(a.committed_ids).isdisjoint(b.committed_ids))

    mixed = ingest_events([_ev("usgs", "ing-ok"), _ev("usgs", "ing-bad", bad=True)])
    check("partial outcome", mixed.outcome == "partial", mixed.outcome)
    check("failed row not in committed", mixed.success_count == 1 and len(mixed.failed) == 1)
    check("bad source_event_id recorded", mixed.failed[0]["source_event_id"] == "ing-bad")

    all_bad = ingest_events([_ev("usgs", "ing-all-bad", bad=True)])
    check("all-fail outcome", all_bad.outcome == "failed" and all_bad.success_count == 0)

    # 采集器健康：全部失败不能 touch_success
    fake_fail = _Fake([_ev("usgs", "ing-run-bad", bad=True)], name="ittest")
    n = fake_fail.run()
    check("collector run all-fail returns 0", n == 0)
    with get_session() as s:
        row = s.execute(text(
            "SELECT last_ingest_status, consecutive_failures, last_success_at FROM source_health WHERE source='ittest'"
        )).fetchone()
    check("all-fail not green", row is not None and row[0] == "failed" and (row[1] or 0) >= 1)

    fake_empty = _Fake([], name="ittest2")
    n2 = fake_empty.run()
    check("empty collector returns 0", n2 == 0)
    with get_session() as s:
        row2 = s.execute(text(
            "SELECT last_ingest_status, consecutive_failures FROM source_health WHERE source='ittest2'"
        )).fetchone()
    check("empty collector marked empty/ok", row2 is not None and row2[0] == "empty" and row2[1] == 0)

    fake_ok = _Fake([_ev("usgs", "ing-ok2")], name="ittest3")
    n3 = fake_ok.run()
    check("ok collector commits", n3 == 1)

    # 并发两源
    def _one(src, sid):
        return ingest_events([_ev(src, sid)])

    with ThreadPoolExecutor(max_workers=2) as ex:
        f1 = ex.submit(_one, "usgs", "ing-p1")
        f2 = ex.submit(_one, "cenc", "ing-p2")
        r1, r2 = f1.result(), f2.result()
    check("concurrent results isolated",
          set(r1.committed_ids).isdisjoint(r2.committed_ids) and r1.success_count == 1 and r2.success_count == 1)

    # 降级：同源峰值保留、当前值下降
    now = datetime.now(timezone.utc)
    hi = NormalizedEvent(
        source="usgs", source_event_id="ing-peak", category="natural", type="earthquake",
        lat=-11.0, lon=21.0, occurred_at=now, headline=f"{MARK} peak",
        magnitude_value=7.2, magnitude_unit="M",
    )
    ingest_events([hi])
    lo = NormalizedEvent(
        source="usgs", source_event_id="ing-peak", category="natural", type="earthquake",
        lat=-11.0, lon=21.0, occurred_at=now, headline=f"{MARK} peak down",
        magnitude_value=5.0, magnitude_unit="M",
    )
    ingest_events([lo])
    with get_session() as s:
        sev = s.execute(text(
            "SELECT severity, severity_peak, magnitude_value FROM event WHERE headline LIKE :m"
        ), {"m": MARK + " peak%"}).fetchone()
    check("current severity can fall", sev is not None and sev[0] < sev[1], str(sev))
    check("peak retained", sev is not None and sev[1] > sev[0] and float(sev[2]) == 5.0, str(sev))

    # 低优先级源不能覆盖
    ingest_events([NormalizedEvent(
        source="gdelt", source_event_id="ing-peak-gdelt", category="natural", type="earthquake",
        lat=-11.0, lon=21.0, occurred_at=now, headline=f"{MARK} takeover-block",
        magnitude_value=5.05, magnitude_unit="M",
    )])
    with get_session() as s:
        row = s.execute(text("""
            SELECT e.primary_source, e.magnitude_value
              FROM event e JOIN observation o ON o.event_id = e.id
             WHERE o.source='usgs' AND o.source_event_id='ing-peak'
        """)).fetchone()
    check("low-priority source does not take over", row is not None and row[0] == "usgs" and float(row[1]) == 5.0, str(row))

    # 关闭后重现
    with get_session() as s:
        s.execute(text("""
            UPDATE event SET status='closed', closed_at=now()
             WHERE id = (SELECT event_id FROM observation WHERE source='usgs' AND source_event_id='ing-peak')
        """))
    ingest_events([NormalizedEvent(
        source="usgs", source_event_id="ing-peak", category="natural", type="earthquake",
        lat=-11.0, lon=21.0, occurred_at=now, headline=f"{MARK} reopened",
        magnitude_value=5.1, magnitude_unit="M",
    )])
    with get_session() as s:
        st = s.execute(text("""
            SELECT e.status, e.closed_at FROM event e
              JOIN observation o ON o.event_id = e.id
             WHERE o.source='usgs' AND o.source_event_id='ing-peak'
        """)).fetchone()
    check("closed event reopens", st is not None and st[0] in ("active", "revised", "unconfirmed") and st[1] is None, str(st))

    print(f"{'PASS' if not fails else 'FAIL'}: {fails} failures")
    return 1 if fails else 0


if __name__ == "__main__":
    with isolated_database():
        sys.exit(main())
