#!/usr/bin/env bash
# 一键验收：后端单测 + 集成 + 前端 check/test/build + e2e + 运行面健康。任一失败非 0 退出。
# 用法: bash scripts/verify.sh            # 全部
#       bash scripts/verify.sh --quick    # 跳过 e2e
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
QUICK=0; [[ "${1:-}" == "--quick" ]] && QUICK=1
fail=0
step() { printf '\n\033[1m== %s\033[0m\n' "$*"; }
run() { if "$@"; then echo "  ✓ $*"; else echo "  ✗ $*"; fail=1; fi; }

step "后端单测 / 集成（需要本机 crisis 库）"
( cd "$ROOT/app" && export PYTHONUTF8=1
  run .venv/bin/python -m tests.run_unit
  run .venv/bin/python -m tests.integration_alerts
  run .venv/bin/python -m tests.integration_lifecycle
  run .venv/bin/python -m tests.integration_api ) || fail=1

step "前端 check / unit / build"
( cd "$ROOT/web"
  run ./node_modules/.bin/vp check
  run ./node_modules/.bin/vp test run
  run ./node_modules/.bin/vp build
  if grep -rqE "unpkg\.com|fonts\.googleapis|fonts\.gstatic" dist/; then echo "  ✗ dist 含 CDN 引用"; fail=1; else echo "  ✓ dist 无 CDN 引用"; fi ) || fail=1

if [[ "$QUICK" -eq 0 ]]; then
  step "e2e（fixtures 模式）"
  ( cd "$ROOT/web" && run ./node_modules/.bin/playwright test ) || fail=1
fi

step "运行面"
if curl -fsS -m 5 http://127.0.0.1:8001/api/health >/tmp/crisis-health.json 2>/dev/null; then
  python3 - <<'PY' || fail=1
import json,sys
d=json.load(open('/tmp/crisis-health.json'))
bad=[s['source'] for s in d['sources'] if s['status']=='error']
print(f"  pipeline={d['pipeline_status']} watch_points={d['watch_points']} warnings={[w['code'] for w in d['warnings']]} error_sources={bad}")
sys.exit(0 if d['pipeline_status']!='down' else 1)
PY
else
  echo "  ! API 8001 未运行（跳过运行面检查；./start.sh 可启动）"
fi

step "文档口径"
# 允许：Windows 小节，以及同一行同时给出 macOS 口径（5180/8001）的对比说明
if rg -n "D:\\\\crisis|5173|8000" "$ROOT/README.md" "$ROOT/AGENTS.md" | rg -v "Windows|windows|5180|8001" >/dev/null; then
  echo "  ✗ README/AGENTS 出现非 Windows 小节的旧口径"; fail=1
else
  echo "  ✓ README/AGENTS 口径一致"
fi

[[ "$fail" -eq 0 ]] && printf '\n\033[32mALL PASS\033[0m\n' || printf '\n\033[31mFAILED\033[0m\n'
exit "$fail"
