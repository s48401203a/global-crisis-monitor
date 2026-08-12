# D:\crisis\app\app\collectors\eonet.py
from datetime import datetime
from typing import Any

from .base import BaseCollector
from ..core.schemas import NormalizedEvent

URL = "https://eonet.gsfc.nasa.gov/api/v3/events"

CATEGORY_MAP = {
    "wildfires": "wildfire",
    "severeStorms": "cyclone",
    "volcanoes": "volcano",
    "floods": "flood",
    "drought": "drought",
}


class EonetCollector(BaseCollector):
    name = "eonet"

    def fetch(self) -> Any:
        return self.http_get(URL, params={"status": "open", "limit": 200}).json()

    def normalize(self, raw: Any) -> list[NormalizedEvent]:
        out: list[NormalizedEvent] = []
        for ev in raw.get("events", []):
            cats = ev.get("categories") or []
            if not cats:
                continue
            etype = CATEGORY_MAP.get(cats[0].get("id"))
            if not etype:
                continue   # 忽略冰情等本项目不关注的类别

            geoms = ev.get("geometry") or []
            if not geoms:
                continue

            # 关键:geometry 是数组。台风含完整路径点序列,取末点为当前位置
            last = geoms[-1]
            coords = last.get("coordinates") or []
            if len(coords) < 2:
                continue

            footprint = None
            if len(geoms) > 1:
                # 多点 → 构造路径线,供前端画台风轨迹
                line = [g["coordinates"] for g in geoms
                        if len(g.get("coordinates") or []) >= 2]
                if len(line) >= 2:
                    footprint = {"type": "LineString", "coordinates": line}

            out.append(NormalizedEvent(
                source=self.name,
                source_event_id=ev["id"],
                category="natural",
                type=etype,
                lat=float(coords[1]), lon=float(coords[0]),
                footprint_geojson=footprint,
                occurred_at=self._parse_dt(last.get("date")),
                headline=ev.get("title") or "",
                # 单位原样保留:acres 与 kts 语义不同,不做换算
                magnitude_value=last.get("magnitudeValue"),
                magnitude_unit=last.get("magnitudeUnit"),
                metrics={"track_points": len(geoms),
                         "eonet_link": ev.get("link")},
                raw=ev,
            ))
        return out

    @staticmethod
    def _parse_dt(v: str | None) -> datetime:
        from datetime import timezone
        if not v:
            return datetime.now(timezone.utc)
        s = str(v).strip().replace("Z", "+00:00")
        try:
            dt = datetime.fromisoformat(s)
        except ValueError:
            return datetime.now(timezone.utc)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        else:
            dt = dt.astimezone(timezone.utc)
        return dt
