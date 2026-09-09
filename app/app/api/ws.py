# WebSocket 实时通道：主题化消息 {topic, payload}
#   alert          — 告警（兼容旧格式：payload 字段同时平铺在顶层，含 event_id）
#   events.changed — 某源一轮入库后变更的事件 id 列表，前端据此增量拉取 since=
#   pipeline.status— 采集管道状态变化
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


async def _serve(websocket: WebSocket) -> None:
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


@router.websocket("/ws")
async def ws_main(websocket: WebSocket) -> None:
    await _serve(websocket)


@router.websocket("/ws/alerts")
async def alerts_ws(websocket: WebSocket) -> None:
    """旧路径，行为与 /ws 相同。"""
    await _serve(websocket)


def broadcast(topic: str, payload: dict[str, Any]) -> None:
    """供同步线程调用。无前端连接时静默丢弃（数据已落库）。"""
    if not _clients or _loop is None:
        return
    msg = {"topic": topic, "payload": payload}
    if topic == "alert":
        msg.update(payload)   # 兼容旧前端：顶层 event_id 等
    data = json.dumps(msg, ensure_ascii=False, default=str)

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
        log.debug("broadcast 跳过: %r", e)


def broadcast_alert(payload: dict[str, Any]) -> None:
    broadcast("alert", payload)
