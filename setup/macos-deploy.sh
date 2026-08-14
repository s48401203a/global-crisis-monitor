#!/usr/bin/env bash
# macOS 一键落地：PostgreSQL 17 + PostGIS + 建库 + Python venv + 前端依赖
# 不写入业务代码；密码只写 secrets/ 与 app/.env，不回显。
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP="$ROOT/app"
WEB="$ROOT/web"
LOG_DIR="$ROOT/logs"
SECRETS="$ROOT/secrets"
if [[ -z "${PG_BIN:-}" ]]; then
  if [[ -x /opt/homebrew/opt/postgresql@17/bin/psql ]]; then
    PG_BIN=/opt/homebrew/opt/postgresql@17/bin
  elif [[ -x /usr/local/opt/postgresql@17/bin/psql ]]; then
    PG_BIN=/usr/local/opt/postgresql@17/bin
  else
    PG_BIN=/opt/homebrew/opt/postgresql@17/bin
  fi
fi
export PATH="$HOME/.local/bin:$PG_BIN:/opt/homebrew/bin:/usr/local/bin:$PATH"

mkdir -p "$LOG_DIR" "$SECRETS" "$ROOT/backups"

echo "[macos-deploy] root=$ROOT"

if ! command -v brew >/dev/null 2>&1; then
  echo "[macos-deploy] 未找到 Homebrew" >&2
  exit 1
fi

if [[ ! -x "$PG_BIN/psql" ]]; then
  echo "[macos-deploy] 安装 postgresql@17 + postgis …"
  HOMEBREW_NO_AUTO_UPDATE=1 brew install postgresql@17 postgis
fi

if [[ ! -x "$PG_BIN/psql" ]]; then
  echo "[macos-deploy] 安装后仍找不到 $PG_BIN/psql" >&2
  exit 1
fi

if ! brew services list | awk '$1=="postgresql@17" && $2=="started"{found=1} END{exit !found}'; then
  echo "[macos-deploy] 启动 postgresql@17 …"
  brew services start postgresql@17
fi

echo "[macos-deploy] 等待 Postgres 就绪 …"
ok=0
for _ in $(seq 1 60); do
  if "$PG_BIN/pg_isready" -q; then
    ok=1
    break
  fi
  sleep 1
done
if [[ "$ok" -ne 1 ]]; then
  echo "[macos-deploy] Postgres 未就绪" >&2
  exit 1
fi

if [[ ! -f "$SECRETS/pg_superpass" ]]; then
  openssl rand -hex 16 > "$SECRETS/pg_superpass"
  chmod 600 "$SECRETS/pg_superpass"
  echo "[macos-deploy] 已生成 secrets/pg_superpass"
fi
PG_PASS="$(tr -d '\n' < "$SECRETS/pg_superpass")"

# Homebrew 默认超级用户是当前 macOS 用户；补齐 postgres 角色以兼容原 .env 约定
"$PG_BIN/psql" -d postgres -v ON_ERROR_STOP=1 <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'postgres') THEN
    CREATE ROLE postgres LOGIN SUPERUSER PASSWORD '${PG_PASS}';
  ELSE
    ALTER ROLE postgres WITH LOGIN SUPERUSER PASSWORD '${PG_PASS}';
  END IF;
END
\$\$;
SQL

if ! "$PG_BIN/psql" -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='crisis'" | grep -q 1; then
  echo "[macos-deploy] 创建数据库 crisis …"
  "$PG_BIN/psql" -d postgres -v ON_ERROR_STOP=1 -f "$ROOT/setup/03-create-db.sql"
else
  echo "[macos-deploy] 数据库 crisis 已存在，补扩展"
  "$PG_BIN/psql" -d crisis -v ON_ERROR_STOP=1 -c "CREATE EXTENSION IF NOT EXISTS postgis;"
  "$PG_BIN/psql" -d crisis -v ON_ERROR_STOP=1 -c "CREATE EXTENSION IF NOT EXISTS pg_trgm;"
  "$PG_BIN/psql" -d crisis -v ON_ERROR_STOP=1 -c "CREATE EXTENSION IF NOT EXISTS btree_gin;"
fi

if ! "$PG_BIN/psql" -d crisis -tAc "SELECT to_regclass('public.event')" | grep -q event; then
  echo "[macos-deploy] 写入 schema …"
  "$PG_BIN/psql" -d crisis -v ON_ERROR_STOP=1 -f "$ROOT/setup/05-schema.sql"
