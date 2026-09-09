# NASA FIRMS 近实时火点 —— 需 MAP_KEY，默认关闭
# 按 watch_region 的 bbox 查询（而非全球），1 km 网格聚类为火点簇，severity 用 FRP 分档
from __future__ import annotations

import csv
import io
import logging
import math
from collections import defaultdict
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import text

from .base import BaseCollector
from ..config import settings
from ..core.schemas import NormalizedEvent
from ..db import get_session

log = logging.getLogger(__name__)
# /api/area/csv/{MAP_KEY}/{SOURCE}/{west,south,east,north}/{DAY_RANGE}
# 官方文档（2026-09 核实）：AREA 为 west,south,east,north 或 world；DAY_RANGE 1..5；
# MAP_KEY 限 5000 次事务 / 10 分钟
URL = "https://firms.modaps.eosdis.nasa.gov/api/area/csv/{key}/{source}/{bbox}/{days}"
DEFAULT_SOURCE = "VIIRS_SNPP_NRT"
GRID_KM = 1.0          # 聚类网格
MIN_PIXELS = 2         # 单像元不成簇（噪声）
MAX_CLUSTERS = 400     # 每轮上限


def _grid_key(lat: float, lon: float, km: float = GRID_KM) -> tuple[int, int]:
    dlat = km / 111.0
    dlon = km / max(1e-6, 111.0 * math.cos(math.radians(lat)))
    return int(math.floor(lat / dlat)), int(math.floor(lon / dlon))


def _parse_acq(row: dict) -> datetime:
    d = (row.get("acq_date") or "").strip()
    t = (row.get("acq_time") or "0000").strip().zfill(4)
    try:
        return datetime(int(d[0:4]), int(d[5:7]), int(d[8:10]), int(t[0:2]), int(t[2:4]),
                        tzinfo=timezone.utc)
    except Exception:
        return datetime.now(timezone.utc)


def cluster_pixels(rows: list[dict], grid_km: float = GRID_KM,
                   min_pixels: int = MIN_PIXELS) -> list[dict]:
    """像元 → 网格簇。返回 [{lat, lon, n, frp_sum, frp_max, latest, conf_hi, bright_max}]。"""
    cells: dict[tuple[int, int], list[dict]] = defaultdict(list)
    for r in rows:
        try:
            lat = float(r.get("latitude") or r.get("Lat") or "")
            lon = float(r.get("longitude") or r.get("Lon") or "")
        except ValueError:
            continue
        if not (-90 <= lat <= 90 and -180 <= lon <= 180):
            continue
        try:
            frp = float(r.get("frp") or 0.0)
        except ValueError:
            frp = 0.0
        try:
            bright = float(r.get("bright_ti4") or r.get("brightness") or 0.0)
        except ValueError:
            bright = 0.0
        conf = str(r.get("confidence") or "").lower()
        cells[_grid_key(lat, lon, grid_km)].append({
            "lat": lat, "lon": lon, "frp": frp, "bright": bright,
            "conf_hi": conf in ("h", "high") or (conf.isdigit() and int(conf) >= 80),
            "t": _parse_acq(r),
        })
    out: list[dict] = []
    for key, px in cells.items():
        if len(px) < min_pixels:
            continue
        n = len(px)
        out.append({
            "key": key,
            "lat": sum(p["lat"] for p in px) / n,
            "lon": sum(p["lon"] for p in px) / n,
            "n": n,
            "frp_sum": round(sum(p["frp"] for p in px), 1),
            "frp_max": round(max(p["frp"] for p in px), 1),
            "bright_max": round(max(p["bright"] for p in px), 1),
            "conf_hi": sum(1 for p in px if p["conf_hi"]),
            "latest": max(p["t"] for p in px),
        })
    out.sort(key=lambda c: c["frp_sum"], reverse=True)
    return out


class FirmsCollector(BaseCollector):
    name = "firms"
    timeout = 60.0

    def _bboxes(self) -> list[tuple[str, str]]:
        """关注区域 → (name, 'w,s,e,n')；无关注区域时不查询（避免全球下载）。"""
        with get_session() as s:
            rows = s.execute(text("""
                SELECT name, ST_XMin(geom::geometry), ST_YMin(geom::geometry),
                       ST_XMax(geom::geometry), ST_YMax(geom::geometry)
                  FROM watch_region WHERE enabled
            """)).fetchall()
        return [(r[0], f"{r[1]:.2f},{r[2]:.2f},{r[3]:.2f},{r[4]:.2f}") for r in rows]

    def fetch(self) -> Any:
        key = (settings.firms_map_key or "").strip()
        if not key:
            log.warning("[firms] ENABLE_FIRMS=true 但未配置 FIRMS_MAP_KEY,跳过")
            return []
        bboxes = self._bboxes()
        if not bboxes:
            log.warning("[firms] 无启用的 watch_region，跳过（不做全球拉取）")
            return []
        src = (getattr(settings, "firms_source", "") or DEFAULT_SOURCE).strip()
        out = []
        for name, bbox in bboxes:
            url = URL.format(key=key, source=src, bbox=bbox, days=1)
            txt = self.http_get(url).text
            out.append({"region": name, "csv": txt})
        return out

    def normalize(self, raw: Any) -> list[NormalizedEvent]:
        if not raw:
            return []
        rows: list[dict] = []
        for part in raw:
            txt = (part.get("csv") or "").strip()
            if not txt or txt.lower().startswith("<!doctype") or "Invalid" in txt[:200]:
                log.warning("[firms] 区域 %s 响应无效", part.get("region"))
                continue
            rows.extend(csv.DictReader(io.StringIO(txt)))
        clusters = cluster_pixels(rows)[:MAX_CLUSTERS]
        out: list[NormalizedEvent] = []
        for c in clusters:
            day = c["latest"].strftime("%Y%m%d")
            sid = f"cl:{c['key'][0]}:{c['key'][1]}:{day}"
            out.append(NormalizedEvent(
                source=self.name,
                source_event_id=sid,
                category="natural",
                type="wildfire",
                lat=c["lat"], lon=c["lon"],
                occurred_at=c["latest"],
                headline=f"FIRMS 火点簇 {c['n']} 像元 · FRP {c['frp_sum']:.0f} MW",
                magnitude_value=float(c["frp_sum"]),
                magnitude_unit="MW",
                metrics={
                    "pixels": c["n"], "frp_sum": c["frp_sum"], "frp_max": c["frp_max"],
                    "bright_max": c["bright_max"], "conf_hi": c["conf_hi"],
                    "grid_km": GRID_KM, "firms_source": DEFAULT_SOURCE,
                },
                raw={"cluster": {k: (v.isoformat() if hasattr(v, "isoformat") else v)
                                 for k, v in c.items()}},
            ))
        return out
