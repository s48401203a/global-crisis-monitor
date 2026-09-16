#!/usr/bin/env bash
# 一键验收：后端单测 + 隔离集成 + 前端 check/test/build + e2e + 运行面健康。
# 任一失败非 0 退出。子步骤失败通过 fail 文件回传，不会被 subshell 吞掉。
# 用法:
#   bash scripts/verify.sh            # 严格：缺库/API 记失败，不得 ALL PASS
#   bash scripts/verify.sh --quick    # 可跳过 e2e 与运行面，必须列出跳过项
# 测试注入（仅 scripts/test_verify_gate.sh）:
#   CRISIS_VERIFY_STUB=1 CRISIS_VERIFY_INJECT=unit|integration|access|lint|frontend_test|build|e2e|health
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
QUICK=0
[[ "${1:-}" == "--quick" ]] && QUICK=1

FAIL_FILE="$(mktemp -t crisis-verify-fail.XXXXXX)"
HEALTH_FILE="$(mktemp -t crisis-verify-health.XXXXXX)"
SKIP_FILE="$(mktemp -t crisis-verify-skip.XXXXXX)"
cleanup() { rm -f "$FAIL_FILE" "$HEALTH_FILE" "$SKIP_FILE"; }
trap cleanup EXIT

INJECT="${CRISIS_VERIFY_INJECT:-}"
STUB="${CRISIS_VERIFY_STUB:-}"

step() { printf '\n\033[1m== %s\033[0m\n' "$*"; }
mark_fail() { echo "$1" >> "$FAIL_FILE"; }
mark_skip() { echo "$1" >> "$SKIP_FILE"; }

execute_step() {
  local key="$1"
  local label="$2"
  shift 2
  if [[ "$INJECT" == "$key" ]]; then
    echo "  ✗ $label (injected failure)"
    mark_fail "$key"
    return 1
  fi
  if [[ "$STUB" == "1" ]]; then
    echo "  ✓ $label (stub)"
    return 0
  fi
  if "$@"; then
    echo "  ✓ $label"
    return 0
  fi
  echo "  ✗ $label"
  mark_fail "$key"
  return 1
}

step "后端单测 / 集成（隔离库；不使用业务 crisis 库）"
execute_step unit "后端单测" \
  env PYTHONUTF8=1 bash -c "cd \"$ROOT/app\" && .venv/bin/python -m tests.run_unit"
execute_step access "访问令牌 / WS" \
  env PYTHONUTF8=1 bash -c "cd \"$ROOT/app\" && .venv/bin/python -m tests.integration_access"
execute_step integration "隔离集成（alerts/lifecycle/api/ingest/sync）" \
  env PYTHONUTF8=1 CRISIS_IT_ISOLATE=1 bash -c "cd \"$ROOT/app\" && .venv/bin/python -m tests.integration_alerts && .venv/bin/python -m tests.integration_lifecycle && .venv/bin/python -m tests.integration_api && .venv/bin/python -m tests.integration_ingest && .venv/bin/python -m tests.integration_sync"

step "前端 check / unit / build"
execute_step lint "前端 check" \
  bash -c "cd \"$ROOT/web\" && ./node_modules/.bin/vp check"
execute_step frontend_test "前端单测" \
  bash -c "cd \"$ROOT/web\" && ./node_modules/.bin/vp test run"
execute_step build "前端构建" \
  bash -c "cd \"$ROOT/web\" && ./node_modules/.bin/vp build"
if [[ "$INJECT" == "cdn" ]]; then
  echo "  ✗ dist 无 CDN 引用 (injected failure)"
  mark_fail cdn
elif [[ "$STUB" == "1" ]]; then
  echo "  ✓ dist 无 CDN 引用 (stub)"
elif [[ -d "$ROOT/web/dist" ]] && grep -rqE "unpkg\.com|fonts\.googleapis|fonts\.gstatic" "$ROOT/web/dist/"; then
  echo "  ✗ dist 含 CDN 引用"
  mark_fail cdn
else
  echo "  ✓ dist 无 CDN 引用"
fi

if [[ "$QUICK" -eq 0 ]]; then
  step "e2e（fixtures 模式）"
  execute_step e2e "Playwright e2e" \
    bash -c "cd \"$ROOT/web\" && ./node_modules/.bin/playwright test"
else
  step "e2e（跳过 --quick）"
  echo "  · 跳过 Playwright e2e"
  mark_skip e2e
fi

step "运行面"
health_ok=0
if [[ "$INJECT" == "health" ]]; then
  echo "  ✗ 运行面健康 (injected failure)"
  mark_fail health
elif [[ "$STUB" == "1" ]]; then
  echo "  ✓ 运行面健康 (stub)"
  health_ok=1
elif curl -fsS -m 5 http://127.0.0.1:8001/api/health >"$HEALTH_FILE" 2>/dev/null; then
  if python3 - "$HEALTH_FILE" <<'PY'
import json, sys
path = sys.argv[1]
d = json.load(open(path, encoding="utf-8"))
bad = [s["source"] for s in d.get("sources") or [] if s.get("status") == "error"]
print(f"  pipeline={d.get('pipeline_status')} watch_points={d.get('watch_points')} warnings={[w.get('code') for w in d.get('warnings') or []]} error_sources={bad}")
sys.exit(0 if d.get("pipeline_status") != "down" else 1)
PY
  then
    echo "  ✓ 运行面健康"
    health_ok=1
  else
    echo "  ✗ 运行面 pipeline=down"
    mark_fail health
  fi
else
  if [[ "$QUICK" -eq 1 ]]; then
    echo "  · API 8001 未运行（--quick 跳过运行面；./start.sh 可启动）"
    mark_skip health
  else
    echo "  ✗ API 8001 未运行（严格模式：不得视为通过；./start.sh 可启动）"
    mark_fail health
  fi
fi

step "文档口径"
# 允许：Windows 小节，以及同一行同时给出 macOS 口径（5180/8001）的对比说明
if command -v rg >/dev/null 2>&1; then
  if rg -n "D:\\\\crisis|5173|8000" "$ROOT/README.md" "$ROOT/AGENTS.md" | rg -v "Windows|windows|5180|8001" >/dev/null; then
    echo "  ✗ README/AGENTS 出现非 Windows 小节的旧口径"
    mark_fail docs
  else
    echo "  ✓ README/AGENTS 口径一致"
  fi
else
  echo "  · 未找到 rg，跳过文档口径扫描"
  mark_skip docs
fi

fail_n=0
if [[ -s "$FAIL_FILE" ]]; then
  fail_n="$(grep -c . "$FAIL_FILE" || true)"
fi
skip_n=0
if [[ -s "$SKIP_FILE" ]]; then
  skip_n="$(grep -c . "$SKIP_FILE" || true)"
fi

if [[ "$skip_n" -gt 0 ]]; then
  echo
  echo "跳过: $(tr '\n' ' ' < "$SKIP_FILE")"
fi
if [[ "$fail_n" -gt 0 ]]; then
  echo
  echo "失败步骤: $(tr '\n' ' ' < "$FAIL_FILE")"
  printf '\n\033[31mFAILED\033[0m\n'
  exit 1
fi
printf '\n\033[32mALL PASS\033[0m\n'
exit 0
