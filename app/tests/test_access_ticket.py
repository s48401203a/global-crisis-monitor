"""WS 短期票据：签发、过期、篡改。无需数据库。"""
from __future__ import annotations

import time

from app.config import settings
from app.api.access import issue_ticket, ticket_status, token_matches


def test_ticket_roundtrip() -> None:
    old = settings.access_token
    settings.access_token = "unit-test-token"
    try:
        now = 1_700_000_000
        ticket, ttl = issue_ticket(now=now, ttl=60)
        assert ttl == 60
        assert ticket_status(ticket, now=now) == "ok"
        assert ticket_status(ticket, now=now + 59) == "ok"
        assert ticket_status(ticket, now=now + 61) == "expired"
        assert ticket_status("", now=now) == "missing"
        assert ticket_status("not-a-ticket", now=now) == "invalid"
        parts = ticket.split(".")
        tampered = f"{parts[0]}.{parts[1]}.{'0' * 32}"
        assert ticket_status(tampered, now=now) == "invalid"
    finally:
        settings.access_token = old


def test_token_matches_rejects_wrong_length() -> None:
    old = settings.access_token
    settings.access_token = "abcdef"
    try:
        assert token_matches("abcdef") is True
        assert token_matches("abc") is False
        assert token_matches("abcdefg") is False
        assert token_matches("") is False
    finally:
        settings.access_token = old
