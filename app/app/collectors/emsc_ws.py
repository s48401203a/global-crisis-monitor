# D:\crisis\app\app\collectors\emsc_ws.py
import asyncio, json, logging, threading
from datetime import datetime

import websockets

from ..core.schemas import NormalizedEvent
from ..core.ingest import ingest_events

log = logging.getLogger(__name__)
WS_URL = "wss://www.seismicportal.eu/standing_order/websocket"
PING_INTERVAL = 15       # 官方要求,低于此值连接会被断开


def _to_event(msg: dict) -> NormalizedEvent | None:
    try:
        p = msg["data"]["properties"]
        return NormalizedEvent(
            source="emsc",
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


async def _listen() -> None:
    backoff = 5
    while True:
        try:
            async with websockets.connect(WS_URL, ping_interval=PING_INTERVAL) as ws:
                log.info("[emsc] WebSocket 已连接")
                backoff = 5      # 连接成功后重置退避
                async for raw in ws:
                    msg = json.loads(raw)
                    ev = _to_event(msg)
                    if ev:
                        # action 为 update 时,ingest 内部按 upsert 处理修订
                        ingest_events([ev])
        except Exception as e:
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
