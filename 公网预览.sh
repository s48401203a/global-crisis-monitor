#!/usr/bin/env bash
# 将本机 API 8001（含构建产物）映射到 Cloudflare 快速隧道；需 ACCESS_TOKEN。
# 用法:
#   ./公网预览.sh
#   API_PORT=8001 ./公网预览.sh
# 关掉隧道: ./stop.sh  或  kill "$(cat logs/cloudflared.pid)"
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
LOG_DIR="$ROOT/logs"
# 默认映射 8001（后端 + 构建产物），不再暴露 Vite 开发服务器（HMR/源码映射不该上公网）
API_PORT="${API_PORT:-8001}"
VITE_URL="http://127.0.0.1:${API_PORT}"
if ! grep -qE '^ACCESS_TOKEN=.{8,}' "$ROOT/app/.env" 2>/dev/null; then
  echo "警告：app/.env 未设置 ACCESS_TOKEN，隧道期间任何人可读取全部事件。" >&2
  echo "      生成：openssl rand -hex 16 → 写入 ACCESS_TOKEN= 并重启 API（./stop.sh && ./start.sh）。" >&2
  if [[ "${ALLOW_OPEN_TUNNEL:-0}" != "1" ]]; then
    echo "      如确要无鉴权暴露，设置 ALLOW_OPEN_TUNNEL=1 再运行。" >&2; exit 1
  fi
fi
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
    echo "本机关机、断网或 ./stop.sh 后失效。访问需 ?token=<ACCESS_TOKEN> 或 X-Access-Token。"
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
