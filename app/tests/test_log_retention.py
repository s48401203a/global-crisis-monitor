from __future__ import annotations

import os
import tempfile
import time
from pathlib import Path

from app.log_retention import MIN_KEEP_TAIL, enforce_log_budget


def _tmp() -> Path:
    return Path(tempfile.mkdtemp(prefix="logret-"))


def test_deletes_oldest_rotated_first() -> None:
    tmp = _tmp()
    older = tmp / "app.log.2"
    newer = tmp / "app.log.1"
    active = tmp / "app.log"
    chunk = b"x" * (MIN_KEEP_TAIL // 2)
    older.write_bytes(chunk)
    newer.write_bytes(chunk)
    active.write_bytes(chunk)
    now = time.time()
    os.utime(older, (now - 180, now - 180))
    os.utime(newer, (now - 60, now - 60))
    os.utime(active, (now, now))

    result = enforce_log_budget(tmp, max_bytes=len(chunk) * 2 + 100)
    assert result["after"] <= len(chunk) * 2 + 100
    assert not older.exists()
    assert active.exists()
    assert active.stat().st_size == len(chunk)


def test_truncates_active_log_keep_tail() -> None:
    tmp = _tmp()
    active = tmp / "uvicorn-console.out.log"
    payload = (b"old-line\n" * 8000) + b"KEEP-TAIL\n"
    active.write_bytes(payload)
    cap = MIN_KEEP_TAIL + 200
    result = enforce_log_budget(tmp, max_bytes=cap)
    assert result["after"] <= cap
    data = active.read_bytes()
    assert b"KEEP-TAIL" in data
    assert active.exists()


def test_under_budget_noop() -> None:
    tmp = _tmp()
    f = tmp / "app.log"
    f.write_bytes(b"ok\n")
    result = enforce_log_budget(tmp, max_bytes=500)
    assert result["before"] == result["after"]
    assert result["deleted"] == []
    assert result["truncated"] == []
    assert f.read_bytes() == b"ok\n"
