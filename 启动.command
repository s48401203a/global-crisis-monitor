#!/usr/bin/env bash
# 访达双击启动：PostgreSQL + FastAPI(8001) + Vite HMR(5180)，并打开浏览器。
# 终端等价：./start.sh --open
cd "$(dirname "$0")" || exit 1
echo
echo "  全球综合危机监测中心 · 启动"
echo
./start.sh --open
status=$?
echo
if [[ "$status" -ne 0 ]]; then
  echo "启动失败，退出码 $status。日志见 logs/start-script.log"
else
  echo "停止：双击「停止.command」或运行 ./stop.sh"
fi
echo
read -r -p "按回车关闭此窗口…"
exit "$status"
