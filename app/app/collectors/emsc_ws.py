import asyncio, json, logging, threading
from datetime import datetime

import websockets

from ..core.schemas import NormalizedEvent
from ..core.ingest import ingest_events
from ..net import websocket_proxy
from .base import touch_attempt, touch_failure, touch_success

log = logging.getLogger(__name__)
SOURCE = "emsc"
WS_URL = "wss://www.seismicportal.eu/standing_order/websocket"
PING_INTERVAL = 15       # 官方要求,低于此值连接会被断开
# 空闲多久算一次"仍然活着"：无消息时也刷新 last_success_at，避免安静时段被判 stale
HEARTBEAT_SEC = 300


def _to_event(msg: dict) -> NormalizedEvent | None:
    try:
        p = msg["data"]["properties"]
        return NormalizedEvent(
            source=SOURCE,
            source_event_id=str(p["unid"]),
            category="natural", type="earthquake",
            lat=float(p["lat"]), lon=float(p["lon"]),
            occurred_at=datetime.fromisoformat(p["time"].replace("Z", "+00:00")),
            headline=p.get("flynn_region") or "",
            magnitude_value=float(p["mag"]) if p.get("mag") is not None else None,
            magnitude_unit="M",
            metrics={"depth_km": p.get("depth"),
                     "magtype": p.get("magtype"),
                     "emsc_action": msg.get("action")},
            raw=msg,
        )
    except (KeyError, TypeError, ValueError) as e:
        log.warning("[emsc] 消息解析失败: %r", e)
        return None


def _safe(fn, *a):
    try:
        fn(*a)
    except Exception as e:  # 健康表写失败不能拖垮监听
        log.debug("[emsc] health 写入失败: %r", e)


async def _listen() -> None:
    backoff = 5
    while True:
        _safe(touch_attempt, SOURCE)
        try:
            async with websockets.connect(
                WS_URL, ping_interval=PING_INTERVAL, proxy=websocket_proxy()
            ) as ws:
                log.info("[emsc] WebSocket 已连接")
                backoff = 5      # 连接成功后重置退避
                _safe(touch_success, SOURCE)
                while True:
                    try:
                        raw = await asyncio.wait_for(ws.recv(), timeout=HEARTBEAT_SEC)
                    except asyncio.TimeoutError:
                        # 连接仍在（ping 正常）但无新震：记一次心跳成功
                        _safe(touch_success, SOURCE)
                        continue
                    msg = json.loads(raw)
                    ev = _to_event(msg)
                    if ev:
                        # action 为 update 时,ingest 内部按 upsert 处理修订
                        ingest_events([ev])
                    _safe(touch_success, SOURCE)
        except Exception as e:
            _safe(touch_failure, SOURCE, repr(e))
            log.error("[emsc] 连接中断: %r,%d 秒后重连", e, backoff)
            await asyncio.sleep(backoff)
            backoff = min(backoff * 2, 300)   # 指数退避,上限 5 分钟


def start_emsc_listener() -> threading.Thread:
    """在独立线程中运行,避免干扰 FastAPI 主事件循环"""
    def _run():
        # 独立线程内新建事件循环。此处不涉及 psycopg 异步,
        # ingest 走同步驱动,不受红线 #1 影响。
        asyncio.new_event_loop().run_until_complete(_listen())

    t = threading.Thread(target=_run, name="emsc-ws", daemon=True)
    t.start()
    return t
