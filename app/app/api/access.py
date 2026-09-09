"""公网隧道访问令牌（可选）。

ACCESS_TOKEN 非空时：所有 /api/* 与 /ws* 请求必须带 `X-Access-Token: <token>`
或 `?token=<token>`；静态页面放行，但页面里的 fetch 会因 401 无数据 → 前端提示输入令牌。
本机 127.0.0.1 直连不受影响（隧道进来的请求 Host 不是 127.0.0.1）。
"""
from __future__ import annotations

import hmac

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

from ..config import settings


_LOOPBACK = ("127.0.0.1", "::1", "localhost")


def _is_local(request: Request) -> bool:
    """真正的本机请求：对端是回环地址，且没有任何转发头（cloudflared 会加 CF-Connecting-IP / X-Forwarded-For）。
    不用 Host 判断：Vite 代理 changeOrigin 会把 Host 改写成 127.0.0.1。"""
    client = request.client.host if request.client else ""
    if client not in _LOOPBACK:
        return False
    if request.headers.get("cf-connecting-ip"):
        return False
    xff = request.headers.get("x-forwarded-for") or ""
    hops = [h.strip() for h in xff.split(",") if h.strip()]
    return all(h in _LOOPBACK for h in hops)


def token_ok(request: Request) -> bool:
    expected = (settings.access_token or "").strip()
    if not expected:
        return True
    if _is_local(request) and not settings.access_token_enforce_local:
        return True
    given = request.headers.get("x-access-token") or request.query_params.get("token") or ""
    return hmac.compare_digest(given, expected)


class AccessTokenMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        if (path.startswith("/api/") or path.startswith("/ws")) and not token_ok(request):
            return JSONResponse({"error": "access token required", "hint": "X-Access-Token"},
                                status_code=401)
        return await call_next(request)
