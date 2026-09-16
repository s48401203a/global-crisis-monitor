"""公网隧道访问令牌（可选）。

ACCESS_TOKEN 非空时：所有 /api/* 与 /ws* 请求必须带 `X-Access-Token: <token>`
或 `?token=<token>`；WebSocket 优先使用短期 `?ticket=`（由 POST /api/ws-ticket 签发），
避免长期令牌出现在访问日志。静态页面放行，页面里的 fetch 会因 401 提示输入令牌。
本机 127.0.0.1 直连不受影响（隧道进来的请求 Host 不是 127.0.0.1）。
"""
from __future__ import annotations

import hashlib
import hmac
import os
import time

from fastapi import APIRouter, Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request as StarletteRequest
from starlette.responses import JSONResponse

from ..config import settings


_LOOPBACK = ("127.0.0.1", "::1", "localhost")
TICKET_TTL_SEC = 60
ticket_router = APIRouter(prefix="/api")


def _is_local(request: StarletteRequest) -> bool:
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


def _ticket_key() -> bytes:
    raw = (settings.access_token or "").encode("utf-8")
    return hashlib.sha256(b"crisis-ws-ticket-v1:" + raw).digest()


def issue_ticket(*, now: int | None = None, ttl: int = TICKET_TTL_SEC) -> tuple[str, int]:
    """签发短期 WS 票据。返回 (ticket, expires_in)。"""
    now = int(time.time() if now is None else now)
    exp = now + max(1, int(ttl))
    nonce = os.urandom(8).hex()
    payload = f"{exp}.{nonce}"
    sig = hmac.new(_ticket_key(), payload.encode("ascii"), hashlib.sha256).hexdigest()[:32]
    return f"{payload}.{sig}", ttl


def ticket_status(ticket: str, *, now: int | None = None) -> str:
    """ok | expired | invalid | missing"""
    if not (ticket or "").strip():
        return "missing"
    now = int(time.time() if now is None else now)
    parts = ticket.strip().split(".")
    if len(parts) != 3:
        return "invalid"
    exp_s, _nonce, sig = parts
    try:
        exp = int(exp_s)
    except ValueError:
        return "invalid"
    payload = f"{exp_s}.{_nonce}"
    expect = hmac.new(_ticket_key(), payload.encode("ascii"), hashlib.sha256).hexdigest()[:32]
    if not hmac.compare_digest(sig, expect):
        return "invalid"
    if exp < now:
        return "expired"
    return "ok"


def _header_or_query_token(request: StarletteRequest) -> str:
    return request.headers.get("x-access-token") or request.query_params.get("token") or ""


def token_matches(given: str) -> bool:
    expected = (settings.access_token or "").strip()
    if not expected:
        return True
    if not given:
        return False
    if len(given) != len(expected):
        # compare_digest 要求等长；长度不同即失败
        return hmac.compare_digest(expected, expected) and False
    return hmac.compare_digest(given, expected)


def token_ok(request: StarletteRequest) -> bool:
    expected = (settings.access_token or "").strip()
    if not expected:
        return True
    if _is_local(request) and not settings.access_token_enforce_local:
        return True
    if token_matches(_header_or_query_token(request)):
        return True
    return ticket_status(request.query_params.get("ticket") or "") == "ok"


def ws_auth_code(request: StarletteRequest) -> int | None:
    """None=放行；4401=未认证/错误凭据；4403=票据过期。"""
    expected = (settings.access_token or "").strip()
    if not expected:
        return None
    if _is_local(request) and not settings.access_token_enforce_local:
        return None
    if token_matches(_header_or_query_token(request)):
        return None
    st = ticket_status(request.query_params.get("ticket") or "")
    if st == "ok":
        return None
    if st == "expired":
        return 4403
    return 4401


class AccessTokenMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        if (path.startswith("/api/") or path.startswith("/ws")) and not token_ok(request):
            return JSONResponse({"error": "access token required", "hint": "X-Access-Token"},
                                status_code=401)
        return await call_next(request)


@ticket_router.post("/ws-ticket")
def create_ws_ticket():
    """HTTP 已通过中间件鉴权后再签发短期 WS 票据。ACCESS_TOKEN 为空时 required=false。"""
    expected = (settings.access_token or "").strip()
    if not expected:
        return {"ticket": "", "expires_in": 0, "required": False}
    ticket, ttl = issue_ticket()
    return {"ticket": ticket, "expires_in": ttl, "required": True}
