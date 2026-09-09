#!/usr/bin/env bash
# 停止本项目 API + Vite。默认不停 PostgreSQL。
# 用法:
#   ./stop.sh
#   ./stop.sh --stop-postgres
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
LOG_DIR="$ROOT/logs"
API_PORT="${API_PORT:-8001}"
VITE_PORT="${VITE_PORT:-5180}"
STOP_PG=0
for a in "$@"; do
  case "$a" in
    --stop-postgres|-StopPostgres) STOP_PG=1 ;;
  esac
done

mkdir -p "$LOG_DIR"
log() { printf '[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*" | tee -a "$LOG_DIR/stop-script.log"; }

kill_pidfile() {
  local f="$1"
  if [[ -f "$f" ]]; then
    local pid
    pid="$(tr -d ' \n' < "$f" || true)"
    if [[ -n "${pid:-}" ]] && kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
      sleep 0.4
      kill -9 "$pid" 2>/dev/null || true
    fi
    rm -f "$f"
  fi
}

kill_port() {
  local port="$1"
  if command -v lsof >/dev/null 2>&1; then
    local pids
    pids="$(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)"
    if [[ -n "$pids" ]]; then
      # shellcheck disable=SC2086
      kill $pids 2>/dev/null || true
      sleep 0.3
      # shellcheck disable=SC2086
      kill -9 $pids 2>/dev/null || true
    fi
  fi
}

log "停止 API / Vite …"
kill_pidfile "$LOG_DIR/uvicorn.pid"
kill_pidfile "$LOG_DIR/vite.pid"
kill_pidfile "$ROOT/.vite-dev.pid"
kill_port "$API_PORT"
kill_port "$VITE_PORT"
# vp 可能留下父进程；按仓库路径收口
pkill -f "$ROOT/web/node_modules/.bin/vp dev" 2>/dev/null || true
pkill -f "$ROOT/web/node_modules/@voidzero-dev/vite-plus-core/dist/vite/node/cli.js dev" 2>/dev/null || true
rm -f "$ROOT/.vite-dev.url"

if [[ "$STOP_PG" -eq 1 ]]; then
  log "停止 postgresql@17 …"
  brew services stop postgresql@17 || true
fi

if [[ -x "$ROOT/app/.venv/bin/python" ]]; then
  (cd "$ROOT/app" && .venv/bin/python -m app.log_retention) || true
fi

log "已停止应用进程（Postgres 默认保持运行）"
echo "[stop] done"
