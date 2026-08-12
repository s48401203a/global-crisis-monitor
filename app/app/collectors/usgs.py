# D:\crisis\app\app\collectors\usgs.py
from datetime import datetime, timezone
from typing import Any

from .base import BaseCollector
from ..core.schemas import NormalizedEvent

URL_HOUR = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson"
URL_DAY = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson"


class UsgsCollector(BaseCollector):
    name = "usgs"

    def __init__(self, backfill: bool = False):
        # 服务启动时用 all_day 回补一次,之后常规轮询 all_hour
        self.url = URL_DAY if backfill else URL_HOUR

    def fetch(self) -> Any:
        return self.http_get(self.url).json()

    def normalize(self, raw: Any) -> list[NormalizedEvent]:
        out: list[NormalizedEvent] = []
        for f in raw.get("features", []):
            p = f.get("properties") or {}
            coords = (f.get("geometry") or {}).get("coordinates") or []
            if len(coords) < 2:
                continue

            # 坑:mag 可能为 null(初报未定级),必须判空
            mag = p.get("mag")
            if mag is None:
                continue

            # 坑:coordinates[2] 是深度(km),不是高程
            depth = coords[2] if len(coords) > 2 else None

            out.append(NormalizedEvent(
                source=self.name,
                source_event_id=f["id"],
                category="natural",
                type="earthquake",
                lat=float(coords[1]), lon=float(coords[0]),
                occurred_at=datetime.fromtimestamp(p["time"] / 1000, timezone.utc),
                headline=p.get("place") or "",
                magnitude_value=float(mag),
                magnitude_unit="M",
                metrics={
                    "depth_km": depth,
                    "tsunami_flag": int(p.get("tsunami") or 0),
                    "usgs_alert": p.get("alert"),
                    "felt": p.get("felt"),
                },
                raw=f,
            ))
        return out
