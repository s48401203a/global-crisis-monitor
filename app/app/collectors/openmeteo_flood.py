# 按 watch_point 采样 GloFAS 径流量；基线 = 近 90 天逐日样本中位数（watch_sample）
# 触发：7 天预报峰值 / 基线 ≥ trigger_ratio，且样本 ≥ MIN_SAMPLES
from __future__ import annotations

import logging
import statistics
from datetime import date, datetime, timezone
from typing import Any

from sqlalchemy import text

from .base import BaseCollector
from ..core.schemas import NormalizedEvent
from ..db import get_session

log = logging.getLogger(__name__)
URL = "https://flood-api.open-meteo.com/v1/flood"
PAST_DAYS = 92          # Open-Meteo 支持 past_days，首采即可回填 3 个月
BASELINE_DAYS = 90
MIN_SAMPLES = 14
# GloFAS 网格点若不在河道上，径流会是涓流量级（<20 m³/s），此时 ratio 毫无意义。
# 基线低于此值的点标记 off_channel 并跳过触发；需要人工把坐标挪到河道格点。
MIN_BASELINE_M3S = 20.0


class OpenMeteoFloodCollector(BaseCollector):
    name = "openmeteo"
    timeout = 40.0

    def fetch(self) -> Any:
        """拉取所有启用关注点的 过去 92 天 + 未来 7 天 逐日径流。"""
        with get_session() as s:
            points = s.execute(text("""
                SELECT id, name, lat, lon, trigger_ratio
                  FROM watch_point WHERE enabled ORDER BY id
            """)).fetchall()

        samples: list[dict] = []
        for p in points:
            try:
                r = self.http_get(URL, params={
                    "latitude": p.lat,
                    "longitude": p.lon,
                    "daily": "river_discharge",
                    "past_days": PAST_DAYS,
                    "forecast_days": 7,
                }).json()
                daily = r.get("daily") or {}
                days = daily.get("time") or []
                vals = daily.get("river_discharge") or []
                series = [(d, float(v)) for d, v in zip(days, vals) if v is not None]
                samples.append({
                    "id": p.id, "name": p.name,
                    "lat": float(p.lat), "lon": float(p.lon),
                    "trigger_ratio": float(p.trigger_ratio or 2.0),
                    "series": series,
                    "raw": {"daily": daily, "elevation": r.get("elevation")},
                })
            except Exception as e:
                log.warning("[openmeteo] 点 %s 采样失败: %r", p.name, e)
        return samples

    def normalize(self, raw: Any) -> list[NormalizedEvent]:
        out: list[NormalizedEvent] = []
        now = datetime.now(timezone.utc)
        today = now.date()

        with get_session() as s:
            for sample in raw or []:
                series = sample.get("series") or []
                if not series:
                    continue
                past = [(d, v) for d, v in series if date.fromisoformat(d) <= today]
                future = [(d, v) for d, v in series if date.fromisoformat(d) > today]

                # 逐日样本入库（过去日期为再分析/近实时，今天及以后不入样本）
                if past:
                    s.execute(text("""
                        INSERT INTO watch_sample (point_id, day, discharge, kind)
                        VALUES (:pid, :day, :v, 'reanalysis')
                        ON CONFLICT (point_id, day) DO UPDATE
                           SET discharge = EXCLUDED.discharge, kind = EXCLUDED.kind
                    """), [{"pid": sample["id"], "day": d, "v": v} for d, v in past])

                baseline, n_samples = self._baseline(s, sample["id"])
                # 兼容旧字段：把中位数回填到 watch_point.baseline_discharge 供查看
                s.execute(text("""
                    UPDATE watch_point SET baseline_discharge = :b WHERE id = :id
                """), {"b": baseline, "id": sample["id"]})

                if baseline is None or n_samples < MIN_SAMPLES:
                    log.info("[openmeteo] %s 基线建立中 (%d/%d)", sample["name"], n_samples, MIN_SAMPLES)
                    continue
                if baseline <= 0:
                    continue
                if baseline < MIN_BASELINE_M3S:
                    log.warning("[openmeteo] %s 90 天中位数仅 %.2f m³/s，疑似网格点不在河道上，跳过触发",
                                sample["name"], baseline)
                    continue

                window = future or past[-1:]
                peak_day, peak = max(window, key=lambda x: x[1])
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
                        f"预报峰值 {peak:.1f} m³/s（{peak_day}）"
                        f"为 90 天中位数 {baseline:.1f} 的 {ratio:.1f} 倍"
                    ),
                    magnitude_value=float(peak),
                    magnitude_unit="m3/s",
                    metrics={
                        "baseline_discharge": round(float(baseline), 3),
                        "baseline_kind": "median_90d",
                        "baseline_samples": n_samples,
                        "trigger_ratio": trigger,
                        "ratio": round(ratio, 3),
                        "peak_day": peak_day,
                        "watch_point_id": sample["id"],
                    },
                    raw=sample.get("raw") or {},
                ))
        return out

    @staticmethod
    def _baseline(s, point_id: int) -> tuple[float | None, int]:
        rows = s.execute(text("""
            SELECT discharge FROM watch_sample
             WHERE point_id = :pid AND day >= CURRENT_DATE - :days
        """), {"pid": point_id, "days": BASELINE_DAYS}).fetchall()
        vals = [float(r[0]) for r in rows if r[0] is not None]
        if not vals:
            return None, 0
        return statistics.median(vals), len(vals)
