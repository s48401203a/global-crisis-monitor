"""告警语义集成测试（需要本机 crisis 库）：
  cd app && PYTHONUTF8=1 .venv/bin/python -m tests.integration_alerts
断言：
  1. 新事件首见 → 告警 1 次
  2. 再次 upsert（updated_at 刷新）→ 不重复告警
  3. 静默期内严重度 +0.1 → 不告警；静默过期且 +0.2 → 告警（escalation）
  4. first_seen 早于 2 小时的"旧事件"即便刚 upsert → 不告警
所有测试行以 headline 前缀 '[IT-ALERT]' 标记，结束后清理。
"""
from __future__ import annotations

import sys
from datetime import datetime, timedelta, timezone

from sqlalchemy import text

from app.core.alerts import evaluate_alerts
from app.core.ingest import ingest_events
from app.core.schemas import NormalizedEvent
from app.db import get_session

MARK = "[IT-ALERT]"


def _cleanup():
    with get_session() as s:
        s.execute(text("DELETE FROM event WHERE headline LIKE :m"), {"m": MARK + "%"})
        s.execute(text("DELETE FROM observation WHERE source = 'ittest'"))


def _ev(mag: float, occurred: datetime) -> NormalizedEvent:
    return NormalizedEvent(
        source="ittest", source_event_id="it-eq-1", category="natural", type="earthquake",
        lat=-33.9, lon=-70.5, occurred_at=occurred, headline=f"{MARK} test quake",
        magnitude_value=mag, magnitude_unit="M", metrics={"depth_km": 10},
    )


def _eid() -> int:
    with get_session() as s:
        return s.execute(text("SELECT id FROM event WHERE headline LIKE :m"), {"m": MARK + "%"}).scalar()


def _alerts_for(eid: int) -> int:
    with get_session() as s:
        return s.execute(text("SELECT count(*) FROM alert WHERE event_id = :e"), {"e": eid}).scalar()


def _fired_for(eid: int) -> list[dict]:
    return [a for a in evaluate_alerts() if a["event_id"] == eid]


def main() -> int:
    _cleanup()
    fails = 0

    def check(name, cond):
        nonlocal fails
        print(("OK  " if cond else "FAIL"), name)
        if not cond:
            fails += 1

    try:
        now = datetime.now(timezone.utc)
        # 1. 首见 M5.6 → 告警
        ingest_events([_ev(5.6, now - timedelta(minutes=5))])
        eid = _eid()
        f1 = _fired_for(eid)
        check("first_seen fires once", len(f1) == 1 and _alerts_for(eid) == 1)

        # 2. 同源修订（updated_at 刷新，severity 不变）→ 不重复
        ingest_events([_ev(5.6, now - timedelta(minutes=5))])
        check("re-upsert does not re-fire", len(_fired_for(eid)) == 0 and _alerts_for(eid) == 1)

        # 3a. 静默期内 +0.1 严重度 → 不告警
        with get_session() as s:
            s.execute(text("UPDATE event SET severity = severity + 0.10 WHERE id = :e"), {"e": eid})
        check("small jump inside mute window ignored", len(_fired_for(eid)) == 0)

        # 3b. 静默过期 + 跃升 ≥0.15 → 再次告警（escalation）
        with get_session() as s:
            s.execute(text("UPDATE alert_mute SET muted_until = now() - interval '1 minute' WHERE event_id = :e"), {"e": eid})
            s.execute(text("UPDATE event SET severity = severity + 0.10 WHERE id = :e"), {"e": eid})
        f3 = _fired_for(eid)
        check("escalation after mute expiry fires", len(f3) == 1 and f3[0]["escalation"] is True and _alerts_for(eid) == 2)

        # 4. 旧事件（first_seen 3 小时前）刚被 upsert → 不告警
        _cleanup()
        ingest_events([_ev(6.0, now - timedelta(hours=3))])
        eid2 = _eid()
        with get_session() as s:
            s.execute(text("UPDATE event SET first_seen_at = now() - interval '3 hours', updated_at = now() WHERE id = :e"), {"e": eid2})
        check("old event re-upserted after restart does not fire", len(_fired_for(eid2)) == 0)
    finally:
        _cleanup()
    print(f"{'PASS' if not fails else 'FAIL'}: {fails} failures")
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
