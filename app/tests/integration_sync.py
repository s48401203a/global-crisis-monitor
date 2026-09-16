"""增量分页 / 游标 / 对账 / 延迟提交（临时库）。"""
from __future__ import annotations

import sys
from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient
from sqlalchemy import text

from app.db import get_session
from tests.isolated_db import isolated_database

fails = 0


def check(name, cond, extra=""):
    global fails
    print(("OK  " if cond else "FAIL"), name, extra)
    if not cond:
        fails += 1


def _client(app):
    try:
        return TestClient(app, lifespan="off")
    except TypeError:
        return TestClient(app)


def _bulk(n: int, *, hours_ago: float = 1.0, prefix: str = "bulk") -> None:
    with get_session() as s:
        s.execute(text("""
            INSERT INTO event (category, type, severity, severity_peak, confidence, status,
                               centroid, occurred_at, headline, primary_source, metrics)
            SELECT 'natural', 'earthquake', 0.4, 0.4, 1, 'active',
                   ST_MakePoint(12.0, 34.0)::geography,
                   now() - (:h || ' hours')::interval,
                   :p || ' ' || g::text,
                   'ittest', '{}'::jsonb
              FROM generate_series(1, :n) g
        """), {"n": n, "h": str(hours_ago), "p": prefix})


def _fetch_all(client, hours=8760, limit=1000, since_seq=None):
    feats = []
    cursor = None
    pages = 0
    last_meta = None
    while True:
        pages += 1
        q = f"/api/events?hours={hours}&limit={limit}&fields=summary"
        if since_seq is not None:
            q += f"&since_seq={since_seq}"
        if cursor is not None:
            q += f"&cursor={cursor}"
        r = client.get(q)
        if r.status_code != 200:
            return [], {"error": r.status_code, "pages": pages}
        j = r.json()
        last_meta = j.get("meta") or {}
        feats.extend(j.get("features") or [])
        if not last_meta.get("truncated"):
            break
        nxt = last_meta.get("next_cursor")
        if nxt is None:
            last_meta = {**last_meta, "stuck": True}
            break
        cursor = nxt
        if pages > 80:
            last_meta = {**last_meta, "aborted": True}
            break
    return feats, last_meta | {"pages": pages}


