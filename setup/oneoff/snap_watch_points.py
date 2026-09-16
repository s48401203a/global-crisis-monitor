"""把不在河道格点上的洪水关注点吸附到附近径流最大的 GloFAS 格点（±0.1°，步长 0.05°）。

用法（仓库根）：
  cd app && PYTHONUTF8=1 .venv/bin/python ../setup/oneoff/snap_watch_points.py --dry-run
  cd app && PYTHONUTF8=1 .venv/bin/python ../setup/oneoff/snap_watch_points.py --apply [--all]
默认只处理 90 天中位数 < 20 m³/s 的点；--all 处理全部启用点。
吸附后清空该点旧样本，下次采集回填。
"""
from __future__ import annotations

import argparse
import statistics
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "app"))

from sqlalchemy import text  # noqa: E402

from app.db import get_session  # noqa: E402
from app.net import make_client  # noqa: E402

URL = "https://flood-api.open-meteo.com/v1/flood"
STEP = 0.05
RADIUS = 0.10
MIN_OK = 20.0


def median_discharge(c, lat: float, lon: float) -> float | None:
    r = c.get(URL, params={"latitude": lat, "longitude": lon, "daily": "river_discharge",
                           "past_days": 60, "forecast_days": 1})
    r.raise_for_status()
    vals = [float(v) for v in (r.json().get("daily") or {}).get("river_discharge") or [] if v is not None]
    return statistics.median(vals) if vals else None


def main() -> int:
    ap = argparse.ArgumentParser()
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument("--dry-run", action="store_true")
    g.add_argument("--apply", action="store_true")
    ap.add_argument("--all", action="store_true")
    a = ap.parse_args()

    with get_session() as s:
        if a.all:
            pts = s.execute(text("SELECT id, name, lat, lon FROM watch_point WHERE enabled ORDER BY id")).fetchall()
        else:
            pts = s.execute(text("""
                SELECT p.id, p.name, p.lat, p.lon FROM watch_point p
                  LEFT JOIN watch_sample w ON w.point_id = p.id AND w.day >= CURRENT_DATE - 90
                 WHERE p.enabled
                 GROUP BY p.id, p.name, p.lat, p.lon
                HAVING count(w.day) < 14
                    OR percentile_cont(0.5) WITHIN GROUP (ORDER BY w.discharge) < :m
                 ORDER BY p.id
            """), {"m": MIN_OK}).fetchall()
    print(f"candidates: {len(pts)}")
    offsets = [round(i * STEP, 2) for i in range(-int(RADIUS / STEP), int(RADIUS / STEP) + 1)]
    moves = []
    with make_client(timeout=40) as c:
        for p in pts:
            best = (None, None, -1.0)
            for dlat in offsets:
                for dlon in offsets:
                    lat, lon = round(p.lat + dlat, 3), round(p.lon + dlon, 3)
                    try:
                        m = median_discharge(c, lat, lon)
                    except Exception as e:
                        print(f"  {p.name} @{lat},{lon} err {e!r}")
                        continue
                    if m is not None and m > best[2]:
                        best = (lat, lon, m)
                    time.sleep(0.05)
            lat, lon, m = best
            ok = m is not None and m >= MIN_OK
            print(f"{'OK ' if ok else 'LOW'} {p.name:<22} ({p.lat},{p.lon}) -> ({lat},{lon}) median={m:.1f}")
            if ok and (abs(lat - p.lat) > 1e-6 or abs(lon - p.lon) > 1e-6):
                moves.append((p.id, lat, lon, m))
    print(f"moves: {len(moves)}")
    if a.dry_run:
        return 0
    with get_session() as s:
        for pid, lat, lon, m in moves:
            s.execute(text("UPDATE watch_point SET lat=:lat, lon=:lon, baseline_discharge=NULL WHERE id=:id"),
                      {"lat": lat, "lon": lon, "id": pid})
            s.execute(text("DELETE FROM watch_sample WHERE point_id=:id"), {"id": pid})
    print("applied")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
