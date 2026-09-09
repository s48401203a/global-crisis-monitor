from fastapi import APIRouter

from ..collectors.theaters import list_theaters

router = APIRouter(prefix="/api")


@router.get("/theaters")
def theaters():
    """战区基线层（编辑维护，非事件）。前端作为独立图层显示，不计入统计。"""
    return {"type": "FeatureCollection", "features": list_theaters()}
