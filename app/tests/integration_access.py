"""ACCESS_TOKEN 中间件语义（TestClient，无需外网）：
  cd app && PYTHONUTF8=1 .venv/bin/python -m tests.integration_access
"""
from __future__ import annotations

import sys
import warnings

warnings.filterwarnings("ignore")

from fastapi.testclient import TestClient  # noqa: E402

from app.api.access import AccessTokenMiddleware  # noqa: E402
from app.config import settings  # noqa: E402
import app.main as m  # noqa: E402

fails = 0


def check(name, cond, extra=""):
    global fails
    print(("OK  " if cond else "FAIL"), name, extra)
    if not cond:
        fails += 1


def main() -> int:
    old = settings.access_token
    settings.access_token = "s3cret-token-xyz"
    # 中间件在 import 时按配置决定是否挂载；测试里显式挂一次
    if not any(getattr(mw, "cls", None) is AccessTokenMiddleware for mw in m.app.user_middleware):
        m.app.add_middleware(AccessTokenMiddleware)
        m.app.middleware_stack = None  # 强制重建
    try:
        # TestClient 默认 client=("testclient", 50000) → 非回环 → 需要令牌
        c = TestClient(m.app)
        check("remote without token → 401", c.get("/api/meta").status_code == 401)
        check("remote with header token → 200", c.get("/api/meta", headers={"X-Access-Token": "s3cret-token-xyz"}).status_code == 200)
        check("remote with ?token= → 200", c.get("/api/meta?token=s3cret-token-xyz").status_code == 200)
        check("wrong token → 401", c.get("/api/meta", headers={"X-Access-Token": "nope"}).status_code == 401)
        check("static page still served", c.get("/").status_code == 200)
        # 回环客户端且无转发头 → 放行
        local = TestClient(m.app, client=("127.0.0.1", 12345))
        check("loopback client without token → 200", local.get("/api/meta").status_code == 200)
        # 回环但带 cloudflared 转发头（隧道→本机）→ 需要令牌
        check("loopback + CF-Connecting-IP → 401",
              local.get("/api/meta", headers={"CF-Connecting-IP": "203.0.113.9"}).status_code == 401)
        check("loopback + XFF loopback (vite proxy) → 200",
              local.get("/api/meta", headers={"X-Forwarded-For": "127.0.0.1"}).status_code == 200)
        check("loopback + XFF public (tunnel via vite) → 401",
              local.get("/api/meta", headers={"X-Forwarded-For": "198.51.100.7, 127.0.0.1"}).status_code == 401)
    finally:
        settings.access_token = old
    print(f"{'PASS' if not fails else 'FAIL'}: {fails} failures")
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
