# D:\crisis\app\app\api\routes_health.py
# 源健康面板 —— 这个接口回答"系统到底还活着吗"
from fastapi import APIRouter
from sqlalchemy import text

from ..db import get_session

router = APIRouter(prefix="/api")


@router.get("/health")
def health():
    with get_session() as s:
        rows = s.execute(text("""
            SELECT source, last_success_at, last_attempt_at, last_error,
                   consecutive_failures, total_success, total_failure,
                   EXTRACT(EPOCH FROM (now() - last_success_at)) AS age_sec
              FROM source_health ORDER BY source
        """)).fetchall()
        total = s.execute(text(
            "SELECT count(*) FROM event WHERE status <> 'deleted'"
        )).scalar()

    # 中文显示名（前端亦有映射，双保险）
    SOURCE_ZH = {
        "usgs": "美国地质调查局",
        "emsc": "欧洲地中海地震中心",
        "gdacs": "全球灾害警报协调系统",
        "eonet": "NASA 地球观测事件",
        "gdelt": "全球事件数据库",
        "war": "战争冲突热点",
        "openmeteo": "Open-Meteo 洪水",
        "firms": "NASA 火点 FIRMS",
    }
    # 按采集间隔判定过期，避免 6 小时一轮的 openmeteo 1 小时后被误判异常
    STALE_SEC = {
        "usgs": 600,
        "emsc": 600,
        "gdacs": 1800,
        "eonet": 3600,
        "gdelt": 3600,
        "firms": 3600,
        "war": 7200,
        "openmeteo": 43200,
    }
    sources = []
    for r in rows:
        # 判定规则:连续失败 3 次以上,或超过该源阈值无成功采集 → 异常
        limit = STALE_SEC.get(r.source, 3600)
        stale = r.age_sec is None or r.age_sec > limit
        sources.append({
            "source": r.source,
            "source_zh": SOURCE_ZH.get(r.source, r.source),
            "last_success_at": r.last_success_at.isoformat() if r.last_success_at else None,
            "age_seconds": int(r.age_sec) if r.age_sec else None,
            "consecutive_failures": r.consecutive_failures,
            "success_rate": round(
                r.total_success / max(1, r.total_success + r.total_failure), 3),
            "last_error": r.last_error,
            "status": "error" if (r.consecutive_failures >= 3 or stale) else "ok",
            "status_zh": "异常" if (r.consecutive_failures >= 3 or stale) else "正常",
        })
    return {"event_total": total, "sources": sources, "locale": "zh-CN"}
