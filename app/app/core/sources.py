"""数据源注册表：名称、中英文、类型、采集间隔、过期阈值、启用开关。

main.py（注册任务）、routes_health.py（判定过期）、/api/meta（前端字典）
都从这里取，避免三处映射漂移。
"""
from __future__ import annotations

from dataclasses import dataclass

from ..config import settings


@dataclass(frozen=True)
class SourceSpec:
    name: str
    zh: str
    en: str
    kind: str            # poll | ws | static
    interval: int        # 秒；ws/static 为语义间隔，用于 stale 判定
    stale_factor: float  # stale_sec = interval * stale_factor（至少 min_stale）
    enabled: bool
    note_zh: str = ""    # 稳定性/合规备注，前端可显示


MIN_STALE_SEC = 600


def _spec(name, zh, en, kind, interval, factor, enabled, note=""):
    return SourceSpec(name, zh, en, kind, int(interval), factor, bool(enabled), note)


def all_sources() -> list[SourceSpec]:
    s = settings
    return [
        _spec("usgs", "美国地质调查局", "USGS", "poll", s.interval_usgs, 5, s.enable_usgs),
        _spec("emsc", "欧洲地中海地震中心", "EMSC", "ws", 600, 1, s.enable_emsc,
              "WebSocket 实时推送；stale 以最近一次收到消息或心跳为准"),
        _spec("gdacs", "全球灾害警报协调系统", "GDACS", "poll", s.interval_gdacs, 5, s.enable_gdacs),
        _spec("eonet", "NASA 地球观测事件", "NASA EONET", "poll", s.interval_eonet, 4, s.enable_eonet),
        _spec("gdelt", "全球事件数据库", "GDELT", "poll", s.interval_gdelt, 4, s.enable_gdelt,
              "媒体信号，非确证事件"),
        _spec("war", "战争冲突热点", "War hotspots", "static", 3600, 2, True, "编辑维护的基线层"),
        _spec("openmeteo", "Open-Meteo 洪水", "Open-Meteo flood", "poll", s.interval_openmeteo, 2, s.enable_openmeteo),
        _spec("cma", "中央气象台预警", "CMA weather alerts", "poll", s.interval_cma, 5, s.enable_cma,
              "非公开文档接口"),
        _spec("cenc", "中国地震台网", "CENC earthquake", "poll", s.interval_cenc, 5, s.enable_cenc,
              "第三方镜像（wolfx）"),
        _spec("firms", "NASA 火点 FIRMS", "NASA FIRMS", "poll", s.interval_firms, 4,
              s.enable_firms and bool((s.firms_map_key or "").strip())),
    ]


def by_name() -> dict[str, SourceSpec]:
    return {x.name: x for x in all_sources()}


def stale_seconds(spec: SourceSpec) -> int:
    return max(MIN_STALE_SEC, int(spec.interval * spec.stale_factor))


def pipeline_status(network_total: int, failing_now: int, degraded_min: int) -> str:
    """管道级判定，只看联网源（poll/ws）：
    failing_now = 最近一次尝试失败（consecutive_failures ≥ 1）或已判 error 的源数。
    单源故障是"该源异常"；多源同时失败几乎必然是网络/代理问题，要尽快红显，
    所以这里不等单源的 3 次失败阈值。
    """
    if network_total <= 0 or failing_now >= network_total:
        return "down"
    if failing_now >= max(1, int(degraded_min)):
        return "degraded"
    return "ok"
