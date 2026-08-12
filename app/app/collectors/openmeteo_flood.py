# D:\crisis\app\app\collectors\openmeteo_flood.py
# 按 watch_point 采样 GloFAS 径流量,超基线倍数时生成 flood 事件(规格 5.6)
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import text

from .base import BaseCollector
from ..core.schemas import NormalizedEvent
from ..db import get_session

log = logging.getLogger(__name__)
URL = "https://flood-api.open-meteo.com/v1/flood"


class OpenMeteoFloodCollector(BaseCollector):
    name = "openmeteo"

    def fetch(self) -> Any:
        """拉取所有启用关注点的当前预报(非事件列表)。"""
        with get_session() as s:
            points = s.execute(text("""
                SELECT id, name, lat, lon, baseline_discharge, trigger_ratio
                  FROM watch_point WHERE enabled
            """)).fetchall()

        samples: list[dict] = []
        for p in points:
            try:
                r = self.http_get(URL, params={
                    "latitude": p.lat,
                    "longitude": p.lon,
                    "daily": "river_discharge,river_discharge_mean",
                    "forecast_days": 7,
                }).json()
                daily = r.get("daily") or {}
                discharges = daily.get("river_discharge") or []
                means = daily.get("river_discharge_mean") or []
                # 取预报窗口内最大日径流量
                vals = [float(x) for x in discharges if x is not None]
                peak = max(vals) if vals else None
                mean_vals = [float(x) for x in means if x is not None]
                mean_peak = max(mean_vals) if mean_vals else None
                samples.append({
                    "id": p.id,
                    "name": p.name,
                    "lat": float(p.lat),
                    "lon": float(p.lon),
                    "baseline": p.baseline_discharge,
                    "trigger_ratio": float(p.trigger_ratio or 2.0),
                    "peak_discharge": peak,
                    "mean_peak": mean_peak,
                    "raw": r,
                })
            except Exception as e:
                log.warning("[openmeteo] 点 %s 采样失败: %r", p.name, e)
        return samples

    def normalize(self, raw: Any) -> list[NormalizedEvent]:
        out: list[NormalizedEvent] = []
        now = datetime.now(timezone.utc)

        with get_session() as s:
            for sample in raw or []:
                peak = sample.get("peak_discharge")
                if peak is None:
                    continue

                baseline = sample.get("baseline")
                # 首次采样回填基线,不触发事件
                if baseline is None or baseline <= 0:
                    s.execute(text("""
                        UPDATE watch_point
                           SET baseline_discharge = :b
                         WHERE id = :id
                    """), {"b": float(peak), "id": sample["id"]})
                    continue

                ratio = float(peak) / float(baseline)
                trigger = float(sample.get("trigger_ratio") or 2.0)
                if ratio < trigger:
                    continue

                out.append(NormalizedEvent(
                    source=self.name,
                    source_event_id=f"wp{sample['id']}:{now:%Y%m%d}",
                    category="natural",
                    type="flood",
                    lat=sample["lat"],
                    lon=sample["lon"],
                    occurred_at=now,
                    headline=(
                        f"洪水关注点 {sample['name']}: "
                        f"径流量 {peak:.1f} m³/s "
                        f"(基线 {baseline:.1f} ×{ratio:.1f})"
                    ),
                    magnitude_value=float(peak),
                    magnitude_unit="m3/s",
                    metrics={
                        "baseline_discharge": float(baseline),
                        "trigger_ratio": trigger,
                        "ratio": round(ratio, 3),
                        "watch_point_id": sample["id"],
                        "mean_peak": sample.get("mean_peak"),
                    },
                    raw=sample.get("raw") or sample,
                ))
        return out
