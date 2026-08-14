"""日志目录总量上限：超过则循环清掉较旧数据，最多保留 max_bytes。"""
from __future__ import annotations

import argparse
import logging
import re
from pathlib import Path

log = logging.getLogger(__name__)

DEFAULT_MAX_BYTES = 500 * 1024 * 1024
MIN_KEEP_TAIL = 64 * 1024
SKIP_SUFFIX = {".pid", ".lock"}
ROTATED_NAME = re.compile(r"\.(?:log|txt)\.\d+$|\.log\.\d{8,}")


def _is_managed(path: Path) -> bool:
    if not path.is_file():
        return False
    name = path.name
    if name.startswith("."):
        return False
    if path.suffix.lower() in SKIP_SUFFIX:
        return False
    if name.endswith(".pid"):
        return False
    return ".log" in name.lower()


def _is_rotated(path: Path) -> bool:
    return bool(ROTATED_NAME.search(path.name))


def _file_size(path: Path) -> int:
    try:
        return path.stat().st_size
    except OSError:
        return 0


def _collect(log_dir: Path) -> list[Path]:
    if not log_dir.is_dir():
        return []
    return [p for p in log_dir.rglob("*") if _is_managed(p)]


def _truncate_keep_tail(path: Path, keep: int) -> int:
    size = _file_size(path)
    if size <= keep:
        return 0
    keep = max(keep, 0)
    with path.open("rb+") as fh:
        fh.seek(size - keep)
        tail = fh.read()
        nl = tail.find(b"\n")
        if 0 <= nl < len(tail) - 1:
            tail = tail[nl + 1 :]
        fh.seek(0)
        fh.write(tail)
        fh.truncate()
    return size - _file_size(path)


def enforce_log_budget(log_dir: Path, max_bytes: int = DEFAULT_MAX_BYTES) -> dict:
    """
    目录内托管日志合计超过 max_bytes 时：
    1) 先删最旧的轮转备份
    2) 仍超则从最旧活动日志头部裁掉，只留较新尾部
    """
    max_bytes = max(int(max_bytes), MIN_KEEP_TAIL)
    files = _collect(log_dir)
    before = sum(_file_size(p) for p in files)
    deleted: list[str] = []
    truncated: list[str] = []

    if before <= max_bytes:
        return {
            "log_dir": str(log_dir),
            "max_bytes": max_bytes,
            "before": before,
            "after": before,
            "deleted": deleted,
            "truncated": truncated,
        }

    ranked = sorted(files, key=lambda p: (p.stat().st_mtime, p.name))
    total = before

    for path in list(ranked):
        if total <= max_bytes:
            break
        if not _is_rotated(path):
            continue
        sz = _file_size(path)
        try:
            path.unlink()
        except OSError as exc:
            log.warning("删除旧日志失败 %s: %s", path, exc)
            continue
        total -= sz
        deleted.append(path.name)
        ranked.remove(path)

    for path in list(ranked):
        if total <= max_bytes:
            break
        sz = _file_size(path)
        need = total - max_bytes
        keep = max(sz - need, MIN_KEEP_TAIL if not _is_rotated(path) else 0)
        if keep <= 0 and _is_rotated(path):
            try:
                path.unlink()
            except OSError as exc:
                log.warning("删除旧日志失败 %s: %s", path, exc)
                continue
            total -= sz
            deleted.append(path.name)
            continue
        if keep >= sz:
            continue
        freed = _truncate_keep_tail(path, keep)
        if freed:
            total -= freed
            truncated.append(path.name)

    after = sum(_file_size(p) for p in _collect(log_dir))
    if deleted or truncated:
        log.info(
            "日志容量 %s → %s（上限 %s），删除 %d 个，裁剪 %d 个",
            before,
            after,
            max_bytes,
            len(deleted),
            len(truncated),
        )
    return {
        "log_dir": str(log_dir),
        "max_bytes": max_bytes,
        "before": before,
        "after": after,
        "deleted": deleted,
        "truncated": truncated,
    }


def run_log_retention() -> dict:
    from .config import settings

    max_bytes = int(getattr(settings, "log_max_bytes", DEFAULT_MAX_BYTES) or DEFAULT_MAX_BYTES)
    return enforce_log_budget(Path(settings.log_dir), max_bytes)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="将日志目录压到上限以内（默认 500MB）")
    parser.add_argument("--dir", dest="log_dir", default="")
    parser.add_argument("--max-bytes", dest="max_bytes", type=int, default=0)
    args = parser.parse_args(argv)

    if args.log_dir:
        log_dir = Path(args.log_dir)
        max_bytes = args.max_bytes or DEFAULT_MAX_BYTES
        result = enforce_log_budget(log_dir, max_bytes)
    else:
        result = run_log_retention()
        if args.max_bytes:
            result = enforce_log_budget(Path(result["log_dir"]), args.max_bytes)

    print(
        "log-retention before={before} after={after} max={max_bytes} "
        "deleted={deleted} truncated={truncated}".format(
            before=result["before"],
            after=result["after"],
            max_bytes=result["max_bytes"],
            deleted=len(result["deleted"]),
            truncated=len(result["truncated"]),
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