else
  echo "[macos-deploy] schema 已存在，跳过 05-schema.sql"
fi

# 用当前用户也能连库，便于本机排障
"$PG_BIN/psql" -d crisis -v ON_ERROR_STOP=1 -c "GRANT ALL PRIVILEGES ON DATABASE crisis TO postgres;"
"$PG_BIN/psql" -d crisis -v ON_ERROR_STOP=1 -c "GRANT ALL ON SCHEMA public TO postgres;"
"$PG_BIN/psql" -d crisis -v ON_ERROR_STOP=1 -c "GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres;"
"$PG_BIN/psql" -d crisis -v ON_ERROR_STOP=1 -c "GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres;"
"$PG_BIN/psql" -d crisis -v ON_ERROR_STOP=1 -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO postgres;"

if [[ ! -f "$APP/.env" ]]; then
  umask 077
  cat > "$APP/.env" <<ENV
DATABASE_URL=postgresql+psycopg://postgres:${PG_PASS}@127.0.0.1:5432/crisis
LOG_DIR=${LOG_DIR}
LOG_LEVEL=INFO
LOG_MAX_BYTES=524288000

ENABLE_USGS=true
ENABLE_GDACS=true
ENABLE_EMSC=true
ENABLE_EONET=true
ENABLE_GDELT=true
ENABLE_OPENMETEO=true
ENABLE_CMA=true
ENABLE_CENC=true
ENABLE_FIRMS=false
FIRMS_MAP_KEY=

INTERVAL_USGS=120
INTERVAL_GDACS=360
INTERVAL_EONET=900
INTERVAL_GDELT=900
INTERVAL_OPENMETEO=21600
INTERVAL_CMA=300
INTERVAL_CENC=180

ALERT_EQ_GLOBAL_MAG=6.0
ALERT_EQ_LOCAL_MAG=4.5
ALERT_MUTE_MINUTES=30
ALERT_CONFLICT_MIN_CONFIDENCE=0.7
ENV
  chmod 600 "$APP/.env"
  echo "[macos-deploy] 已写入 app/.env（已 gitignore）"
else
  echo "[macos-deploy] app/.env 已存在，不覆盖"
fi

if ! command -v uv >/dev/null 2>&1; then
  echo "[macos-deploy] 未找到 uv（期望在 PATH 或 ~/.local/bin）" >&2
  exit 1
fi
if [[ ! -x "$APP/.venv/bin/python" ]]; then
  echo "[macos-deploy] 创建 Python 3.13 venv …"
  (cd "$APP" && uv venv .venv --python 3.13)
fi
echo "[macos-deploy] 安装 Python 依赖 …"
uv pip install -r "$APP/requirements.txt" --python "$APP/.venv/bin/python"

echo "[macos-deploy] 后端单测 …"
(cd "$APP" && PYTHONUTF8=1 .venv/bin/python -m tests.run_unit)

echo "[macos-deploy] 导入国界（只入库，不覆盖仓库 50m 底图） …"
COUNTRIES_FILE="$APP/app/static/data/countries.geojson"
COUNTRIES_BAK="$(mktemp)"
restore_countries() {
  if [[ -s "${COUNTRIES_BAK:-}" ]]; then
    mv "$COUNTRIES_BAK" "$COUNTRIES_FILE"
  else
    rm -f "${COUNTRIES_BAK:-}"
  fi
}
trap restore_countries EXIT
if [[ -f "$COUNTRIES_FILE" ]]; then
  cp "$COUNTRIES_FILE" "$COUNTRIES_BAK"
fi
(cd "$APP" && PYTHONUTF8=1 .venv/bin/python setup/06-load-countries.py)
restore_countries
trap - EXIT

if [[ ! -d "$WEB/node_modules" ]]; then
  echo "[macos-deploy] 安装前端依赖 …"
  (cd "$WEB" && npx -y npm@12.0.2 install --allow-remote=all)
fi

echo "[macos-deploy] 验收数据库 …"
"$PG_BIN/psql" -d crisis -c "SELECT PostGIS_Full_Version();"
"$PG_BIN/psql" -d crisis -c "SELECT count(*) AS country_n FROM country;"
"$PG_BIN/psql" -d crisis -c "SELECT to_regclass('public.event') AS event_table;"

echo "[macos-deploy] 完成。下一步: $ROOT/start.sh --open"
echo "  前端: http://127.0.0.1:5173"
echo "  API : http://127.0.0.1:8000/api/health"
