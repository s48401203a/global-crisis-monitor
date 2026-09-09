from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path

# truststore 必须在任何网络调用之前注入(企业网络 SSL 拦截)
import truststore
truststore.inject_into_ssl()

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.jobstores.sqlalchemy import SQLAlchemyJobStore
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from .config import settings, REPO_ROOT
from .net import effective_proxy_for_log
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

WEB_DIST = REPO_ROOT / "web" / "dist"
PLACEHOLDER_DIR = Path(__file__).resolve().parent / "placeholder"


def _frontend_dir() -> Path:
    """挂载 Vite 构建产物；缺失时挂一个"请先构建"占位页而不是让 API 起不来。"""
    if (WEB_DIST / "index.html").is_file():
        return WEB_DIST
    log.warning("未找到 %s，挂载占位页（请先 cd web && vp build）", WEB_DIST)
    return PLACEHOLDER_DIR


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


def _soon(offset_s: int) -> datetime:
    """启动后错峰首采：避免所有源同一秒打出去，也避免间隔任务等一整轮才首跑。"""
    return datetime.now(timezone.utc) + timedelta(seconds=offset_s)


def _register_jobs() -> None:
    # (id, enabled, func, interval_s, first_run_offset_s)
    specs = [
        ("usgs", settings.enable_usgs, UsgsCollector().run, settings.interval_usgs, 5),
        ("gdacs", settings.enable_gdacs, GdacsCollector().run, settings.interval_gdacs, 20),
        ("eonet", settings.enable_eonet, EonetCollector().run, settings.interval_eonet, 30),
        ("gdelt", settings.enable_gdelt, GdeltCollector().run, settings.interval_gdelt, 45),
        ("war_hotspots", True, WarHotspotsCollector().run, 3600, 2),
        ("openmeteo", settings.enable_openmeteo, OpenMeteoFloodCollector().run,
         settings.interval_openmeteo, 60),
        ("cma", getattr(settings, "enable_cma", True), _cma_tick,
         int(getattr(settings, "interval_cma", 300) or 300), 10),
        ("cenc", getattr(settings, "enable_cenc", True), _cenc_tick,
         int(getattr(settings, "interval_cenc", 180) or 180), 15),
        ("firms", settings.enable_firms, FirmsCollector().run,
         int(getattr(settings, "interval_firms", 900) or 900), 90),
    ]
    for job_id, enabled, func, interval, offset in specs:
        if not enabled:
            # 已关闭的源：确保 jobstore 里没有残留任务（上次运行时可能是开的）
            try:
                scheduler.remove_job(job_id)
            except Exception:
                pass
            continue
        scheduler.add_job(func, "interval", seconds=int(interval), id=job_id,
                          replace_existing=True, next_run_time=_soon(offset))

    # 告警评估：启动后给采集器一个宽限期，避免回补的旧事件立刻刷屏
    scheduler.add_job(_alert_tick, "interval", seconds=60,
                      id="alerts", replace_existing=True,
                      next_run_time=_soon(settings.alert_startup_grace_seconds))
    scheduler.add_job(
        run_log_retention,
        "interval",
        minutes=10,
        id="log_retention",
        replace_existing=True,
        next_run_time=_soon(120),
    )

    # USGS 停机回补改为一次性 job，避免堵住 lifespan 启动
    # SQLAlchemyJobStore 不能序列化 lambda，必须用模块级可引用函数
    if settings.enable_usgs:
        scheduler.add_job(
            _usgs_backfill_once,
            "date",
            run_date=_soon(3),
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
    log.info("出站代理策略: %s", effective_proxy_for_log())
    _register_jobs()
    try:
        scheduler.start()
    except Exception:
        log.exception("APScheduler 启动失败")
        raise

    if settings.enable_emsc:
        start_emsc_listener()

    log.info("系统启动完成,已注册 %d 个定时任务（首采已错峰排入）", len(scheduler.get_jobs()))


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
