# D:\crisis\app\app\db.py
# 红线 #1:必须同步 Engine。异步 psycopg 在 Windows 服务模式下不可用。
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from contextlib import contextmanager
from .config import settings

engine = create_engine(
    settings.database_url,
    pool_size=5, max_overflow=10,
    pool_pre_ping=True,      # 连接失效自动重连,长期运行必需
    pool_recycle=3600,
    future=True,
)
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False, future=True)


@contextmanager
def get_session():
    """供采集器与后台任务使用的会话上下文"""
    s: Session = SessionLocal()
    try:
        yield s
        s.commit()
    except Exception:
        s.rollback()
        raise
    finally:
        s.close()
