#!/usr/bin/env bash
# 每日 pg_dump（自定义格式，可 pg_restore），保留最近 N 份。
# 用法: ./backup.sh              # 备份到 backups/crisis-YYYYmmdd-HHMM.dump
#       KEEP=14 ./backup.sh      # 保留 14 份
#       ./backup.sh --restore backups/xxx.dump   # 恢复到当前库（先确认！）
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
PG_BIN="${PG_BIN:-/opt/homebrew/opt/postgresql@17/bin}"
[[ -x "$PG_BIN/pg_dump" ]] || PG_BIN="$(dirname "$(command -v pg_dump)")"
export PGHOST="${PGHOST:-127.0.0.1}" PGUSER="${PGUSER:-postgres}" PGDATABASE="${PGDATABASE:-crisis}"
if [[ -z "${PGPASSWORD:-}" && -f "$ROOT/secrets/pg_superpass" ]]; then
  export PGPASSWORD="$(tr -d '\n' < "$ROOT/secrets/pg_superpass")"
fi
KEEP="${KEEP:-7}"
mkdir -p "$ROOT/backups"
if [[ "${1:-}" == "--restore" ]]; then
  f="${2:?用法: ./backup.sh --restore <dump>}"
  echo "将把 $f 恢复到 $PGDATABASE（--clean --if-exists）。5 秒内 Ctrl-C 取消。"; sleep 5
  "$PG_BIN/pg_restore" --clean --if-exists --no-owner -d "$PGDATABASE" "$f"
  echo "[backup] 恢复完成"; exit 0
fi
out="$ROOT/backups/crisis-$(date +%Y%m%d-%H%M).dump"
"$PG_BIN/pg_dump" -Fc -f "$out"
"$PG_BIN/pg_restore" --list "$out" >/dev/null
echo "[backup] $(du -h "$out" | cut -f1) $out"
# 只轮转本脚本产出的 crisis-*.dump，不动 pre-phase* 等手工备份
skip=$((KEEP + 1))
ls -1t "$ROOT"/backups/crisis-*.dump 2>/dev/null | tail -n "+$skip" | while read -r f; do rm -f "$f"; done
echo "[backup] 保留 $(ls -1 "$ROOT"/backups/crisis-*.dump | wc -l | tr -d ' ') 份（KEEP=${KEEP}）"
