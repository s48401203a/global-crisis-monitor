#!/usr/bin/env bash
# 按序号幂等执行 setup/0N-*.sql（05 建库除外），并记入 schema_migration。
# 用法: bash setup/migrate.sh            # 默认库 crisis，本机 127.0.0.1
#       PGDATABASE=crisis PGHOST=127.0.0.1 PGUSER=postgres bash setup/migrate.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PG_BIN="${PG_BIN:-/opt/homebrew/opt/postgresql@17/bin}"
[[ -x "$PG_BIN/psql" ]] || PG_BIN="$(dirname "$(command -v psql)")"
export PGHOST="${PGHOST:-127.0.0.1}" PGUSER="${PGUSER:-postgres}" PGDATABASE="${PGDATABASE:-crisis}"
# 密码优先来自 secrets/pg_superpass（macOS 部署写入），否则沿用 PGPASSWORD / .pgpass
if [[ -z "${PGPASSWORD:-}" && -f "$ROOT/secrets/pg_superpass" ]]; then
  export PGPASSWORD="$(tr -d '\n' < "$ROOT/secrets/pg_superpass")"
fi
psql() { "$PG_BIN/psql" -v ON_ERROR_STOP=1 -q "$@"; }

psql -c "CREATE TABLE IF NOT EXISTS schema_migration (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now());"
for f in "$ROOT"/setup/0[6-9]-*.sql "$ROOT"/setup/[1-9][0-9]-*.sql; do
  [[ -f "$f" ]] || continue
  name="$(basename "$f")"
  if psql -tA -c "SELECT 1 FROM schema_migration WHERE name='$name'" | grep -q 1; then
    echo "[migrate] skip  $name"
    continue
  fi
  echo "[migrate] apply $name"
  psql -f "$f"
  psql -c "INSERT INTO schema_migration(name) VALUES ('$name') ON CONFLICT DO NOTHING;"
done
echo "[migrate] done"
