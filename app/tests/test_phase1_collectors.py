"""Phase 1：GDELT 国家×日聚合、FIRMS 网格聚类、Open-Meteo 基线门槛、告警规则。"""
from __future__ import annotations

from datetime import datetime, timezone
from types import SimpleNamespace

from app.collectors.gdelt import GdeltCollector
from app.collectors.firms import cluster_pixels
from app.core.alerts import _match_rule
from app.core.schemas import NormalizedEvent
from app.core.severity import compute_severity


def _gdelt_row(lat: float, lon: float, fips: str = "UP", code="193") -> list[str]:
    row = [""] * 61
    row[26] = code          # EventCode
    row[27] = code[:2]      # EventBaseCode
    row[28] = code[:2]      # EventRootCode
    row[30] = "-10"         # Goldstein
    row[31] = "8"           # NumMentions
    row[33] = "3"           # NumArticles
    row[12] = "MIL"         # Actor1Type1
    row[52] = "Kyiv, Ukraine"
    row[53] = fips
    row[56] = str(lat)
    row[57] = str(lon)
    return row


def _collector_with_prior(prior: dict) -> GdeltCollector:
    c = GdeltCollector()
    c._country_index = [("UKR", "Ukraine", 48.4, 31.2)]
    c._iso_centroid = {"UKR": (31.2, 48.4, "Ukraine")}
    c._prior_day_slots = lambda day: prior  # type: ignore[method-assign]
    return c


def test_gdelt_export_aggregates_country_day_single_row() -> None:
    c = _collector_with_prior({})
    rows = [_gdelt_row(50.4, 30.5), _gdelt_row(49.9, 36.2), _gdelt_row(48.0, 37.8)]
    out = c._normalize_export(rows)
    assert len(out) == 1
    ev = out[0]
    assert ev.type == "armed_clash"
    assert ev.category == "conflict"
    assert ev.source_event_id.startswith("day:UKR:")
    assert ev.metrics["aggregate"] is True
    assert ev.metrics["event_count"] == 3
    assert ev.occurred_at.hour == 0 and ev.occurred_at.minute == 0
    # 坐标 = 本槽报道点均值（不吸附国家质心，避免与战区层重叠）
    assert abs(ev.lat - (50.4 + 49.9 + 48.0) / 3) < 1e-6
    assert abs(ev.lon - (30.5 + 36.2 + 37.8) / 3) < 1e-6


def test_gdelt_second_slot_accumulates_into_same_row() -> None:
    now = datetime.now(timezone.utc)
    day = now.strftime("%Y%m%d")
    prior = {f"day:UKR:{day}": {"0000": 5, "0015": 4}}
    c = _collector_with_prior(prior)
    out = c._normalize_export([_gdelt_row(50.4, 30.5), _gdelt_row(49.9, 36.2)])
    assert len(out) == 1
    ev = out[0]
    assert ev.source_event_id == f"day:UKR:{day}"
    assert ev.metrics["event_count"] == 5 + 4 + 2
    assert ev.metrics["latest_slot_count"] == 2
    assert len(ev.metrics["slots"]) == 3


def test_gdelt_single_hit_country_dropped() -> None:
    c = _collector_with_prior({})
    assert c._normalize_export([_gdelt_row(50.4, 30.5)]) == []


def test_firms_cluster_merges_pixels_and_drops_singletons() -> None:
    px = [
        {"latitude": "30.0000", "longitude": "110.0000", "frp": "12.5", "confidence": "h",
         "acq_date": "2026-09-09", "acq_time": "0512", "bright_ti4": "340"},
        {"latitude": "30.0030", "longitude": "110.0040", "frp": "8.0", "confidence": "n",
         "acq_date": "2026-09-09", "acq_time": "0512", "bright_ti4": "335"},
        {"latitude": "31.5000", "longitude": "112.0000", "frp": "3.0", "confidence": "l",
         "acq_date": "2026-09-09", "acq_time": "0512", "bright_ti4": "310"},
    ]
    cl = cluster_pixels(px, grid_km=1.0, min_pixels=2)
    assert len(cl) == 1
    assert cl[0]["n"] == 2
    assert cl[0]["frp_sum"] == 20.5
    assert cl[0]["conf_hi"] == 1
    assert cl[0]["latest"] == datetime(2026, 9, 9, 5, 12, tzinfo=timezone.utc)


def test_wildfire_severity_uses_frp_when_unit_mw() -> None:
    small = NormalizedEvent(source="firms", source_event_id="a", category="natural", type="wildfire",
                            lat=0, lon=0, occurred_at=datetime.now(timezone.utc),
                            magnitude_value=20.0, magnitude_unit="MW")
    big = small.model_copy(update={"magnitude_value": 2000.0})
    assert compute_severity(small) < 0.31
    assert compute_severity(big) >= 0.72


def _row(**kw):
    base = dict(type="armed_clash", category="conflict", severity=0.5, magnitude_value=12,
                confidence=0.8, in_region=False, lat=48.4, lon=31.2, is_aggregate=True,
                metrics={"aggregate": True, "event_count": 12}, muted_severity=None)
    base.update(kw)
    return SimpleNamespace(**base)


def test_alert_armed_clash_requires_daily_count_threshold() -> None:
    from app.config import settings
    old = settings.alert_conflict_min_events
    settings.alert_conflict_min_events = 10
    try:
        assert _match_rule(_row()) == "武装冲突-当日高强度"
        assert _match_rule(_row(metrics={"aggregate": True, "event_count": 3}, magnitude_value=3)) is None
        assert _match_rule(_row(confidence=0.5)) is None
        assert _match_rule(_row(in_region=True)) == "武装冲突-关注区域内"
    finally:
        settings.alert_conflict_min_events = old
