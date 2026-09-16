"""干净检出：无 app/.env 时单测入口仍能 import Settings。"""
from __future__ import annotations

import os


def test_unit_bootstrap_provides_placeholder_database_url() -> None:
    assert os.environ.get("DATABASE_URL", "").startswith("postgresql")
