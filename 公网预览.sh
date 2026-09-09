#!/usr/bin/env bash
# 将本机 Vite（默认 5180）映射到 Cloudflare 快速隧道。
# 用法:
#   ./公网预览.sh
#   VITE_PORT=5180 ./公网预览.sh
# 关掉隧道: ./stop.sh  或  kill "$(cat logs/cloudflared.pid)"
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
LOG_DIR="$ROOT/logs"
VITE_PORT="${VITE_PORT:-5180}"
VITE_URL="http://127.0.0.1:${VITE_PORT}"
LOG="$LOG_DIR/cloudflared.out.log"
PIDFILE="$LOG_DIR/cloudflared.pid"
URLFILE="$LOG_DIR/public-url.txt"

mkdir -p "$LOG_DIR"

if ! command -v cloudflared >/dev/null 2>&1; then
  echo "缺少 cloudflared。macOS 安装: brew install cloudflared"
  exit 1
fi

if ! curl -fsS -o /dev/null --connect-timeout 2 "$VITE_URL"; then
  echo "本机 $VITE_URL 未就绪，先运行 ./start.sh"
  exit 1
fi

if [[ -f "$PIDFILE" ]]; then
  old="$(tr -d ' \n' < "$PIDFILE" || true)"
  if [[ -n "${old:-}" ]] && kill -0 "$old" 2>/dev/null; then
    echo "公网隧道已在运行 pid=$old"
    if [[ -f "$URLFILE" ]]; then
      echo "公网地址: $(tr -d ' \n' < "$URLFILE")"
    fi
    exit 0
  fi
  rm -f "$PIDFILE"
fi

: > "$LOG"
nohup cloudflared tunnel --no-autoupdate --url "$VITE_URL" >>"$LOG" 2>&1 &
echo $! > "$PIDFILE"

url=""
for _ in $(seq 1 50); do
  url="$(grep -Eo 'https://[a-zA-Z0-9.-]+\.trycloudflare\.com' "$LOG" | head -n 1 || true)"
  if [[ -n "$url" ]]; then
    printf '%s\n' "$url" > "$URLFILE"
    echo "公网地址: $url"
    echo "本机关机、断网或 ./stop.sh 后失效。演示无鉴权，勿广泛传播。"
    exit 0
  fi
  if ! kill -0 "$(tr -d ' \n' < "$PIDFILE")" 2>/dev/null; then
    echo "cloudflared 已退出，见 $LOG"
    tail -n 40 "$LOG" || true
    exit 1
  fi
  sleep 0.4
done

echo "未解析到公网 URL，见 $LOG"
tail -n 40 "$LOG" || true
exit 1
