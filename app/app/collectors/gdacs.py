# D:\crisis\app\app\collectors\gdacs.py
# 主干总线:地震/台风/洪水/火山/干旱/野火(见规格 5.2)
from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Any

from .base import BaseCollector
from ..core.schemas import NormalizedEvent

URL = "https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH"

EVENTTYPE_MAP = {
    "EQ": "earthquake",
    "TC": "cyclone",
    "FL": "flood",
    "VO": "volcano",
    "DR": "drought",
    "WF": "wildfire",
}

# Green|Orange|Red → severity 辅助量(metrics),正式 severity 由 severity.py 计算
ALERT_SCORE = {"Green": 0.25, "Orange": 0.65, "Red": 0.95}

_TAG_RE = re.compile(r"<[^>]+>")


def _strip_html(s: str) -> str:
    return _TAG_RE.sub("", s or "").strip()


class GdacsCollector(BaseCollector):
    name = "gdacs"

    def fetch(self) -> Any:
        return self.http_get(URL).json()

    def normalize(self, raw: Any) -> list[NormalizedEvent]:
        out: list[NormalizedEvent] = []
        for f in raw.get("features", []):
            p = f.get("properties") or {}
            geom = f.get("geometry") or {}
            coords = geom.get("coordinates") or []
            if len(coords) < 2:
                continue

            etype = EVENTTYPE_MAP.get(str(p.get("eventtype") or "").upper())
            if not etype:
                continue

            event_id = p.get("eventid")
            if event_id is None:
                continue

            # severitydata.severity 可能是震级等物理量
            sevdata = p.get("severitydata") or {}
            mag = sevdata.get("severity")
            mag_unit = sevdata.get("severityunit") or None
            try:
                mag_f = float(mag) if mag is not None else None
            except (TypeError, ValueError):
                mag_f = None

            occurred = self._parse_dt(p.get("fromdate") or p.get("todate"))
            alert = (p.get("alertlevel") or "Green").title()
            headline = _strip_html(p.get("htmldescription") or "")
            if not headline:
                country = p.get("country") or ""
                headline = f"GDACS {p.get('eventtype')} {country}".strip()

            metrics: dict[str, Any] = {
                "gdacs_alert": alert,
                "gdacs_alertscore": ALERT_SCORE.get(alert, 0.3),
                "country": p.get("country"),
                "episodeid": p.get("episodeid"),
            }
            # 地震:severity 通常为震级 M
            if etype == "earthquake" and mag_f is not None:
                magnitude_unit = "M"
            elif mag_unit:
                magnitude_unit = str(mag_unit)
            else:
                magnitude_unit = None

            out.append(NormalizedEvent(
                source=self.name,
                source_event_id=str(event_id),
                category="natural",
                type=etype,
                lat=float(coords[1]),
                lon=float(coords[0]),
                occurred_at=occurred,
                headline=headline[:500],
                magnitude_value=mag_f,
                magnitude_unit=magnitude_unit,
                metrics=metrics,
                raw=f,
            ))
        return out

    @staticmethod
    def _parse_dt(v: str | None) -> datetime:
        """解析为 aware UTC。无时区字面量一律按 UTC，避免 TIMESTAMPTZ 误绑会话/本机时区（REV-05）。"""
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
