"""中国地震台网速报（公开目录；官方 ajax 当前不可用时走 CENC 镜像）。"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from zoneinfo import ZoneInfo

from .base import BaseCollector
from ..core.schemas import NormalizedEvent

# 官方 CEIC ajax/证书目前不可用；该镜像字段与台网速报一致
URL = "https://api.wolfx.jp/cenc_eqlist.json"
TZ_CN = ZoneInfo("Asia/Shanghai")

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json",
}


def _parse_cn_time(raw: str | None) -> datetime:
    if raw:
        for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M"):
            try:
                return datetime.strptime(raw.strip(), fmt).replace(tzinfo=TZ_CN).astimezone(
                    timezone.utc
                )
            except ValueError:
                continue
    return datetime.now(timezone.utc)


class CencCollector(BaseCollector):
    name = "cenc"
    timeout = 25.0

    def fetch(self) -> Any:
        return self.http_get(URL, headers=HEADERS).json()

    def normalize(self, raw: Any) -> list[NormalizedEvent]:
        if not isinstance(raw, dict):
            return []
        out: list[NormalizedEvent] = []
        for key, it in raw.items():
            if not str(key).startswith("No") or not isinstance(it, dict):
                continue
            try:
                lat = float(it.get("latitude"))
                lon = float(it.get("longitude"))
                mag = float(it.get("magnitude"))
            except (TypeError, ValueError):
                continue
            if mag < 3.0:
                continue
            if not (-90 <= lat <= 90 and -180 <= lon <= 180):
                continue
            eid = str(it.get("EventID") or f"{it.get('time')}|{lat}|{lon}|{mag}")
            place = str(it.get("placeName") or it.get("location") or "").strip()
            depth = None
            try:
                if it.get("depth") is not None:
                    depth = float(it.get("depth"))
            except (TypeError, ValueError):
                depth = None
            out.append(
                NormalizedEvent(
                    source=self.name,
                    source_event_id=eid,
                    category="natural",
                    type="earthquake",
                    lat=lat,
                    lon=lon,
                    occurred_at=_parse_cn_time(it.get("time")),
                    headline=place or f"中国地震台网 M{mag:.1f}",
                    magnitude_value=mag,
                    magnitude_unit="M",
                    confidence=1.0,
                    metrics={
                        "depth_km": depth,
                        "cenc_type": it.get("type"),
                        "cenc_mirror": "wolfx",
                    },
                    raw=it,
                )
            )
        return out
