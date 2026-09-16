"""隔离集成测试库：临时数据库，不使用业务 crisis 库。

GitHub Actions 已在空服务容器建库时设 GITHUB_ACTIONS=1，直接用 DATABASE_URL。
本机默认 CREATE DATABASE crisis_it_* ，套用 05-schema + migrate.sh，结束时 DROP。
"""
from __future__ import annotations

import os
import secrets
import shutil
import subprocess
import sys
from contextlib import contextmanager
from pathlib import Path
from urllib.parse import unquote, urlparse

REPO_ROOT = Path(__file__).resolve().parents[2]


def _normalize_url(url: str) -> str:
    u = (url or "").strip()
    if u.startswith("postgresql+psycopg://"):
        return "postgresql://" + u[len("postgresql+psycopg://"):]
    return u


def _parts(url: str) -> dict:
    p = urlparse(_normalize_url(url))
    return {
        "host": p.hostname or "127.0.0.1",
        "port": str(p.port or 5432),
        "user": unquote(p.username or "postgres"),
        "password": unquote(p.password or ""),
        "database": (p.path or "/postgres").lstrip("/") or "postgres",
    }


def _psql_bin() -> str:
    env_bin = os.environ.get("PG_BIN", "")
    if env_bin:
        cand = Path(env_bin) / "psql"
        if cand.is_file():
            return str(cand)
    which = shutil.which("psql")
    if which:
        return which
    for p in (
        "/opt/homebrew/opt/postgresql@17/bin/psql",
        "/usr/local/opt/postgresql@17/bin/psql",
        "/usr/bin/psql",
    ):
        if Path(p).is_file():
            return p
    raise RuntimeError("找不到 psql：请安装 PostgreSQL 客户端，或设置 PG_BIN")


def _run_psql(args: list[str], env: dict, sql: str | None = None) -> None:
    cmd = [_psql_bin(), "-v", "ON_ERROR_STOP=1", "-q", *args]
    subprocess.run(cmd, check=True, input=sql, text=True if sql is not None else None, env=env)


def _pg_env(parts: dict, database: str) -> dict:
    env = os.environ.copy()
    env["PGHOST"] = parts["host"]
    env["PGPORT"] = parts["port"]
    env["PGUSER"] = parts["user"]
    env["PGPASSWORD"] = parts["password"]
    env["PGDATABASE"] = database
    env["PGSSLMODE"] = "disable"
    return env


def _sa_url(parts: dict, database: str) -> str:
    from urllib.parse import quote_plus
    user = quote_plus(parts["user"])
    pw = quote_plus(parts["password"])
    return f"postgresql+psycopg://{user}:{pw}@{parts['host']}:{parts['port']}/{database}"


def _load_settings_url() -> str:
    os.environ.setdefault("PYTHONUTF8", "1")
    # 确保能读到 app/.env
    os.chdir(REPO_ROOT / "app")
    if str(REPO_ROOT / "app") not in sys.path:
        sys.path.insert(0, str(REPO_ROOT / "app"))
    from app.config import settings
    return settings.database_url


def rebind_engine(url: str) -> None:
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker

    from app.config import settings
    from app import db

    settings.database_url = url
    os.environ["DATABASE_URL"] = url
    try:
        db.engine.dispose()
    except Exception:
        pass
    db.engine = create_engine(
        url, pool_size=3, max_overflow=2, pool_pre_ping=True, pool_recycle=3600, future=True,
    )
    db.SessionLocal = sessionmaker(bind=db.engine, expire_on_commit=False, future=True)


def _apply_schema(parts: dict, database: str) -> None:
    env = _pg_env(parts, database)
    schema = REPO_ROOT / "setup" / "05-schema.sql"
    _run_psql(["-d", database, "-f", str(schema)], env)
    mig = subprocess.run(
        ["bash", str(REPO_ROOT / "setup" / "migrate.sh")],
        check=False,
        env={**env, "PG_BIN": str(Path(_psql_bin()).parent)},
        cwd=str(REPO_ROOT),
    )
    if mig.returncode != 0:
        raise RuntimeError("migrate.sh failed for isolated database")


@contextmanager
def isolated_database():
    """进入隔离库；结束后删除临时库（CI 服务库除外）。"""
    base_url = os.environ.get("DATABASE_URL") or _load_settings_url()
    parts = _parts(base_url)
    use_env = os.environ.get("GITHUB_ACTIONS") == "true" or os.environ.get("CRISIS_IT_USE_ENV_DB") == "1"
    temp_name = None
    if use_env:
        rebind_engine(base_url if base_url.startswith("postgresql+") else _sa_url(parts, parts["database"]))
        try:
            yield parts["database"]
        finally:
            from app import db
            try:
                db.engine.dispose()
            except Exception:
                pass
        return

    temp_name = f"crisis_it_{os.getpid()}_{secrets.token_hex(3)}"
    admin_env = _pg_env(parts, "postgres")
    ident = '"' + temp_name.replace('"', "") + '"'
    try:
        _run_psql(["-d", "postgres", "-c", f"CREATE DATABASE {ident} TEMPLATE template0 ENCODING 'UTF8'"], admin_env)
    except subprocess.CalledProcessError:
        _run_psql(["-d", "postgres", "-c", f"CREATE DATABASE {ident}"], admin_env)
    try:
        _run_psql(["-d", temp_name, "-c", "CREATE EXTENSION IF NOT EXISTS postgis;"], _pg_env(parts, temp_name))
        _run_psql(["-d", temp_name, "-c", "CREATE EXTENSION IF NOT EXISTS pg_trgm;"], _pg_env(parts, temp_name))
        _apply_schema(parts, temp_name)
        url = _sa_url(parts, temp_name)
        rebind_engine(url)
        yield temp_name
    finally:
        try:
            from app import db
            db.engine.dispose()
        except Exception:
            pass
        # 断开后删除
        try:
            _run_psql(
                ["-d", "postgres"],
                admin_env,
                sql=(
                    f"SELECT pg_terminate_backend(pid) FROM pg_stat_activity "
                    f"WHERE datname = '{temp_name}' AND pid <> pg_backend_pid();\n"
                    f"DROP DATABASE IF EXISTS {ident};"
                ),
            )
        except Exception as e:
            print("WARN drop isolated db:", e, file=sys.stderr)
