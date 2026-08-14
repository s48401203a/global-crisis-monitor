"""中央气象台全国气象灾害预警（公开接口，无需密钥）。"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from zoneinfo import ZoneInfo

from .base import BaseCollector
from ..core.schemas import NormalizedEvent

URL = "https://weather.cma.cn/api/map/alarm"
TZ_CN = ZoneInfo("Asia/Shanghai")

LEVEL_SCORE = {"红": 0.92, "橙": 0.75, "黄": 0.55, "蓝": 0.35}
LEVEL_MAG = {"红": 4.0, "橙": 3.0, "黄": 2.0, "蓝": 1.0}

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
    ),
    "Referer": "https://weather.cma.cn/web/alarm/map.html",
    "Accept": "application/json,text/plain,*/*",
}


def classify_cma_text(text: str) -> str | None:
    """只根据标题/信号名分类，不用描述（雷电说明里常有「短时强降水」）。"""
    t = text or ""
    if any(k in t for k in ("台风", "热带风暴", "热带低压", "风暴潮")):
        return "cyclone"
    if any(k in t for k in ("山洪", "洪水")):
        return "flood"
    if any(k in t for k in ("暴雨", "强降雨", "地质灾害")):
        return "rainstorm"
    if any(k in t for k in ("森林火", "草原火")):
        return "wildfire"
    if "干旱" in t:
        return "drought"
    return None


def parse_level(text: str) -> str | None:
    """只认「红色预警」这类信号名，避免「黄山市」「红河州」地名误判。"""
    t = text or ""
    for lv, keys in (
        ("红", ("红色预警", "红预警")),
        ("橙", ("橙色预警", "橙预警")),
        ("黄", ("黄色预警", "黄预警")),
        ("蓝", ("蓝色预警", "蓝预警")),
    ):
        if any(k in t for k in keys):
            return lv
    return None


def parse_effective(raw: str | None) -> datetime:
    if raw:
        for fmt in ("%Y/%m/%d %H:%M", "%Y-%m-%d %H:%M", "%Y/%m/%d %H:%M:%S"):
            try:
                return datetime.strptime(raw.strip(), fmt).replace(tzinfo=TZ_CN).astimezone(
                    timezone.utc
                )
            except ValueError:
                continue
    return datetime.now(timezone.utc)


class CmaAlertCollector(BaseCollector):
    name = "cma"
    timeout = 35.0

    def fetch(self) -> Any:
        return self.http_get(URL, headers=HEADERS).json()

    def normalize(self, raw: Any) -> list[NormalizedEvent]:
        items = (raw or {}).get("data") if isinstance(raw, dict) else None
        if not isinstance(items, list):
            return []
        out: list[NormalizedEvent] = []
        for it in items:
            if not isinstance(it, dict):
                continue
            title = str(it.get("title") or "")
            headline = str(it.get("headline") or title)
            blob = f"{title} {headline}"
            etype = classify_cma_text(blob)
            if not etype:
                continue
            try:
                lat = float(it.get("latitude"))
                lon = float(it.get("longitude"))
            except (TypeError, ValueError):
                continue
            if not (-90 <= lat <= 90 and -180 <= lon <= 180):
                continue
            aid = str(it.get("id") or "").strip()
            if not aid:
                continue
            level = parse_level(blob)
            # 蓝/黄日常预警太多，只保留橙、红
            if level not in ("橙", "红"):
                continue
            score = LEVEL_SCORE.get(level or "", 0.45)
            mag = LEVEL_MAG.get(level or "", 2.0)
            out.append(
                NormalizedEvent(
                    source=self.name,
                    source_event_id=aid,
                    category="natural",
                    type=etype,
                    lat=lat,
                    lon=lon,
                    occurred_at=parse_effective(it.get("effective")),
                    headline=title or headline,
                    magnitude_value=mag,
                    magnitude_unit="alert",
                    confidence=1.0,
                    metrics={
                        "cma_type": it.get("type"),
                        "cma_level": level,
                        "cma_alertscore": score,
                        "cma_headline": headline,
                    },
                    raw=it,
                )
            )
        return out
