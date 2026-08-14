from app.collectors.cma_alert import classify_cma_text, parse_level, CmaAlertCollector
from app.collectors.cenc import CencCollector
from app.core.severity import compute_severity


def test_classify_rainstorm_as_flood() -> None:
    assert classify_cma_text("杭州市气象台发布暴雨黄色预警") == "rainstorm"
    assert classify_cma_text("山洪灾害气象风险橙色预警") == "flood"
    assert classify_cma_text("台风橙色预警") == "cyclone"
    assert classify_cma_text("森林草原火险橙色预警") == "wildfire"
    assert classify_cma_text("大风蓝色预警") is None
    assert (
        classify_cma_text("雷电黄色预警：雷雨时可能伴有短时强降水、强对流") is None
    )
    assert parse_level("暴雨红色预警[Ⅰ级]") == "红"
    assert parse_level("黄山市气象台发布暴雨橙色预警") == "橙"
    assert parse_level("红河州气象台发布暴雨黄色预警") == "黄"
    assert parse_level("蓝田县发布暴雨蓝色预警") == "蓝"


def test_cma_normalize_skips_wind_keeps_rain() -> None:
    raw = {
        "code": 0,
        "data": [
            {
                "id": "hn-wind",
                "title": "河南省信阳市新县发布大风蓝色预警",
                "headline": "大风蓝色预警",
                "description": "偏北风",
                "latitude": 31.63,
                "longitude": 114.87,
                "effective": "2026/08/14 10:45",
                "type": "p0007004",
            },
            {
                "id": "hz-rain",
                "title": "杭州市气象台发布暴雨橙色预警",
                "headline": "暴雨橙色预警[II级/严重]",
                "description": "强降雨",
                "latitude": 30.27,
                "longitude": 120.15,
                "effective": "2026/08/14 14:00",
                "type": "p0002002",
            },
        ],
    }
    evs = CmaAlertCollector().normalize(raw)
    assert len(evs) == 1
    assert evs[0].type == "rainstorm"
    assert evs[0].source_event_id == "hz-rain"
    assert evs[0].metrics["cma_level"] == "橙"
    assert compute_severity(evs[0]) == 0.75


def test_cenc_normalize_filters_small() -> None:
    raw = {
        "No1": {
            "EventID": "CD.1",
            "time": "2026-08-14 09:33:43",
            "location": "四川内江市隆昌市",
            "placeName": "四川内江市隆昌市",
            "magnitude": "3.6",
            "depth": "6",
            "latitude": "29.22",
            "longitude": "105.23",
        },
        "No2": {
            "EventID": "CD.2",
            "time": "2026-08-14 08:00:00",
            "placeName": "小震",
            "magnitude": "2.1",
            "latitude": "30",
            "longitude": "104",
        },
    }
    evs = CencCollector().normalize(raw)
    assert len(evs) == 1
    assert evs[0].type == "earthquake"
    assert evs[0].magnitude_value == 3.6
    assert evs[0].lat == 29.22
