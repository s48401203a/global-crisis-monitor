from types import SimpleNamespace

from app.core.alerts import _match_rule


def _row(**kw):
    base = dict(
        type="earthquake",
        category="natural",
        severity=0.5,
        magnitude_value=5.2,
        confidence=1.0,
        in_region=False,
        lat=31.2,
        lon=121.5,
        metrics={},
    )
    base.update(kw)
    return SimpleNamespace(**base)


def test_match_rule_rainstorm() -> None:
    assert _match_rule(_row(type="rainstorm", severity=0.92)) == "暴雨预警-橙色以上"


def test_match_rule_eq_china_m4() -> None:
    from app.config import settings

    old_local = settings.alert_eq_local_mag
    old_global = settings.alert_eq_global_mag
    settings.alert_eq_local_mag = 4.0
    settings.alert_eq_global_mag = 5.0
    try:
        assert (
            _match_rule(_row(magnitude_value=4.1, lon=120.1, lat=30.3))
            == "地震-关注区域内 M≥4.0"
        )
    finally:
        settings.alert_eq_local_mag = old_local
        settings.alert_eq_global_mag = old_global


def test_match_rule_eq_tiny_skipped() -> None:
    assert _match_rule(_row(magnitude_value=2.1, lon=-122.8, lat=38.8)) is None


def test_match_rule_war_baseline_skipped() -> None:
    assert _match_rule(_row(type="war", category="conflict", severity=0.6)) is None
