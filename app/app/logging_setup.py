# D:\crisis\app\app\logging_setup.py
# 红线 #8:Windows 强制文件锁会让标准 RotatingFileHandler 抛 WinError 32
import logging, sys
from concurrent_log_handler import ConcurrentRotatingFileHandler
from .config import settings


def setup_logging() -> None:
    settings.log_dir.mkdir(parents=True, exist_ok=True)

    fmt = logging.Formatter(
        "%(asctime)s %(levelname)-7s [%(name)s] %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    # 文件:必须显式 encoding,否则默认 locale(cp936)
    fh = ConcurrentRotatingFileHandler(
        str(settings.log_dir / "app.log"),
        maxBytes=10 * 1024 * 1024, backupCount=10,
        encoding="utf-8",
    )
    fh.setFormatter(fmt)

    # 控制台:服务化后 stdout 被重定向会回退 GBK(红线 #2)
    # reconfigure 时 errors 必须一并指定,否则被重置为 strict
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="backslashreplace")
    sh = logging.StreamHandler(sys.stdout)
    sh.setFormatter(fmt)

    root = logging.getLogger()
    root.setLevel(settings.log_level)
    root.handlers.clear()
    root.addHandler(fh)
    root.addHandler(sh)

    # 降噪
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("apscheduler.executors").setLevel(logging.WARNING)
