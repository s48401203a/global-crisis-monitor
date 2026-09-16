from __future__ import annotations

from fastapi import APIRouter

from ..core.schemas import EventType
from ..core.sources import all_sources
from ..core.grade import TONES

router = APIRouter(prefix="/api")

TYPE_LABELS = {
    "earthquake": ("地震", "Earthquake"), "cyclone": ("气旋/台风", "Cyclone"),
    "flood": ("洪水", "Flood"), "rainstorm": ("暴雨预警", "Rainstorm warning"),
    "wildfire": ("野火", "Wildfire"), "volcano": ("火山", "Volcano"),
    "drought": ("干旱", "Drought"), "armed_clash": ("武装冲突", "Armed clash"),
    "crisis_signal": ("危机信号", "Crisis signal"), "war": ("战争冲突", "War / Conflict"),
}


@router.get("/meta")
def meta():
    """前端字典单一来源：类型、来源、等级色调、版本。"""
    from ..main import app as _app  # 延迟导入取 version
    types = [t for t in EventType.__args__]  # type: ignore[attr-defined]
    return {
        "version": _app.version,
        "api": "v2",
        "types": [{"type": t, "zh": TYPE_LABELS.get(t, (t, t))[0], "en": TYPE_LABELS.get(t, (t, t))[1],
                   "category": "conflict" if t in ("armed_clash", "crisis_signal", "war") else "natural"}
                  for t in types],
        "sources": [{"source": s.name, "zh": s.zh, "en": s.en, "kind": s.kind,
                     "enabled": s.enabled, "interval_seconds": s.interval, "note_zh": s.note_zh}
                    for s in all_sources()],
        "grade_tones": list(TONES),
        "ws": {
            "path": "/ws",
            "topics": ["alert", "events.changed", "pipeline.status"],
            "auth": "POST /api/ws-ticket then ?ticket=; legacy ?token= also accepted",
        },
        "sync": {
            "cursor": "change_seq",
            "snapshot": "GET /api/events (paginated via cursor/next_cursor)",
            "changes": "GET /api/events?since_seq=",
            "reconcile": "GET /api/events/reconcile returns versions[{id,change_seq,status}]",
            "refetch": "GET /api/events?ids= for stale/missing versions; do not advance cursor",
            "truncated": "do not advance watermark until complete=true",
            "high_water": "advisory only; never a safe incremental cursor",
        },
    }
