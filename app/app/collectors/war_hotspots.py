# D:\crisis\app\app\collectors\war_hotspots.py
# 战争/武装冲突关注热点（免密钥基线层）
# GDELT DOC API 在高限流下常不可用；本采集器提供持续可见的冲突战区标记，
# 并尽量用国界质心对齐，避免“有冲突却地图空白”。
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from sqlalchemy import text

from .base import BaseCollector
from ..core.schemas import NormalizedEvent
from ..db import get_session

# 仅「国家间 / 代理人 / 边境武装冲突」级战区（非治安枪击）
# iso3 用于归属；霍尔木兹等用关键海峡坐标
HOTSPOTS: list[dict[str, Any]] = [
    {
        "id": "war:UKR",
        "iso3": "UKR",
        "name_zh": "乌克兰—俄罗斯战争",
        "name_en": "Ukraine–Russia war",
        "coords": (31.2, 48.4),
        "level": "high",
        "note": "国家间大规模战争",
    },
    {
        "id": "war:RUS-UKR",
        "iso3": "RUS",
        "name_zh": "俄罗斯—乌克兰战争（俄方战区）",
        "name_en": "Russia–Ukraine war theater",
        "coords": (40.0, 51.0),
        "level": "high",
        "note": "国家间战争相关公开战区",
    },
    {
        "id": "war:ISR-PSE",
        "iso3": "PSE",
        "name_zh": "巴以/加沙武装冲突",
        "name_en": "Israel–Palestine armed conflict",
        "coords": (34.45, 31.5),
        "level": "high",
        "note": "国家/准国家武装冲突",
    },
    {
        "id": "war:IRN",
        "iso3": "IRN",
        "name_zh": "伊朗相关地区军事对峙",
        "name_en": "Iran regional military tension",
        "coords": (53.7, 32.4),
        "level": "medium",
        "note": "国家间代理人与军事对峙",
    },
    {
        "id": "war:HORMUZ",
        "iso3": None,
        "name_zh": "霍尔木兹海峡军事与航运对抗",
        "name_en": "Strait of Hormuz",
        "coords": (56.5, 26.6),
        "level": "high",
        "note": "国家间军事紧张下的战略水道冲突风险",
    },
    {
        "id": "war:YEM",
        "iso3": "YEM",
        "name_zh": "也门内战与红海武装袭扰",
        "name_en": "Yemen war / Red Sea",
        "coords": (48.5, 15.5),
        "level": "high",
        "note": "内战 + 跨境/航运武装冲突",
    },
    {
        "id": "war:SDN",
        "iso3": "SDN",
        "name_zh": "苏丹内战",
        "name_en": "Sudan civil war",
        "coords": (30.2, 15.5),
        "level": "high",
        "note": "武装派别间战争级冲突",
    },
    {
        "id": "war:MMR",
        "iso3": "MMR",
        "name_zh": "缅甸内战/地方武装冲突",
        "name_en": "Myanmar armed conflict",
        "coords": (96.1, 21.9),
        "level": "medium",
        "note": "政权与地方武装战争级冲突",
    },
    {
        "id": "war:SYR",
        "iso3": "SYR",
        "name_zh": "叙利亚武装冲突",
        "name_en": "Syria armed conflict",
        "coords": (38.0, 35.0),
        "level": "medium",
        "note": "多国代理人与地方武装冲突",
    },
    {
        "id": "war:LBN",
        "iso3": "LBN",
        "name_zh": "黎巴嫩边境跨境武装冲突",
        "name_en": "Lebanon border clashes",
        "coords": (35.5, 33.9),
        "level": "medium",
        "note": "跨境军事交火",
    },
    {
        "id": "war:SAHEL",
        "iso3": "MLI",
        "name_zh": "萨赫勒国家间/武装团体战争",
        "name_en": "Sahel armed conflict",
        "coords": (-2.0, 17.0),
        "level": "medium",
        "note": "国家军队与武装团体战争级冲突",
    },
    {
        "id": "war:COD",
        "iso3": "COD",
        "name_zh": "刚果（金）东部武装冲突",
        "name_en": "DRC eastern war",
        "coords": (29.0, -1.5),
        "level": "high",
        "note": "武装团体与国家军队战争级冲突",
    },
]

LEVEL_CONF = {"high": 0.75, "medium": 0.55, "low": 0.35}
LEVEL_MAG = {"high": 3.0, "medium": 2.0, "low": 1.0}


class WarHotspotsCollector(BaseCollector):
    """战争冲突关注热点基线层（始终可见）。"""

    name = "war"

    def fetch(self) -> Any:
        # 无网络依赖：返回内置列表；质心尽量用库内 country 表校准
        with get_session() as s:
            rows = s.execute(text(
                "SELECT iso3, ST_Y(centroid::geometry), ST_X(centroid::geometry) FROM country"
            )).fetchall()
        cents = {r[0]: (float(r[2]), float(r[1])) for r in rows if r[0]}
        out = []
        for h in HOTSPOTS:
            item = dict(h)
            iso = h.get("iso3")
            if iso and iso in cents:
                item["coords"] = cents[iso]
            out.append(item)
        return out

    def normalize(self, raw: Any) -> list[NormalizedEvent]:
        now = datetime.now(timezone.utc)
        # 稳定 source_event_id（不含时间槽）：跨槽 upsert 同一行，避免每 6h 新增一行（REV-04）
        events: list[NormalizedEvent] = []
        for h in raw or []:
            lon, lat = h["coords"]
            level = h.get("level") or "medium"
            conf = LEVEL_CONF.get(level, 0.5)
            stable_id = str(h["id"])  # 如 war:UKR，永不变
            events.append(NormalizedEvent(
                source=self.name,
                source_event_id=stable_id,
                category="conflict",
                type="war",
                lat=float(lat),
                lon=float(lon),
                occurred_at=now,
                headline=f"{h['name_zh']} · {h.get('note') or '国家/武装冲突级战区'}",
                magnitude_value=LEVEL_MAG.get(level, 2.0),
                magnitude_unit="intensity",
                confidence=conf,
                metrics={
                    "war_level": level,
                    "iso3": h.get("iso3"),
                    "theater": h.get("name_en"),
                    "baseline": True,
                },
                raw=h,
            ))
        return events
