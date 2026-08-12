"""无 pytest 依赖的单测入口：python -m tests.run_unit"""
from __future__ import annotations

import traceback

from tests.test_dedupe_constants import (
    test_eq_distance_meters,
    test_eq_mag_tolerance,
    test_eq_time_window_seconds,
)
from tests.test_parse_dt_and_severity import (
    test_eonet_naive_is_utc,
    test_flood_ratio_high_small_river_alertable,
    test_gdacs_naive_is_utc,
    test_war_baseline_does_not_alert,
)


def main() -> int:
    tests = [
        test_eq_time_window_seconds,
        test_eq_distance_meters,
        test_eq_mag_tolerance,
        test_gdacs_naive_is_utc,
        test_eonet_naive_is_utc,
        test_flood_ratio_high_small_river_alertable,
        test_war_baseline_does_not_alert,
    ]
    failed = 0
    for fn in tests:
        try:
            fn()
            print("OK", fn.__name__)
        except Exception:
            failed += 1
            print("FAIL", fn.__name__)
            traceback.print_exc()
    print(f"{len(tests) - failed}/{len(tests)} passed")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
