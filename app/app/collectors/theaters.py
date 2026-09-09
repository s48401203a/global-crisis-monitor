"""战区基线层：从 theater 表读取，供 /api/theaters；不再写入 event。

取代旧 war_hotspots 采集器（后者把编辑内容当事件入库，每小时刷新 occurred_at）。
唯一的"采集"动作是：用 country 表质心校准 iso3 非空且未手工定位的点，并刷新健康表。
"""
from __future__ import annotations

import logging
from typing import Any

from sqlalchemy import text

from ..db import get_session
from .base import touch_attempt, touch_failure, touch_success

log = logging.getLogger(__name__)
SOURCE = "war"


def refresh_theaters() -> int:
    """健康心跳 + 质心校准；返回启用的战区数。"""
    touch_attempt(SOURCE)
    try:
        with get_session() as s:
            # 只校准 note 中未标记 manual 的点：海峡等非国家点保持手工坐标
            s.execute(text("""
                UPDATE theater t
                   SET geom = c.centroid, updated_at = now()
                  FROM country c
                 WHERE t.iso3 IS NOT NULL
                   AND c.iso3 = t.iso3
                   AND COALESCE(t.note_en, '') NOT LIKE '%manual%'
                   AND ST_Distance(t.geom, c.centroid) > 1000
            """))
            n = s.execute(text("SELECT count(*) FROM theater WHERE enabled")).scalar()
        touch_success(SOURCE)
        return int(n or 0)
    except Exception as e:
        touch_failure(SOURCE, repr(e))
        log.error("[war] 战区层刷新失败: %r", e)
        return 0


def list_theaters() -> list[dict[str, Any]]:
    with get_session() as s:
        rows = s.execute(text("""
            SELECT id, iso3, name_zh, name_en, level, note_zh, note_en, updated_at,
                   ST_Y(geom::geometry) AS lat, ST_X(geom::geometry) AS lon
              FROM theater WHERE enabled ORDER BY level, id
        """)).fetchall()
    return [
        {
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [float(r.lon), float(r.lat)]},
            "properties": {
                "id": r.id, "iso3": r.iso3, "name_zh": r.name_zh, "name_en": r.name_en,
                "level": r.level, "note_zh": r.note_zh, "note_en": r.note_en,
                "updated_at": r.updated_at.isoformat() if r.updated_at else None,
                "kind": "theater",
            },
        }
        for r in rows
    ]
