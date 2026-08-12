# D:\crisis\app\app\api\ws.py
# WebSocket 实时推送告警到前端(规格 3.2 / 项目结构)
from __future__ import annotations

import asyncio
import json
import logging
from typing import Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

log = logging.getLogger(__name__)
router = APIRouter()

# 进程内连接表;单机演示无需 Redis pubsub
_clients: set[WebSocket] = set()
_loop: asyncio.AbstractEventLoop | None = None


@router.websocket("/ws/alerts")
async def alerts_ws(websocket: WebSocket) -> None:
    global _loop
    await websocket.accept()
    _clients.add(websocket)
    _loop = asyncio.get_running_loop()
    try:
        while True:
            # 保持连接;客户端可发 ping 文本
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        _clients.discard(websocket)


def broadcast_alert(payload: dict[str, Any]) -> None:
    """
    供同步告警线程调用。将 dict 推到所有 WebSocket 客户端。
    若尚无事件循环(无前端连接),静默丢弃即可——告警已落库。
    """
    if not _clients or _loop is None:
        return
    data = json.dumps(payload, ensure_ascii=False, default=str)

    async def _send_all() -> None:
        dead: list[WebSocket] = []
        for ws in list(_clients):
            try:
                await ws.send_text(data)
            except Exception:
                dead.append(ws)
        for ws in dead:
            _clients.discard(ws)

    try:
        asyncio.run_coroutine_threadsafe(_send_all(), _loop)
    except Exception as e:
        log.debug("broadcast_alert 跳过: %r", e)
