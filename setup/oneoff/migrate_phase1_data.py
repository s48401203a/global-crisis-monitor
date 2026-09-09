"""Phase 1 一次性数据修正（先 pg_dump！）。

1. GDELT 15 分钟槽行（type=war, primary_source=gdelt）→ 合并为「国家 × UTC 日」armed_clash 聚合行
2. 编辑战区热点行（primary_source=war）→ 从 event 删除（已迁入 theater 表）
3. 清理受影响的 alert_mute / alert（级联）

用法（仓库根）：
  cd app && PYTHONUTF8=1 .venv/bin/python ../setup/oneoff/migrate_phase1_data.py --dry-run
  cd app && PYTHONUTF8=1 .venv/bin/python ../setup/oneoff/migrate_phase1_data.py --apply
"""
from __future__ import annotations

import argparse
import json
import sys
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "app"))

from sqlalchemy import text  # noqa: E402

from app.db import get_session  # noqa: E402
from app.core.severity import compute_severity  # noqa: E402
from app.core.schemas import NormalizedEvent  # noqa: E402


def plan(s):
    rows = s.execute(text("""
        SELECT e.id, e.metrics, e.occurred_at, e.confidence, e.headline,
               ST_X(e.centroid::geometry) AS lon, ST_Y(e.centroid::geometry) AS lat,
               o.source_event_id
          FROM event e
          JOIN observation o ON o.event_id = e.id AND o.source = 'gdelt'
         WHERE e.primary_source = 'gdelt' AND e.type = 'war'
         ORDER BY e.occurred_at
    """)).fetchall()
    groups: dict[tuple[str, str], list] = defaultdict(list)
    for r in rows:
        m = r.metrics if isinstance(r.metrics, dict) else json.loads(r.metrics or "{}")
        iso3 = m.get("iso3") or (r.source_event_id.split(":")[1] if ":" in r.source_event_id else "?")
        day = r.occurred_at.astimezone().strftime("%Y%m%d") if r.occurred_at.tzinfo else r.occurred_at.strftime("%Y%m%d")
        # 按 UTC 日
        day = r.occurred_at.strftime("%Y%m%d")
        groups[(iso3, day)].append((r, m))
    war_rows = s.execute(text(
        "SELECT count(*) FROM event WHERE primary_source = 'war' OR (type='war' AND primary_source <> 'gdelt')"
    )).scalar()
    return rows, groups, war_rows


def apply(s, groups):
    merged = 0
    for (iso3, day), items in groups.items():
        items.sort(key=lambda x: x[0].occurred_at)
        keep, keep_m = items[0]
        slots = {}
        total = 0
        conf = 0.0
        for r, m in items:
            slot = r.occurred_at.strftime("%H%M")
            n = int(m.get("event_count") or 0)
            slots[slot] = n
            total += n
            conf = max(conf, float(r.confidence or 0))
        cname = (keep.headline or "").split("：")[0] or iso3
        metrics = {
            "event_count": total, "latest_slot_count": slots[max(slots)] if slots else 0,
            "slots": slots, "goldstein_abs_avg": keep_m.get("goldstein_abs_avg"),
            "iso3": None if str(iso3).startswith("PT:") else iso3,
            "source_mode": "export", "filter": "state_level_only",
            "aggregate": True, "aggregate_key": "country_day", "migrated_from_slots": len(items),
        }
        ev = NormalizedEvent(
            source="gdelt", source_event_id=f"day:{iso3}:{day}", category="conflict",
            type="armed_clash", lat=float(keep.lat), lon=float(keep.lon),
            occurred_at=keep.occurred_at.replace(hour=0, minute=0, second=0, microsecond=0),
            magnitude_value=float(total), magnitude_unit="events", confidence=conf, metrics=metrics,
        )
        sev = compute_severity(ev)
        s.execute(text("""
            UPDATE event
               SET type = 'armed_clash', is_aggregate = true,
                   magnitude_value = :mv, severity = :sev, confidence = :conf,
                   occurred_at = :occ, updated_at = now(),
                   headline = :head, metrics = CAST(:met AS text)::jsonb
             WHERE id = :id
        """), {"id": keep.id, "mv": float(total), "sev": sev, "conf": conf,
               "occ": ev.occurred_at,
               "head": f"{cname}：国家/武装冲突信号 当日 {total} 起",
               "met": json.dumps(metrics, ensure_ascii=False)})
        s.execute(text("""
            UPDATE observation SET source_event_id = :sid, raw = CAST(:raw AS text)::jsonb
             WHERE event_id = :id AND source = 'gdelt'
        """), {"sid": ev.source_event_id, "id": keep.id,
               "raw": json.dumps({"count": total, "iso3": iso3, "slots": slots}, ensure_ascii=False)})
        dup_ids = [r.id for r, _ in items[1:]]
        if dup_ids:
            s.execute(text("DELETE FROM event WHERE id = ANY(:ids)"), {"ids": dup_ids})
        merged += 1
    deleted_war = s.execute(text(
        "DELETE FROM event WHERE primary_source = 'war' OR (type='war' AND primary_source <> 'gdelt') RETURNING id"
    )).rowcount
    return merged, deleted_war


def main() -> int:
    ap = argparse.ArgumentParser()
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument("--dry-run", action="store_true")
    g.add_argument("--apply", action="store_true")
    a = ap.parse_args()
    with get_session() as s:
        rows, groups, war_rows = plan(s)
        print(f"gdelt slot rows: {len(rows)} → country×day groups: {len(groups)}")
        print(f"editorial war rows to delete: {war_rows}")
        top = sorted(groups.items(), key=lambda kv: -len(kv[1]))[:5]
        for (iso3, day), items in top:
            print(f"  {iso3} {day}: {len(items)} slots, events={sum(int((m.get('event_count') or 0)) for _, m in items)}")
        if a.dry_run:
            s.rollback()
            return 0
        merged, deleted_war = apply(s, groups)
        print(f"merged groups: {merged}; deleted editorial war rows: {deleted_war}")
        left = s.execute(text("SELECT count(*) FROM event WHERE type='war'")).scalar()
        agg = s.execute(text("SELECT count(*) FROM event WHERE type='armed_clash' AND is_aggregate")).scalar()
        print(f"remaining type=war: {left}; armed_clash aggregate rows: {agg}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