def main() -> int:
    import app.main as m
    client = _client(m.app)
    with get_session() as s:
        s.execute(text("DELETE FROM alert"))
        s.execute(text("DELETE FROM observation"))
        s.execute(text("DELETE FROM event"))

    _bulk(5001, prefix="[IT-SYNC] p")
    feats, meta = _fetch_all(client, limit=1000)
    ids = [f["properties"]["id"] for f in feats]
    check("5001 snapshot via pages", len(ids) == 5001, f"count={len(ids)} pages={meta.get('pages')}")
    check("snapshot ids unique", len(set(ids)) == 5001, f"unique={len(set(ids))}")
    check("truncated pages then complete", meta.get("complete") is True and meta.get("truncated") is False)
    check("next_cursor empty when complete", meta.get("next_cursor") in (None, ""))

    # 截断页不得当作完整水位：只取第一页
    first = client.get("/api/events?hours=8760&limit=1000&fields=summary")
    jm = first.json()["meta"]
    check("first page truncated", jm.get("truncated") is True and jm.get("next_cursor") is not None)
    check("truncated not complete", jm.get("complete") is False)

    # 相同时间戳多行仍可按 change_seq 分页
    with get_session() as s:
        before_seq = s.execute(text("SELECT COALESCE(MAX(change_seq),0) FROM event")).scalar()
        ts = datetime.now(timezone.utc) - timedelta(minutes=30)
        for i in range(25):
            s.execute(text("""
                INSERT INTO event (category, type, severity, severity_peak, confidence, status,
                                   centroid, occurred_at, updated_at, headline, primary_source, metrics)
                VALUES ('natural','earthquake',0.3,0.3,1,'active',
                        ST_MakePoint(1,1)::geography, :ts, :ts, :h, 'ittest', '{}'::jsonb)
            """), {"ts": ts, "h": f"[IT-SYNC] same-ts {i}"})
    same, smeta = _fetch_all(client, limit=10, since_seq=int(before_seq or 0))
    same_ids = [f["properties"]["id"] for f in same if (f["properties"].get("headline") or "").startswith("[IT-SYNC] same-ts")]
    check("same timestamp 25 rows all returned", len(same_ids) == 25, f"count={len(same_ids)} pages={smeta.get('pages')}")

    # 删除通知：即使 occurred_at 在窗口外
    with get_session() as s:
        eid = s.execute(text(
            "SELECT id FROM event WHERE headline LIKE '[IT-SYNC] p%' ORDER BY id LIMIT 1"
        )).scalar()
        s.execute(text("""
            UPDATE event SET status='deleted', occurred_at = now() - interval '400 days',
                   updated_at = clock_timestamp(), change_seq = nextval('event_change_seq')
             WHERE id = :e
        """), {"e": eid})
    # 用较小 since_seq 拉增量
    with get_session() as s:
        seq = s.execute(text("SELECT change_seq FROM event WHERE id=:e"), {"e": eid}).scalar()
    ch = client.get(f"/api/events?hours=24&since_seq={int(seq)-1}&fields=summary&limit=50")
    statuses = {f["properties"]["id"]: f["properties"]["status"] for f in ch.json()["features"]}
    check("deleted outside window still in changes", statuses.get(eid) == "deleted", str(statuses.get(eid)))

    rec = client.get("/api/events/reconcile?hours=8760")
    check("reconcile 200", rec.status_code == 200)
    rj = rec.json()
    check("reconcile omits deleted", eid not in set(rj.get("ids") or []))
    check("reconcile has high_water", int(rj.get("high_water") or 0) > 0)
    check("reconcile versions list", isinstance(rj.get("versions"), list) and len(rj["versions"]) > 0)

    # ID 不变但内容变：versions.change_seq 必须上升，ids 补拉返回新内容
    with get_session() as s:
        row = s.execute(text("""
            SELECT id, change_seq FROM event
             WHERE headline LIKE '[IT-SYNC] p%' AND status = 'active'
             ORDER BY id LIMIT 1
        """)).fetchone()
        eid_u, seq_u = int(row[0]), int(row[1])
        s.execute(text("""
            UPDATE event SET severity = 0.91,
                   change_seq = nextval('event_change_seq'),
                   updated_at = clock_timestamp()
             WHERE id = :e
        """), {"e": eid_u})
        eid_c = s.execute(text("""
            SELECT id FROM event
             WHERE headline LIKE '[IT-SYNC] p%' AND status = 'active' AND id <> :e
             ORDER BY id DESC LIMIT 1
        """), {"e": eid_u}).scalar()
        s.execute(text("""
            UPDATE event SET status = 'closed', closed_at = now(),
                   change_seq = nextval('event_change_seq'),
                   updated_at = clock_timestamp()
             WHERE id = :e
        """), {"e": eid_c})
    rec_v = client.get("/api/events/reconcile?hours=8760").json()
    by_v = {int(v["id"]): v for v in rec_v.get("versions") or []}
    check("content edit bumps version seq", eid_u in by_v and by_v[eid_u]["change_seq"] > seq_u,
          str(by_v.get(eid_u)))
    check("closed status in versions", eid_c in by_v and by_v[eid_c]["status"] == "closed",
          str(by_v.get(eid_c)))
    check("closed_ids contains closed event", eid_c in set(rec_v.get("closed_ids") or []))
    pulled = client.get(f"/api/events?ids={eid_u},{eid_c}&fields=summary&limit=10").json()
    props = {f["properties"]["id"]: f["properties"] for f in pulled.get("features") or []}
    check("ids refetch updated severity", abs(float(props.get(eid_u, {}).get("severity") or 0) - 0.91) < 1e-6,
          str(props.get(eid_u)))
    check("ids refetch includes closed", (props.get(eid_c) or {}).get("status") == "closed",
          str(props.get(eid_c)))

    # 延迟提交：先看到 B，A 后提交则增量可能漏，对账必须补上
    engine_mod = __import__("app.db", fromlist=["engine"])
    conn_a = engine_mod.engine.connect()
    trans_a = conn_a.begin()
    try:
        conn_a.execute(text("""
            INSERT INTO event (category, type, severity, severity_peak, confidence, status,
                               centroid, occurred_at, headline, primary_source, metrics)
            VALUES ('natural','earthquake',0.5,0.5,1,'active',
                    ST_MakePoint(2,2)::geography, now(), '[IT-SYNC] delayed-A', 'ittest', '{}'::jsonb)
        """))
        with get_session() as s:
            s.execute(text("""
                INSERT INTO event (category, type, severity, severity_peak, confidence, status,
                                   centroid, occurred_at, headline, primary_source, metrics)
                VALUES ('natural','earthquake',0.5,0.5,1,'active',
                        ST_MakePoint(3,3)::geography, now(), '[IT-SYNC] delayed-B', 'ittest', '{}'::jsonb)
            """))
        with get_session() as s:
            seq_b = s.execute(text("SELECT change_seq FROM event WHERE headline='[IT-SYNC] delayed-B'")).scalar()
        inc = client.get(f"/api/events?hours=8760&since_seq={int(seq_b)-1}&fields=summary")
        heads = [f["properties"]["headline"] for f in inc.json()["features"]]
        check("visible committed B in incremental", "[IT-SYNC] delayed-B" in heads)
        check("uncommitted A not visible yet", "[IT-SYNC] delayed-A" not in heads)
        trans_a.commit()
    except Exception:
        trans_a.rollback()
        raise
    finally:
        conn_a.close()

    inc2 = client.get(f"/api/events?hours=8760&since_seq={int(seq_b)}&fields=summary")
    heads2 = [f["properties"]["headline"] for f in inc2.json()["features"]]
    rec2 = client.get("/api/events/reconcile?hours=8760").json()
    with get_session() as s:
        id_a = s.execute(text("SELECT id FROM event WHERE headline='[IT-SYNC] delayed-A'")).scalar()
    caught_by_inc = "[IT-SYNC] delayed-A" in heads2
    caught_by_rec = id_a in set(rec2.get("ids") or [])
    check("delayed A caught by incremental or reconcile", caught_by_inc or caught_by_rec,
          f"inc={caught_by_inc} rec={caught_by_rec}")
    if not caught_by_inc:
        print("  note: delayed commit missed by since_seq (expected); reconcile is the safety net")

    # 重复通知幂等：同一页拉两次
    p1 = client.get("/api/events?hours=24&limit=20&fields=summary").json()
    p2 = client.get("/api/events?hours=24&limit=20&fields=summary").json()
    check("repeat snapshot same count", p1["meta"]["count"] == p2["meta"]["count"])

    print(f"{'PASS' if not fails else 'FAIL'}: {fails} failures")
    return 1 if fails else 0


if __name__ == "__main__":
    with isolated_database():
        sys.exit(main())
