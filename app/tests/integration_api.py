"""API v2 合同测试（需要本机 crisis 库，通过 TestClient 直连 app，不启动调度器）：
  cd app && PYTHONUTF8=1 .venv/bin/python -m tests.integration_api
"""
from __future__ import annotations

import sys
import warnings

warnings.filterwarnings("ignore")

from urllib.parse import quote  # noqa: E402

from fastapi.testclient import TestClient  # noqa: E402

import app.main as m  # noqa: E402

# 不触发 lifespan（不启动 APScheduler / EMSC）
client = TestClient(m.app)
fails = 0


def check(name, cond, extra=""):
    global fails
    print(("OK  " if cond else "FAIL"), name, extra)
    if not cond:
        fails += 1


def main() -> int:
    r = client.get("/api/events?hours=8760&limit=5000&fields=summary")
    check("events summary 200", r.status_code == 200)
    j = r.json()
    check("events has meta.server_time", "meta" in j and "server_time" in j["meta"])
    full = client.get("/api/events?hours=8760&limit=5000&fields=full")
    gz = client.get("/api/events?hours=8760&limit=5000&fields=summary", headers={"Accept-Encoding": "gzip"})
    wire = gz.num_bytes_downloaded
    check("gzip applied", gz.headers.get("content-encoding") == "gzip")
    check("summary on-wire (gzip) <= 600KB", wire <= 600 * 1024,
          f"wire={wire} raw_summary={len(r.content)} raw_full={len(full.content)}")
    check("summary smaller than full", len(r.content) < len(full.content))
    f0 = j["features"][0]["properties"] if j["features"] else {}
    check("feature has grade{band,tone,zh,en}", all(k in f0.get("grade", {}) for k in ("band", "tone", "zh", "en")))
    check("feature has updated_at & is_aggregate", "updated_at" in f0 and "is_aggregate" in f0)
    check("summary drops raw-ish metrics", all("samples" not in (f["properties"].get("metrics") or {}) for f in j["features"]))

    etag = r.headers.get("etag")
    check("ETag present", bool(etag))
    r2 = client.get("/api/events?hours=8760&limit=5000&fields=summary", headers={"If-None-Match": etag or ""})
    check("If-None-Match → 304", r2.status_code == 304, str(r2.status_code))

    st = j["meta"]["server_time"]
    check("server_time is UTC Z", st.endswith("Z"), st)
    inc = client.get(f"/api/events?hours=8760&since={quote(st)}&fields=summary")
    check("since incremental 200 with 0 or few rows", inc.status_code == 200 and inc.json()["meta"]["count"] <= 50, str(inc.json()["meta"]["count"]))

    bb = client.get("/api/events?hours=8760&bbox=73,18,135,54&fields=summary&limit=5000")
    inside = all(73 <= f["geometry"]["coordinates"][0] <= 135 and 18 <= f["geometry"]["coordinates"][1] <= 54 for f in bb.json()["features"])
    check("bbox filters geometry", bb.status_code == 200 and inside, str(bb.json()["meta"]["count"]))
    bad = client.get("/api/events?bbox=1,2,3")
    check("bad bbox → 400", bad.status_code == 400)

    ty = client.get("/api/events?hours=8760&types=earthquake,flood&fields=summary&limit=5000")
    check("types filter", ty.status_code == 200 and all(f["properties"]["type"] in ("earthquake", "flood") for f in ty.json()["features"]))
    cy = client.get("/api/events?hours=8760&types=cyclone&fields=summary&limit=100")
    check("summary keeps cyclone footprint", cy.status_code == 200 and all("footprint" in f["properties"] for f in cy.json()["features"]))

    if j["features"]:
        eid = j["features"][0]["properties"]["id"]
        d = client.get(f"/api/events/{eid}")
        check("detail 200 with observations/alerts", d.status_code == 200 and "observations" in d.json() and "alerts" in d.json())
    check("detail 404", client.get("/api/events/999999999").status_code == 404)

    a = client.get("/api/alerts?limit=5")
    check("alerts list", a.status_code == 200 and isinstance(a.json()["alerts"], list) and all("grade" in x for x in a.json()["alerts"]))
    s_ = client.get("/api/stats?hours=8760")
    sj = s_.json()
    check("stats totals split events/aggregates", s_.status_code == 200 and "aggregates" in sj["totals"] and "conflict_signals" in sj["totals"])
    check("stats by_type present", isinstance(sj["by_type"], list) and len(sj["by_type"]) > 0)
    me = client.get("/api/meta")
    check("meta types/sources/ws", me.status_code == 200 and {"types", "sources", "ws"} <= set(me.json()))
    th = client.get("/api/theaters")
    check("theaters 12", th.status_code == 200 and len(th.json()["features"]) == 12)
    h = client.get("/api/health")
    check("health pipeline_status", h.status_code == 200 and "pipeline_status" in h.json())
    # 旧参数兼容
    old = client.get("/api/events?hours=24&limit=100")
    check("v1-style call still works (defaults to full)", old.status_code == 200 and "features" in old.json())

    print(f"{'PASS' if not fails else 'FAIL'}: {fails} failures")
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
