"""时间解析与洪水 severity 回归。"""

from datetime import datetime, timezone

from app.collectors.eonet import EonetCollector
from app.collectors.gdacs import GdacsCollector
from app.core.alerts import _match_rule
from app.core.schemas import NormalizedEvent
from app.core.severity import compute_severity


def test_gdacs_naive_is_utc() -> None:
    dt = GdacsCollector._parse_dt("2026-08-01 12:00:00")
    assert dt.tzinfo is not None
    assert dt.utcoffset().total_seconds() == 0


def test_eonet_naive_is_utc() -> None:
    dt = EonetCollector._parse_dt("2026-08-01T12:00:00")
    assert dt.tzinfo is not None


def test_flood_ratio_high_small_river_alertable() -> None:
    ev = NormalizedEvent(
        source="openmeteo",
        source_event_id="t",
        category="natural",
        type="flood",
        lat=0,
        lon=0,
        occurred_at=datetime.now(timezone.utc),
        headline="t",
        magnitude_value=50,
        magnitude_unit="m3/s",
        metrics={"ratio": 5.0},
    )
    assert compute_severity(ev) >= 0.6


def test_war_baseline_does_not_alert() -> None:
    class R:
        type = "war"
        category = "conflict"
        confidence = 0.75
        magnitude_value = 3
        in_region = False
        metrics = {"baseline": True}

    assert _match_rule(R()) is None
