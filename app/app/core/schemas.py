# D:\crisis\app\app\core\schemas.py
from datetime import datetime
from typing import Any, Literal
from pydantic import BaseModel, Field

Category = Literal["natural", "conflict"]
EventType = Literal[
    "earthquake", "cyclone", "flood", "wildfire", "volcano", "drought",
    "armed_clash", "crisis_signal", "war",
]


class NormalizedEvent(BaseModel):
    """所有 Adapter 的统一输出格式"""
    source: str
    source_event_id: str
    category: Category
    type: EventType

    lat: float
    lon: float
    # 台风路径等线状/面状几何,GeoJSON dict,可为空
    footprint_geojson: dict[str, Any] | None = None

    occurred_at: datetime          # 必须是带时区的 UTC
    headline: str = ""
    magnitude_value: float | None = None
    magnitude_unit: str | None = None
    confidence: float = 1.0       # 自然灾害恒为 1.0
    metrics: dict[str, Any] = Field(default_factory=dict)
    actors: dict[str, Any] | None = None
    raw: dict[str, Any] = Field(default_factory=dict)
