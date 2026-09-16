# 源健康面板 —— 这个接口回答"系统到底还活着吗"
from fastapi import APIRouter
from sqlalchemy import text

from ..config import settings
from ..core.sources import all_sources, pipeline_status, stale_seconds
from ..db import get_session
from ..net import effective_proxy_for_log

router = APIRouter(prefix="/api")


@router.get("/health")
def health():
    with get_session() as s:
        rows = s.execute(text("""
            SELECT source, last_success_at, last_attempt_at, last_error,
                   consecutive_failures, total_success, total_failure,
                   last_ingest_status, last_ingest_ok, last_ingest_fail,
                   EXTRACT(EPOCH FROM (now() - last_success_at)) AS age_sec
              FROM source_health
        """)).fetchall()
        total = s.execute(text(
            "SELECT count(*) FROM event WHERE status <> 'deleted'"
        )).scalar()
        watch_points = s.execute(text(
            "SELECT count(*) FROM watch_point WHERE enabled")).scalar()
        watch_regions = s.execute(text(
            "SELECT count(*) FROM watch_region WHERE enabled")).scalar()
        # 90 天中位数 < 20 m³/s 的关注点：GloFAS 网格点不在河道上，需人工挪坐标
        off_channel = [r[0] for r in s.execute(text("""
            SELECT p.name FROM watch_point p
              JOIN watch_sample w ON w.point_id = p.id
             WHERE p.enabled AND w.day >= CURRENT_DATE - 90
             GROUP BY p.id, p.name
            HAVING count(*) >= 14
               AND percentile_cont(0.5) WITHIN GROUP (ORDER BY w.discharge) < 20
             ORDER BY p.name
        """)).fetchall()]

    by_src = {r.source: r for r in rows}
    sources = []
    enabled_total = 0
    network_total = 0   # 联网源（poll/ws）
    failing_now = 0     # 最近一次尝试失败或已判 error 的联网源
    for spec in all_sources():
        r = by_src.get(spec.name)
        limit = stale_seconds(spec)
        ingest_st = (r.last_ingest_status if r else None) or ""
        if not spec.enabled:
            status = "disabled"
        elif r is None:
            status = "pending"          # 已启用但尚未跑过（刚启动）
        else:
            stale = r.age_sec is None or r.age_sec > limit
            # 全部入库失败立即非绿；连续失败 3 次或过期 → 异常；部分失败单独标
            if r.consecutive_failures >= 3 or stale or ingest_st == "failed":
                status = "error"
            elif ingest_st == "partial":
                status = "partial"
            else:
                status = "ok"
        if spec.enabled:
            enabled_total += 1
            if spec.kind in ("poll", "ws"):
                network_total += 1
                if status == "error" or ingest_st == "failed" or (
                    r is not None and (r.consecutive_failures or 0) >= 1
                ):
                    failing_now += 1
        succ = r.total_success if r else 0
        fail = r.total_failure if r else 0
        sources.append({
            "source": spec.name,
            "source_zh": spec.zh,
            "source_en": spec.en,
            "kind": spec.kind,
            "enabled": spec.enabled,
            "interval_seconds": spec.interval,
            "stale_seconds": limit,
            "note_zh": spec.note_zh,
            "last_success_at": r.last_success_at.isoformat() if r and r.last_success_at else None,
            "last_attempt_at": r.last_attempt_at.isoformat() if r and r.last_attempt_at else None,
            "age_seconds": int(r.age_sec) if r and r.age_sec is not None else None,
            "consecutive_failures": r.consecutive_failures if r else 0,
            "success_rate": round(succ / max(1, succ + fail), 3),
            "last_error": r.last_error if r else None,
            "last_ingest_status": ingest_st or None,
            "last_ingest_ok": int(r.last_ingest_ok) if r and r.last_ingest_ok is not None else 0,
            "last_ingest_fail": int(r.last_ingest_fail) if r and r.last_ingest_fail is not None else 0,
            "status": status,
            "status_zh": {"ok": "正常", "error": "异常", "disabled": "已关闭",
                          "pending": "等待首采", "partial": "部分失败"}[status],
        })

    pipeline = pipeline_status(network_total, failing_now,
                               settings.pipeline_degraded_min_sources)

    warnings = []
    if watch_points == 0 and settings.enable_openmeteo:
        warnings.append({"code": "no_watch_points",
                         "zh": "未配置洪水关注点，Open-Meteo 采集器空跑"})
    if watch_regions == 0:
        warnings.append({"code": "no_watch_regions",
                         "zh": "未配置关注区域，关注区域告警规则不会触发"})
    if off_channel:
        warnings.append({"code": "watch_points_off_channel",
                         "zh": f"{len(off_channel)} 个洪水关注点不在河道格点上（已跳过触发）",
                         "points": off_channel})

    return {
        "event_total": total,
        "sources": sources,
        "pipeline_status": pipeline,
        "pipeline_bad_sources": failing_now,
        "pipeline_enabled_sources": enabled_total,
        "pipeline_network_sources": network_total,
        "proxy": effective_proxy_for_log(),
        "watch_points": watch_points,
        "watch_regions": watch_regions,
        "warnings": warnings,
        "locale": "zh-CN",
    }
