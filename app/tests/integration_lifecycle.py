"""生命周期集成测试（需要本机 crisis 库）：
  cd app && PYTHONUTF8=1 .venv/bin/python -m tests.integration_lifecycle
断言：EONET 源事件的 observation 超过 3 轮未刷新且源最近成功 → closed；观测新鲜的不关闭；
      源近期失败（非事件结束）时不关闭。
"""
from __future__ import annotations

import sys
from datetime import datetime, timedelta, timezone

from sqlalchemy import text

from app.core.ingest import ingest_events
from app.core.lifecycle import close_stale_events
from app.core.schemas import NormalizedEvent
from app.db import get_session

MARK = "[IT-LIFE]"


def _cleanup():
    with get_session() as s:
        s.execute(text("DELETE FROM event WHERE headline LIKE :m"), {"m": MARK + "%"})
        s.execute(text("DELETE FROM observation WHERE source = 'eonet' AND source_event_id LIKE 'it-life-%'"))


def _ev(sid: str) -> NormalizedEvent:
    return NormalizedEvent(source="eonet", source_event_id=sid, category="natural", type="wildfire",
                           lat=-20.0, lon=130.0, occurred_at=datetime.now(timezone.utc) - timedelta(hours=1),
                           headline=f"{MARK} {sid}", magnitude_value=500, magnitude_unit="acres")


def _status(sid: str) -> str:
    with get_session() as s:
        return s.execute(text("""
            SELECT e.status FROM event e JOIN observation o ON o.event_id = e.id
             WHERE o.source='eonet' AND o.source_event_id=:sid"""), {"sid": sid}).scalar()


def main() -> int:
    fails = 0

    def check(name, cond):
        nonlocal fails
        print(("OK  " if cond else "FAIL"), name)
        if not cond:
            fails += 1

    _cleanup()
    try:
        ingest_events([_ev("it-life-stale"), _ev("it-life-fresh")])
        with get_session() as s:
            # stale：观测 2 小时前；fresh：刚刚
            s.execute(text("UPDATE observation SET ingested_at = now() - interval '2 hours' WHERE source_event_id='it-life-stale'"))
            # 保存并伪造 eonet 健康状态：最近成功
            saved = s.execute(text("SELECT last_success_at FROM source_health WHERE source='eonet'")).scalar()
            s.execute(text("""INSERT INTO source_health (source, last_attempt_at, last_success_at) VALUES ('eonet', now(), now())
                              ON CONFLICT (source) DO UPDATE SET last_success_at = now()"""))
        n = close_stale_events()
        check("stale eonet event closed", _status("it-life-stale") == "closed" and n >= 1)
        check("fresh eonet event stays active", _status("it-life-fresh") in ("active", "revised"))
        # 源故障场景：last_success 很旧 → 不应关闭
        ingest_events([_ev("it-life-stale2")])
        with get_session() as s:
            s.execute(text("UPDATE observation SET ingested_at = now() - interval '2 hours' WHERE source_event_id='it-life-stale2'"))
            s.execute(text("UPDATE source_health SET last_success_at = now() - interval '3 hours' WHERE source='eonet'"))
        close_stale_events()
        check("not closed when source itself is failing", _status("it-life-stale2") in ("active", "revised"))
        with get_session() as s:
            s.execute(text("UPDATE source_health SET last_success_at = :t WHERE source='eonet'"), {"t": saved})
    finally:
        _cleanup()
    print(f"{'PASS' if not fails else 'FAIL'}: {fails} failures")
    return 1 if fails else 0


if __name__ == "__main__":
    from tests.isolated_db import isolated_database
    with isolated_database():
        sys.exit(main())
