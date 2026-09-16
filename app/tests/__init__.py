"""单测包。不读 app/.env 也能 import 采集器（它们会带到 Settings.database_url）。"""
from __future__ import annotations

import os

os.environ.setdefault(
    "DATABASE_URL",
    "postgresql+psycopg://postgres:unused@127.0.0.1:5432/crisis",
)
