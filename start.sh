#!/usr/bin/env bash
# 一键启动：PostgreSQL + FastAPI(8000) + Vite HMR(5173)
# 用法:
#   ./start.sh           # 启动并打开浏览器
#   ./start.sh --no-open # 只启动不打开
#   API_PORT=8000 VITE_PORT=5173 ./start.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
APP="$ROOT/app"
WEB="$ROOT/web"
LOG_DIR="$ROOT/logs"
if [[ -z "${PG_BIN:-}" ]]; then
  if [[ -x /opt/homebrew/opt/postgresql@17/bin/psql ]]; then
    PG_BIN=/opt/homebrew/opt/postgresql@17/bin
  elif [[ -x /usr/local/opt/postgresql@17/bin/psql ]]; then
    PG_BIN=/usr/local/opt/postgresql@17/bin
  else
    PG_BIN=/opt/homebrew/opt/postgresql@17/bin
  fi
fi
export PATH="$HOME/.local/bin:$PG_BIN:/opt/homebrew/bin:/usr/local/bin:$APP/.venv/bin:$WEB/node_modules/.bin:$PATH"
export PYTHONUTF8=1
export PYTHONUNBUFFERED=1

API_PORT="${API_PORT:-8000}"
VITE_PORT="${VITE_PORT:-5173}"
API_URL="http://127.0.0.1:${API_PORT}"
VITE_URL="http://127.0.0.1:${VITE_PORT}"
OPEN_BROWSER=1
for a in "$@"; do
  case "$a" in
    --no-open) OPEN_BROWSER=0 ;;
    --open) OPEN_BROWSER=1 ;;
  esac
done

mkdir -p "$LOG_DIR"
LOCK_DIR="$LOG_DIR/start.lock"
if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  echo "[start] 另一个 start.sh 正在执行，避免重复拉起 Vite"
  exit 0
fi
trap 'rmdir "$LOCK_DIR" 2>/dev/null || true' EXIT

log() { printf '[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*" | tee -a "$LOG_DIR/start-script.log"; }

port_in_use() {
  lsof -nP -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1
}

wait_http() {
  local url="$1" tries="${2:-40}"
  local i
  for i in $(seq 1 "$tries"); do
    if curl -fsS -o /dev/null --connect-timeout 1 "$url" 2>/dev/null; then
      return 0
    fi
    sleep 1
  done
  return 1
}

if [[ ! -f "$APP/.env" || ! -x "$APP/.venv/bin/python" ]]; then
  log "环境未就绪，先执行 setup/macos-deploy.sh"
  bash "$ROOT/setup/macos-deploy.sh"
fi

if [[ ! -x "$PG_BIN/pg_isready" ]]; then
  log "找不到 PostgreSQL 17：$PG_BIN/pg_isready"
  exit 1
fi

if ! "$PG_BIN/pg_isready" -q; then
  log "启动 postgresql@17 …"
  brew services start postgresql@17
  for _ in $(seq 1 40); do
    "$PG_BIN/pg_isready" -q && break
    sleep 1
  done
fi
if ! "$PG_BIN/pg_isready" -q; then
  log "PostgreSQL 未能就绪"
  exit 1
fi
log "PostgreSQL 已就绪"

if port_in_use "$API_PORT"; then
  log "API 端口 $API_PORT 已在监听，复用"
else
  log "启动 uvicorn :$API_PORT …"
  (
    cd "$APP"
    nohup .venv/bin/python -m uvicorn app.main:app \
      --host 127.0.0.1 --port "$API_PORT" --workers 1 \
      >>"$LOG_DIR/uvicorn-console.out.log" 2>>"$LOG_DIR/uvicorn-console.err.log" &
    echo $! > "$LOG_DIR/uvicorn.pid"
  )
fi

if ! wait_http "$API_URL/api/health" 90; then
  log "后端健康检查失败，见 $LOG_DIR/uvicorn-console.err.log 与 $LOG_DIR/app.log"
  tail -n 40 "$LOG_DIR/uvicorn-console.err.log" 2>/dev/null || true
  exit 1
fi
log "后端可用 $API_URL/api/health"

if [[ ! -d "$WEB/node_modules" ]]; then
  log "安装前端依赖 …"
  (cd "$WEB" && npx -y npm@12.0.2 install --allow-remote=all)
fi

if [[ ! -f "$WEB/dist/index.html" ]]; then
  log "web/dist 缺失，执行 vp build …"
  if [[ -x "$WEB/node_modules/.bin/vp" ]]; then
    (cd "$WEB" && "$WEB/node_modules/.bin/vp" build)
  else
    (cd "$WEB" && "$WEB/node_modules/.bin/vite" build)
  fi
fi

record_listen_pid() {
  local port="$1" dest="$2"
  local pid
  pid="$(lsof -nP -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null | head -n 1 || true)"
  if [[ -n "${pid:-}" ]]; then
    echo "$pid" > "$dest"
  fi
}

if port_in_use "$VITE_PORT"; then
  log "Vite 端口 $VITE_PORT 已在监听，复用"
  record_listen_pid "$VITE_PORT" "$LOG_DIR/vite.pid"
  cp "$LOG_DIR/vite.pid" "$ROOT/.vite-dev.pid" 2>/dev/null || true
else
  log "启动 Vite HMR :$VITE_PORT …"
  (
    cd "$WEB"
    if [[ -x "$WEB/node_modules/.bin/vp" ]]; then
      nohup "$WEB/node_modules/.bin/vp" dev --host 127.0.0.1 --port "$VITE_PORT" \
        >>"$LOG_DIR/vite-dev.out.log" 2>>"$LOG_DIR/vite-dev.err.log" &
    else
      nohup "$WEB/node_modules/.bin/vite" --host 127.0.0.1 --port "$VITE_PORT" \
        >>"$LOG_DIR/vite-dev.out.log" 2>>"$LOG_DIR/vite-dev.err.log" &
    fi
    echo $! > "$LOG_DIR/vite.pid"
    echo $! > "$ROOT/.vite-dev.pid"
  )
fi

if ! wait_http "$VITE_URL" 40; then
  log "Vite 未就绪（开发主入口失败）"
  exit 1
fi
record_listen_pid "$VITE_PORT" "$LOG_DIR/vite.pid"
cp "$LOG_DIR/vite.pid" "$ROOT/.vite-dev.pid" 2>/dev/null || true
record_listen_pid "$API_PORT" "$LOG_DIR/uvicorn.pid"

echo "$VITE_URL" > "$ROOT/.vite-dev.url"
log "前端可用 $VITE_URL"
if [[ "$OPEN_BROWSER" -eq 1 ]] && command -v open >/dev/null 2>&1; then
  open "$VITE_URL" || true
fi

echo
echo "启动完成"
echo "  开发预览(HMR): $VITE_URL"
echo "  后端 API:       $API_URL/api/health"
echo "  停止:           $ROOT/stop.sh"
