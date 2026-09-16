from app.core.grade import compute_grade, fmt_num, official_tone


def _g(**kw):
    base = dict(type_="earthquake", magnitude=None, unit=None, confidence=1.0,
                source="usgs", headline="", metrics={})
    base.update(kw)
    return compute_grade(**base)


def test_fmt_num_matches_frontend() -> None:
    assert fmt_num(5.0) == "5"
    assert fmt_num(5.64) == "5.6"
    assert fmt_num(123.4) == "123"
    assert fmt_num(12345.6) == "12,346"


def test_earthquake_bands_and_tones() -> None:
    assert _g(magnitude=7.2)["tone"] == "red" and _g(magnitude=7.2)["band"] == "major"
    assert _g(magnitude=5.5)["tone"] == "yellow"
    assert _g(magnitude=2.1)["tone"] == "neutral" and _g(magnitude=2.1)["zh"] == "微震 M2.1"
    g = _g(magnitude=6.0, metrics={"usgs_alert": "orange"})
    assert g["tone"] == "yellow" and g["zh"].startswith("橙色警报 · 强震")
    assert _g()["band"] == "na"


def test_cyclone_and_wildfire_units() -> None:
    assert _g(type_="cyclone", magnitude=120)["band"] == "cat4"
    assert _g(type_="wildfire", magnitude=2000, unit="MW")["band"] == "large"
    assert _g(type_="wildfire", magnitude=2000, unit="acres")["band"] == "medium"


def test_cma_levels_and_flood_ratio() -> None:
    r = _g(type_="rainstorm", source="cma", unit="alert", headline="广西北海市发布暴雨橙色预警")
    assert r["tone"] == "orange" and r["zh"] == "橙色暴雨预警"
    f = _g(type_="flood", source="openmeteo", magnitude=8911.5, unit="m3/s", metrics={"ratio": 3.7})
    assert f["tone"] == "yellow" and "3.7" in f["en"]
    assert official_tone("黄山市发布大风黄色预警", {}) == "yellow"
    assert official_tone("黄山市天气", {}) is None


def test_conflict_confidence_bands() -> None:
    g = _g(type_="armed_clash", magnitude=34, unit="events", confidence=0.8)
    assert g["tone"] == "red" and g["zh"] == "高置信 · 34 起事件"
    assert _g(type_="crisis_signal", magnitude=3, unit="articles", confidence=0.3)["tone"] == "yellow"
