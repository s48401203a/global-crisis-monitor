#!/usr/bin/env bash
# 失败注入：验证 scripts/verify.sh 任一步失败都不会输出 ALL PASS，且退出码非 0。
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VERIFY="$ROOT/scripts/verify.sh"
fails=0

expect_fail() {
  local key="$1"
  local extra="${2:-}"
  local out rc
  set +e
  out="$(CRISIS_VERIFY_STUB=1 CRISIS_VERIFY_INJECT="$key" bash "$VERIFY" $extra 2>&1)"
  rc=$?
  set -e
  if [[ "$rc" -eq 0 ]]; then
    echo "FAIL inject=$key still exited 0"
    fails=$((fails + 1))
    return
  fi
  if printf '%s\n' "$out" | grep -q "ALL PASS"; then
    echo "FAIL inject=$key printed ALL PASS"
    fails=$((fails + 1))
    return
  fi
  if ! printf '%s\n' "$out" | grep -q "FAILED"; then
    echo "FAIL inject=$key missing FAILED banner"
    fails=$((fails + 1))
    return
  fi
  echo "OK  inject=$key rc=$rc"
}

expect_fail unit --quick
expect_fail access --quick
expect_fail integration --quick
expect_fail lint --quick
expect_fail frontend_test --quick
expect_fail build --quick
expect_fail e2e
expect_fail health
expect_fail cdn --quick

# stub 全成功（--quick 跳过 e2e/health）应 0 且 ALL PASS
set +e
ok_out="$(CRISIS_VERIFY_STUB=1 bash "$VERIFY" --quick 2>&1)"
ok_rc=$?
set -e
if [[ "$ok_rc" -ne 0 ]] || ! printf '%s\n' "$ok_out" | grep -q "ALL PASS"; then
  echo "FAIL stub --quick should pass, rc=$ok_rc"
  fails=$((fails + 1))
else
  echo "OK  stub --quick ALL PASS"
fi

# 严格模式 API 未运行：真实脚本（非 stub）应对 health 失败。此处用 inject 已覆盖。
if [[ "$fails" -eq 0 ]]; then
  echo "PASS: verify.sh failure injection"
  exit 0
fi
echo "FAIL: $fails injection checks"
exit 1
