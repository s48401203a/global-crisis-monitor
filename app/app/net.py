"""统一出站网络策略：代理模式、UA、超时。

HTTP_PROXY_MODE:
  env    — 沿用进程环境变量（HTTP_PROXY / HTTPS_PROXY / NO_PROXY），默认
  direct — 忽略环境变量，直连
  url    — 使用 HTTP_PROXY_URL 指定的代理
所有采集器与 EMSC WebSocket 都从这里取代理决策，避免"环境里残留一个失效代理
却没人知道"（2026-08-16 全源静默中断的根因）。
"""
from __future__ import annotations

import logging
import os
from urllib.parse import urlsplit, urlunsplit

import httpx

from .config import settings

log = logging.getLogger(__name__)

DEFAULT_UA = "CrisisMonitor/1.0 (+local; research; contact=local-admin)"


def proxy_mode() -> str:
    m = (settings.http_proxy_mode or "env").strip().lower()
    return m if m in ("env", "direct", "url") else "env"


def proxy_url() -> str | None:
    """返回显式代理地址；env 模式返回 None（交给 httpx/websockets 读环境）。"""
    mode = proxy_mode()
    if mode == "direct":
        return None
    if mode == "url":
        return (settings.http_proxy_url or "").strip() or None
    return None


def trust_env() -> bool:
    return proxy_mode() == "env"


def effective_proxy_for_log() -> str:
    """日志用：不泄露代理地址中的凭证。"""
    mode = proxy_mode()
    if mode == "direct":
        return "direct"
    url = proxy_url() if mode == "url" else (
        os.environ.get("HTTPS_PROXY") or os.environ.get("https_proxy")
        or os.environ.get("HTTP_PROXY") or os.environ.get("http_proxy") or ""
    )
    if not url:
        return f"{mode}(none)"
    p = urlsplit(url)
    host = p.hostname or ""
    port = f":{p.port}" if p.port else ""
    return f"{mode}({urlunsplit((p.scheme, host + port, '', '', ''))})"


def make_client(timeout: float = 25.0, **kw) -> httpx.Client:
    """采集器专用 httpx.Client；调用方负责 with/close。"""
    headers = dict(kw.pop("headers", None) or {})
    headers.setdefault("User-Agent", DEFAULT_UA)
    opts: dict = dict(timeout=timeout, follow_redirects=True, headers=headers,
                      trust_env=trust_env())
    url = proxy_url()
    if url:
        opts["proxy"] = url
    opts.update(kw)
    return httpx.Client(**opts)


def websocket_proxy():
    """websockets.connect(proxy=…) 的取值：True=读环境，None=直连，str=显式。"""
    mode = proxy_mode()
    if mode == "direct":
        return None
    if mode == "url":
        return proxy_url()
    return True
