# D:\crisis\app\app\main.py
import logging

# truststore 必须在任何网络调用之前注入(企业网络 SSL 拦截)
import truststore
truststore.inject_into_ssl()

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.jobstores.sqlalchemy import SQLAlchemyJobStore
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from .config import settings
from .logging_setup import setup_logging
from .api import routes_events, routes_health, ws
from .collectors.usgs import UsgsCollector
from .collectors.gdacs import GdacsCollector
from .collectors.eonet import EonetCollector
from .collectors.gdelt import GdeltCollector
from .collectors.war_hotspots import WarHotspotsCollector
from .collectors.openmeteo_flood import OpenMeteoFloodCollector
from .collectors.firms import FirmsCollector
from .collectors.emsc_ws import start_emsc_listener
from .core.alerts import evaluate_alerts

setup_logging()
log = logging.getLogger(__name__)

app = FastAPI(
    title="全球综合危机监测中心",
    description="中文默认 · 公开数据聚合 · 本地演示系统",
    version="1.0",
)
app.include_router(routes_events.router)
app.include_router(routes_health.router)
app.include_router(ws.router)
app.mount("/", StaticFiles(directory="app/static", html=True), name="static")

scheduler = BackgroundScheduler(
    jobstores={"default": SQLAlchemyJobStore(url=settings.database_url)},
    job_defaults={
        # 红线 #7:默认仅 1 秒,机器休眠或服务重启后任务全丢
        "misfire_grace_time": 3600,
        "coalesce": True,      # 堆积的多次触发合并为一次
        "max_instances": 1,   # 同一采集器不并发执行
    },
    timezone="UTC",           # 内部一律 UTC,展示层再转本地
)


@app.on_event("startup")
def on_startup() -> None:
    # 启动时用 all_day 回补一次,填补服务停机期间的空档
    if settings.enable_usgs:
        UsgsCollector(backfill=True).run()

    if settings.enable_usgs:
        scheduler.add_job(UsgsCollector().run, "interval",
                          seconds=settings.interval_usgs,
                          id="usgs", replace_existing=True)
    if settings.enable_gdacs:
        scheduler.add_job(GdacsCollector().run, "interval",
                          seconds=settings.interval_gdacs,
                          id="gdacs", replace_existing=True)
    if settings.enable_eonet:
        scheduler.add_job(EonetCollector().run, "interval",
                          seconds=settings.interval_eonet,
                          id="eonet", replace_existing=True)
    if settings.enable_gdelt:
        scheduler.add_job(GdeltCollector().run, "interval",
                          seconds=settings.interval_gdelt,
                          id="gdelt", replace_existing=True)
    # 战争热点基线：始终注册，保证地图有冲突/战区点
    scheduler.add_job(WarHotspotsCollector().run, "interval",
                      seconds=3600,
                      id="war_hotspots", replace_existing=True)
    if settings.enable_openmeteo:
        scheduler.add_job(OpenMeteoFloodCollector().run, "interval",
                          seconds=settings.interval_openmeteo,
                          id="openmeteo", replace_existing=True)
    # FIRMS 火点：默认关闭；开关 true 且配置 MAP_KEY 后注册调度（REV-01）
    if settings.enable_firms:
        interval_firms = getattr(settings, "interval_firms", 900) or 900
        scheduler.add_job(
            FirmsCollector().run,
            "interval",
            seconds=int(interval_firms),
            id="firms",
            replace_existing=True,
        )
        log.info("已注册 FIRMS 采集任务（interval=%ss）", interval_firms)

    # 告警评估与采集解耦,独立跑
    scheduler.add_job(_alert_tick, "interval", seconds=60,
                      id="alerts", replace_existing=True)
    scheduler.start()

    # EMSC 走 WebSocket 常驻线程,不进 scheduler
    if settings.enable_emsc:
        start_emsc_listener()

    # 启动时立即灌入战争热点 + 尝试 GDELT
    try:
        WarHotspotsCollector().run()
    except Exception as e:
        log.warning("战争热点首采失败: %r", e)
    if settings.enable_gdelt:
        try:
            GdeltCollector().run()
        except Exception as e:
            log.warning("GDELT 首采失败: %r", e)

    log.info("系统启动完成,已注册 %d 个定时任务", len(scheduler.get_jobs()))


def _alert_tick() -> None:
    for a in evaluate_alerts():
        ws.broadcast_alert(a)


@app.on_event("shutdown")
def on_shutdown() -> None:
    scheduler.shutdown(wait=False)
