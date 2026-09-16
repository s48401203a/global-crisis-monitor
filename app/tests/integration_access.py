"""ACCESS_TOKEN 中间件与 WS 票据（TestClient，无需业务库）：
  cd app && PYTHONUTF8=1 .venv/bin/python -m tests.integration_access
"""
from __future__ import annotations

import sys
import time
import warnings

warnings.filterwarnings("ignore")

from fastapi.testclient import TestClient  # noqa: E402

from app.api.access import AccessTokenMiddleware, issue_ticket  # noqa: E402
from app.config import settings  # noqa: E402
import app.main as m  # noqa: E402

fails = 0


def check(name, cond, extra=""):
    global fails
    print(("OK  " if cond else "FAIL"), name, extra)
    if not cond:
        fails += 1


def _client(**kw):
    try:
        return TestClient(m.app, lifespan="off", **kw)
    except TypeError:
        return TestClient(m.app, **kw)


def _ws_close_code(client, path: str):
    try:
        with client.websocket_connect(path) as ws:
            ws.send_text("ping")
            return None
    except Exception as e:
        code = getattr(e, "code", None)
        if code is None and getattr(e, "args", None):
            for a in e.args:
                if isinstance(a, int) and a >= 1000:
                    return a
        return code or type(e).__name__


def main() -> int:
    old = settings.access_token
    old_local = settings.access_token_enforce_local
    settings.access_token = "s3cret-token-xyz"
    settings.access_token_enforce_local = False
    if not any(getattr(mw, "cls", None) is AccessTokenMiddleware for mw in m.app.user_middleware):
        m.app.add_middleware(AccessTokenMiddleware)
        m.app.middleware_stack = None
    try:
        c = _client()
        check("remote without token → 401", c.get("/api/meta").status_code == 401)
        check("remote with header token → 200",
              c.get("/api/meta", headers={"X-Access-Token": "s3cret-token-xyz"}).status_code == 200)
        check("remote with ?token= → 200", c.get("/api/meta?token=s3cret-token-xyz").status_code == 200)
        check("wrong token → 401", c.get("/api/meta", headers={"X-Access-Token": "nope"}).status_code == 401)
        check("static page still served", c.get("/").status_code == 200)
        local = _client(client=("127.0.0.1", 12345))
        check("loopback client without token → 200", local.get("/api/meta").status_code == 200)
        check("loopback + CF-Connecting-IP → 401",
              local.get("/api/meta", headers={"CF-Connecting-IP": "203.0.113.9"}).status_code == 401)
        check("loopback + XFF loopback (vite proxy) → 200",
              local.get("/api/meta", headers={"X-Forwarded-For": "127.0.0.1"}).status_code == 200)
        check("loopback + XFF public (tunnel via vite) → 401",
              local.get("/api/meta", headers={"X-Forwarded-For": "198.51.100.7, 127.0.0.1"}).status_code == 401)

        # 强制本机也鉴权
        settings.access_token_enforce_local = True
        local2 = _client(client=("127.0.0.1", 12345))
        check("enforce_local loopback without token → 401", local2.get("/api/meta").status_code == 401)
        check("enforce_local loopback with token → 200",
              local2.get("/api/meta", headers={"X-Access-Token": "s3cret-token-xyz"}).status_code == 200)
        settings.access_token_enforce_local = False

        # 票据
        denied = c.post("/api/ws-ticket")
        check("ws-ticket without token → 401", denied.status_code == 401)
        issued = c.post("/api/ws-ticket", headers={"X-Access-Token": "s3cret-token-xyz"})
        check("ws-ticket with token → 200", issued.status_code == 200)
        body = issued.json() if issued.status_code == 200 else {}
        check("ws-ticket required", body.get("required") is True)
        ticket = body.get("ticket") or ""
        check("ws-ticket non-empty", bool(ticket) and ticket.count(".") == 2)

        ws_no = _ws_close_code(c, "/ws")
        check("ws without creds rejected", ws_no not in (None, 1000, 1001), str(ws_no))
        ws_bad = _ws_close_code(c, "/ws?token=nope")
        check("ws wrong token rejected", ws_bad not in (None, 1000, 1001), str(ws_bad))
        try:
            with c.websocket_connect("/ws?token=s3cret-token-xyz") as ws:
                ws.send_text("ping")
            check("ws with ?token= connects", True)
        except Exception as e:
            check("ws with ?token= connects", False, repr(e))
        try:
            with c.websocket_connect(f"/ws?ticket={ticket}") as ws:
                ws.send_text("ping")
            check("ws with ticket connects", True)
        except Exception as e:
            check("ws with ticket connects", False, repr(e))

        expired, _ = issue_ticket(now=int(time.time()) - 120, ttl=30)
        ws_exp = _ws_close_code(c, f"/ws?ticket={expired}")
        check("ws expired ticket rejected", ws_exp not in (None, 1000, 1001), str(ws_exp))
        if isinstance(ws_exp, int):
            check("ws expired ticket code 4403 or 4401", ws_exp in (4403, 4401), str(ws_exp))
    finally:
        settings.access_token = old
        settings.access_token_enforce_local = old_local
    print(f"{'PASS' if not fails else 'FAIL'}: {fails} failures")
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
