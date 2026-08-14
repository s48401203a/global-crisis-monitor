"""去重阈值常量契约（TASK-A8 / REV-09）。"""

from app.core.dedupe import (
    EQ_DISTANCE_M,
    EQ_MAG_TOLERANCE,
    EQ_TIME_WINDOW_S,
    should_take_over,
)


def test_eq_time_window_seconds() -> None:
    assert EQ_TIME_WINDOW_S == 90


def test_eq_distance_meters() -> None:
    assert EQ_DISTANCE_M == 100_000


def test_eq_mag_tolerance() -> None:
    assert EQ_MAG_TOLERANCE == 0.5


def test_same_source_takes_over() -> None:
    assert should_take_over("cma", "cma") is True
    assert should_take_over("cma", None) is True
    assert should_take_over("gdelt", "usgs") is False
