#!/usr/bin/env bash
# 访达双击停止：API + Vite + 隧道。默认不停 PostgreSQL。
# 终端等价：./stop.sh
cd "$(dirname "$0")" || exit 1
echo
echo "  全球综合危机监测中心 · 停止"
echo
./stop.sh
status=$?
echo
if [[ "$status" -ne 0 ]]; then
  echo "停止过程出现问题，退出码 $status。日志见 logs/stop-script.log"
else
  echo "已停止。再次启动：双击「启动.command」或运行 ./start.sh --open"
fi
echo
read -r -p "按回车关闭此窗口…"
exit "$status"
