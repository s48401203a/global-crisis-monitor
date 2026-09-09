#!/usr/bin/env bash
# macOS 开机自启（用户级 LaunchAgent）：仅托管 API 8001；PostgreSQL 由 brew services 托管。
# 用法: bash setup/install-launchd.sh            # 安装/更新并加载
#       bash setup/install-launchd.sh --uninstall
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LABEL=com.crisis.api
BK=com.crisis.backup
DEST="$HOME/Library/LaunchAgents/$LABEL.plist"
BKDEST="$HOME/Library/LaunchAgents/$BK.plist"
if [[ "${1:-}" == "--uninstall" ]]; then
  for l in "$LABEL" "$BK"; do launchctl bootout "gui/$(id -u)/$l" 2>/dev/null || true; done
  rm -f "$DEST" "$BKDEST"; echo "[launchd] 已卸载 $LABEL 与 $BK"; exit 0
fi
[[ -x "$ROOT/app/.venv/bin/python" ]] || { echo "缺少 app/.venv，请先运行 setup/macos-deploy.sh" >&2; exit 1; }
[[ -f "$ROOT/web/dist/index.html" ]] || echo "[launchd] 提示：web/dist 缺失，8001 将显示占位页；运行 ./start.sh 或 cd web && vp build"
mkdir -p "$ROOT/logs" "$HOME/Library/LaunchAgents"
sed "s#__ROOT__#$ROOT#g" "$ROOT/service/$LABEL.plist" > "$DEST"
# 每日备份（03:17）
sed "s#__ROOT__#$ROOT#g" "$ROOT/service/$BK.plist" > "$BKDEST"
launchctl bootout "gui/$(id -u)/$BK" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$BKDEST"
# API：若 8001 已被 start.sh 拉起的 uvicorn 占用，先停掉它，交给 launchd 托管
if lsof -nP -tiTCP:8001 -sTCP:LISTEN >/dev/null 2>&1; then
  echo "[launchd] 8001 已有进程（start.sh 启动的 uvicorn），停止后交由 launchd 托管"
  lsof -nP -tiTCP:8001 -sTCP:LISTEN | xargs kill 2>/dev/null || true; sleep 2
fi
launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$DEST"
launchctl kickstart -k "gui/$(id -u)/$LABEL"
sleep 6
if curl -fsS -o /dev/null http://127.0.0.1:8001/api/health; then
  echo "[launchd] $LABEL 已加载，API 8001 就绪；日志 logs/launchd-api.*.log"
else
  echo "[launchd] 已加载但 8001 未就绪，查看 logs/launchd-api.err.log" >&2; exit 1
fi
