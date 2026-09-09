# D:\crisis\app\app\main.py
from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from pathlib import Path

# truststore 必须在任何网络调用之前注入(企业网络 SSL 拦截)
import truststore
truststore.inject_into_ssl()

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.jobstores.sqlalchemy import SQLAlchemyJobStore
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from .config import settings
from .logging_setup import setup_logging
from .log_retention import run_log_retention
from .api import routes_events, routes_health, ws
from .collectors.usgs import UsgsCollector
from .collectors.gdacs import GdacsCollector
from .collectors.eonet import EonetCollector
from .collectors.gdelt import GdeltCollector
from .collectors.war_hotspots import WarHotspotsCollector
from .collectors.openmeteo_flood import OpenMeteoFloodCollector
from .collectors.firms import FirmsCollector
from .collectors.cma_alert import CmaAlertCollector
from .collectors.cenc import CencCollector
from .collectors.emsc_ws import start_emsc_listener
from .core.alerts import evaluate_alerts

setup_logging()
log = logging.getLogger(__name__)

# app/app/main.py → 仓库根 D:\crisis
REPO_ROOT = Path(__file__).resolve().parents[2]
WEB_DIST = REPO_ROOT / "web" / "dist"
LEGACY_STATIC = Path(__file__).resolve().parent / "static"


def _frontend_dir() -> Path:
    """优先挂载 Vite 构建产物，缺失时回退旧 static（避免服务起不来）。"""
    if (WEB_DIST / "index.html").is_file():
        return WEB_DIST
    log.warning("未找到 %s，回退 %s", WEB_DIST, LEGACY_STATIC)
    return LEGACY_STATIC


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


def _register_jobs() -> None:
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
    scheduler.add_job(WarHotspotsCollector().run, "interval",
                      seconds=3600,
                      id="war_hotspots", replace_existing=True)
    if settings.enable_openmeteo:
        scheduler.add_job(OpenMeteoFloodCollector().run, "interval",
                          seconds=settings.interval_openmeteo,
                          id="openmeteo", replace_existing=True)
    if getattr(settings, "enable_cma", True):
        scheduler.add_job(
            _cma_tick,
            "interval",
            seconds=int(getattr(settings, "interval_cma", 300) or 300),
            id="cma",
            replace_existing=True,
        )
    if getattr(settings, "enable_cenc", True):
        scheduler.add_job(
            _cenc_tick,
            "interval",
            seconds=int(getattr(settings, "interval_cenc", 180) or 180),
            id="cenc",
            replace_existing=True,
        )
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

    scheduler.add_job(_alert_tick, "interval", seconds=60,
                      id="alerts", replace_existing=True)
    scheduler.add_job(
        run_log_retention,
        "interval",
        minutes=10,
        id="log_retention",
        replace_existing=True,
    )

    # USGS 停机回补改为一次性 job，避免堵住 lifespan 启动
    # SQLAlchemyJobStore 不能序列化 lambda，必须用模块级可引用函数
    if settings.enable_usgs:
        scheduler.add_job(
            _usgs_backfill_once,
            "date",
            id="usgs_backfill_once",
            replace_existing=True,
        )


def _usgs_backfill_once() -> None:
    UsgsCollector(backfill=True).run()


def _cma_tick() -> None:
    CmaAlertCollector().run()


def _cenc_tick() -> None:
    CencCollector().run()


def _start_runtime() -> None:
    _register_jobs()
    try:
        scheduler.start()
    except Exception:
        log.exception("APScheduler 启动失败")
        raise

    if settings.enable_emsc:
        start_emsc_listener()

    try:
        WarHotspotsCollector().run()
    except Exception as e:
        log.warning("战争热点首采失败: %r", e)
    if settings.enable_gdelt:
        try:
            GdeltCollector().run()
        except Exception as e:
            log.warning("GDELT 首采失败: %r", e)
    if getattr(settings, "enable_cma", True):
        try:
            _cma_tick()
        except Exception as e:
            log.warning("中央气象台预警首采失败: %r", e)
    if getattr(settings, "enable_cenc", True):
        try:
            _cenc_tick()
        except Exception as e:
            log.warning("中国地震台网首采失败: %r", e)

    log.info("系统启动完成,已注册 %d 个定时任务", len(scheduler.get_jobs()))


def _stop_runtime() -> None:
    try:
        if scheduler.running:
            scheduler.shutdown(wait=False)
    except Exception:
        log.exception("APScheduler 关闭异常")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    _start_runtime()
    try:
        yield
    finally:
        _stop_runtime()


app = FastAPI(
    title="全球综合危机监测中心",
    description="中文默认 · 公开数据聚合 · 本地演示系统",
    version="1.0",
    lifespan=lifespan,
)
app.include_router(routes_events.router)
app.include_router(routes_health.router)
app.include_router(ws.router)

_front = _frontend_dir()
app.mount("/", StaticFiles(directory=str(_front), html=True), name="static")
log.info("静态前端目录: %s", _front)


def _alert_tick() -> None:
    for a in evaluate_alerts():
        ws.broadcast_alert(a)
