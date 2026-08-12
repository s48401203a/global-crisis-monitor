# D:\crisis\app\app\collectors\firms.py
# NASA FIRMS 近实时火点 —— 需 MAP_KEY,默认关闭(规格 5.5 / 12.3)
from __future__ import annotations

import csv
import io
import logging
from datetime import datetime, timezone
from typing import Any

from .base import BaseCollector
from ..config import settings
from ..core.schemas import NormalizedEvent

log = logging.getLogger(__name__)
# 近 24h 全球 VIIRS 摘要(需 key);无 key 时 collector 直接空跑
URL = (
    "https://firms.modaps.eosdis.nasa.gov/api/area/csv/"
    "{key}/VIIRS_SNPP_NRT/world/1"
)


class FirmsCollector(BaseCollector):
    name = "firms"

    def fetch(self) -> Any:
        key = (settings.firms_map_key or "").strip()
        if not key:
            log.warning("[firms] ENABLE_FIRMS=true 但未配置 FIRMS_MAP_KEY,跳过")
            return ""
        url = URL.format(key=key)
        return self.http_get(url).text

    def normalize(self, raw: Any) -> list[NormalizedEvent]:
        if not raw or not isinstance(raw, str):
            return []
        text = raw.strip()
        if not text or text.lower().startswith("<!doctype") or "Invalid" in text[:200]:
            log.warning("[firms] 响应无效")
            return []

        reader = csv.DictReader(io.StringIO(text))
        out: list[NormalizedEvent] = []
        for i, row in enumerate(reader):
            if i >= 500:  # 防爆量,演示系统限流
                break
            try:
                lat = float(row.get("latitude") or row.get("Lat") or "")
                lon = float(row.get("longitude") or row.get("Lon") or "")
            except ValueError:
                continue
            bright = row.get("bright_ti4") or row.get("brightness")
            try:
                mag = float(bright) if bright not in (None, "") else None
            except ValueError:
                mag = None
            acq = (row.get("acq_date") or "") + "T" + (row.get("acq_time") or "0000")
            try:
                # acq_time 常为 HHMM
                if len(acq) >= 13 and acq[11:].isdigit():
                    hhmm = acq[11:15]
                    occurred = datetime(
                        int(acq[0:4]), int(acq[5:7]), int(acq[8:10]),
                        int(hhmm[0:2]), int(hhmm[2:4]),
                        tzinfo=timezone.utc,
                    )
                else:
                    occurred = datetime.now(timezone.utc)
            except Exception:
                occurred = datetime.now(timezone.utc)

            sid = f"{lat:.3f},{lon:.3f}:{row.get('acq_date')}:{row.get('acq_time')}"
            out.append(NormalizedEvent(
                source=self.name,
                source_event_id=sid,
                category="natural",
                type="wildfire",
                lat=lat, lon=lon,
                occurred_at=occurred,
                headline=f"FIRMS 火点 {lat:.2f},{lon:.2f}",
                magnitude_value=mag,
                magnitude_unit="K",
                metrics={"frp": row.get("frp"), "confidence": row.get("confidence")},
                raw=dict(row),
            ))
        return out
