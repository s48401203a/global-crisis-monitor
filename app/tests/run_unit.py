"""无 pytest 依赖的单测入口：python -m tests.run_unit"""
from __future__ import annotations

import traceback

from tests.test_dedupe_constants import (
    test_eq_distance_meters,
    test_eq_mag_tolerance,
    test_eq_time_window_seconds,
    test_same_source_takes_over,
)
from tests.test_cma_cenc import (
    test_classify_cma_rainstorm_not_flood,
    test_cma_normalize_skips_wind_keeps_rain,
    test_cenc_normalize_filters_small,
)
from tests.test_log_retention import (
    test_deletes_oldest_rotated_first,
    test_truncates_active_log_keep_tail,
    test_under_budget_noop,
)
from tests.test_alerts import (
    test_match_rule_eq_china_m4,
    test_match_rule_eq_tiny_skipped,
    test_match_rule_rainstorm,
    test_match_rule_war_baseline_skipped,
)
from tests.test_net_sources import (
    test_firms_disabled_without_key,
    test_pipeline_status_thresholds,
    test_proxy_mode_direct_ignores_env,
    test_proxy_mode_env_default_and_invalid_falls_back,
    test_proxy_mode_url_redacts_credentials,
    test_sources_registry_covers_all_collectors_and_emsc,
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
        test_same_source_takes_over,
        test_gdacs_naive_is_utc,
        test_eonet_naive_is_utc,
        test_flood_ratio_high_small_river_alertable,
        test_war_baseline_does_not_alert,
        test_deletes_oldest_rotated_first,
        test_truncates_active_log_keep_tail,
        test_under_budget_noop,
        test_classify_cma_rainstorm_not_flood,
        test_cma_normalize_skips_wind_keeps_rain,
        test_cenc_normalize_filters_small,
        test_match_rule_rainstorm,
        test_match_rule_eq_china_m4,
        test_match_rule_eq_tiny_skipped,
        test_match_rule_war_baseline_skipped,
        test_proxy_mode_direct_ignores_env,
        test_proxy_mode_url_redacts_credentials,
        test_proxy_mode_env_default_and_invalid_falls_back,
        test_sources_registry_covers_all_collectors_and_emsc,
        test_firms_disabled_without_key,
        test_pipeline_status_thresholds,
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
