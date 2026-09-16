# 全球综合危机监测中心 · Global Crisis Monitor

**Local-first dashboard for public crisis data.** Earthquakes, rainstorms, river floods, cyclones, wildfires, and conflict signals — ingested locally, shown on a Chinese/English MapLibre globe.

**公开数据、本机部署的危机大屏。** 地震、暴雨预警、河道洪水、气旋、野火、冲突信号在本地入库，用地图（平面 / 地球仪）查看。

[中文](#中文) · [English](#english) · [Deploy](./DEPLOY.md) · [GitHub](https://github.com/s48401203a/global-crisis-monitor)

> Public repo · No cloud account required for core sources · Credentials stay on your machine

作者 / Author: [s48401203a](https://github.com/s48401203a) · 协议 / License: [MIT](./LICENSE)

本项目为本地演示系统，不代表中央气象台、地震台网或任何政府机构。  
This is an unofficial local demo. Not affiliated with CMA, CENC, or any government agency.

---

## 中文

### 这是什么

把多家**公开接口**拉到本机 PostgreSQL / PostGIS，再用 FastAPI + MapLibre 做成可检索的监测大屏。适合本地演示、教学和二次开发，不是商业 SaaS。

核心判断：**气象暴雨预警不是河道洪水。** 中央气象台「暴雨红色」会标成「暴雨预警」；只有标题明确写山洪 / 洪水才进洪水图层。蓝、黄日常预警默认不显示，避免地图被小信号淹没。

### 能看到什么

- 平面图 ⇄ 地球仪过渡，地球仪带星空背景
- 信息框可拖动，贴边收成名称签
- 组合搜索：空格为且，`OR` 为或，`-词` 排除；可用 `类型:` `国家:` `来源:` `震级:>=`
- 中国城市用中文搜（杭州、河南），国外城市用英文搜（Tokyo、New York）
- 中央气象台只收橙 / 红；暴雨与洪水分开

### 数据源

| 源 | 内容 | 密钥 |
|---|---|---|
| USGS / EMSC | 全球地震 | 不需要 |
| GDACS / EONET | 灾害与观测事件 | 不需要 |
| GDELT | 冲突相关新闻信号 | 不需要 |
| 中央气象台 | 橙 / 红气象预警 | 不需要 |
| 中国地震台网（镜像） | 国内速报 M≥3 | 不需要 |
| Open-Meteo | 关注点径流（洪水） | 不需要 |
| NASA FIRMS | 近实时火点 | 需要 `FIRMS_MAP_KEY`，默认关 |

水利部水情接口本轮不可用，所以「河南有河洪、图上没有」通常不是过滤太严，而是没有水文源。

### 快速开始（macOS）

需要 Homebrew、PostgreSQL 17、PostGIS、Python 3.13、Node.js 20+。前端 `npm ci` 需要 **npm 12**（与 `package.json` 的 `devEngines` / CI 一致；本机若是 npm 10，先 `npm install -g npm@12.0.2` 或按 `.github/workflows/ci.yml`）。

```bash
git clone https://github.com/s48401203a/global-crisis-monitor.git
cd global-crisis-monitor
bash setup/macos-deploy.sh
./start.sh --open
./stop.sh
```

访达也可双击仓库根目录的 `启动.command` / `停止.command`。

| 地址 | 用途 |
|------|------|
| http://127.0.0.1:5180 | 开发界面（Vite HMR，`/api` `/ws` 代理到 8001） |
| http://127.0.0.1:8001 | API；也可挂 `web/dist` |

本仓库 macOS 开发默认 **5180 / 8001**（避开本机常见的 5173 / 8000）。可用 `VITE_PORT` / `API_PORT` 覆盖。

密码只写在 `app/.env` 和 `secrets/pg_superpass`，不要提交。模板：

```bash
cp app/.env.example app/.env
```

### 快速开始（Windows）

```powershell
git clone https://github.com/s48401203a/global-crisis-monitor.git
Copy-Item app\.env.example app\.env
.\启动.bat
.\停止.bat
```

换机完整步骤见 [DEPLOY.md](./DEPLOY.md)。

### 架构

```text
公开 API  ──►  采集器（APScheduler）  ──►  PostGIS event
                                              │
中文/英文大屏  ◄──  MapLibre  ◄──  FastAPI /api/events
```

API（v2，均为只读 GET；列表支持 gzip 与 ETag）：

| 端点 | 说明 |
|------|------|
| `/api/events?hours&since_seq&cursor&since&ids&bbox&types&category&min_severity&fields=summary\|full&limit` | GeoJSON 事件；按 `change_seq` 稳定分页。截断时必须续读 `next_cursor`。增量用 `since_seq`。对账 `GET /api/events/reconcile` 返回版本；内容落后则 `ids=` 补拉，不得用全局 `high_water` 推进游标 |
| `/api/events/{id}` | 详情 + observations + alerts |
| `/api/alerts?since&rule&limit` | 告警历史 |
| `/api/stats?hours&bbox` | 按类型/国家分桶，聚合信号与真实事件分列 |
| `/api/theaters` | 战区基线层（编辑维护，不计入事件） |
| `/api/health` · `/api/meta` | 源健康与 `pipeline_status`；类型/来源字典 |
| `POST /api/ws-ticket` | 短期 WebSocket 票据；`/ws?ticket=`（避免长期令牌进访问日志） |
| `ws://…/ws` | 主题消息：`alert` · `events.changed` · `pipeline.status` |

| 路径 | 说明 |
|------|------|
| `app/` | FastAPI、采集器、入库与严重度 |
| `web/` | MapLibre 前端 |
| `setup/` | 建库与 macOS / Windows 安装 |
| `start.sh` / `stop.sh` | macOS 终端启停 |
| `启动.command` / `停止.command` | macOS 访达双击启停 |
| `启动.bat` / `停止.bat` | Windows 启停 |

单测（无需 pytest）：

```bash
cd app && PYTHONUTF8=1 .venv/bin/python -m tests.run_unit
```

单测不需要 `app/.env` 或业务库。无后端时可用合成夹具看界面：`http://127.0.0.1:5180/?fixtures=test`。

### 数据语义与同步（维护者）

| 概念 | 行为 |
|---|---|
| `severity` | **当前**严重度，权威源降级时可以下降；列表/计数/告警用这个 |
| `severity_peak` | **历史峰值**，只升不降，不参与前端计数 |
| 分页 | `change_seq` 升序；`truncated` 时必须带 `next_cursor` 续读，不得用截断页的 `server_time` / 全局 `high_water` 当水位 |
| 增量 | `since_seq`；含 deleted/closed，不按 `occurred_at` 过滤 |
| 删除 | 对账集合里没有的 id，客户端丢掉 |
| 关闭 | `status=closed` 仍可在时间窗口内显示；对账 `versions` 带 status，落后则 `ids=` 补拉 |
| 时间窗口 | 按事件 `occurred_at`；滑出窗口后从本地 store 淘汰 |
| 对账 | `GET /api/events/reconcile` 比 `{id,change_seq,status}`，不是只比 id 集合 |

调度（尝试间隔，**不是恢复时限**）：HTTP 增量约 20s；对账约 60s；WebSocket 打开约 1.5s 后再进入 60s；分页截断时立即对账。对账或补拉失败会保持旧游标，直到某次成功。增量 `change_seq` 在语句时分配、提交后才可见，**不保证固定时间内追上**。

排障：

| 现象 | 先看 |
|---|---|
| 顶栏红 / `pipeline_status=down\|degraded` | `/api/health` 的 `proxy`、`last_error`、`last_ingest_status`（`failed`/`partial`/`empty`）；失效代理用 `HTTP_PROXY_MODE=direct` |
| 弹出令牌或 WS 立刻断开 | `ACCESS_TOKEN`；取消输入会停止重试；错令牌会清会话再问；过期票据 4403 会静默换票 |
| 地图有旧内容、源已更新 | 等对账或切时间窗口触发完整快照；补拉失败时游标不会前进，看浏览器控制台 `reconcile failed` |
| 库是空的 / 启动后无点 | 采集器要联网；`/?fixtures=test` 只验证 UI；FIRMS 无 key 默认关 |

升级已有库：`bash setup/migrate.sh`（`10-reliability.sql`）。回滚：停服务后 `./backup.sh --restore backups/<dump>`。合并本 PR **不会**自动迁移业务库。

### 运维（macOS）

```bash
bash scripts/verify.sh            # 一键验收（单测 / 集成 / 前端 / e2e / 运行面）
bash setup/install-launchd.sh     # 开机自启 API + 每日 03:17 pg_dump（--uninstall 卸载）
./backup.sh                       # 手动备份；./backup.sh --restore backups/xxx.dump 恢复
```

### 安全

- 仓库不含 `.env`、`secrets/`、`pgdata/`、日志
- 不要把数据库密码写进 issue / PR
- 若密码曾出现在聊天里，请在本机轮换 Postgres 密码
- 公网隧道前在 `app/.env` 设置 `ACCESS_TOKEN`：非本机请求必须带 `X-Access-Token`（或 `?token=`）；`公网预览.sh` 会拒绝无令牌开放

### 现状与公开事实

- 定位：本机演示 / 教学 / 二次开发，**不是**官方预警、不是 SaaS、没有公布用户量或准确率。
- 能力：公开源采集 + PostGIS + MapLibre 大屏；鉴权可选；增量 + 版本对账（最终一致，见上表）。
- 维护：公开仓库 [s48401203a/global-crisis-monitor](https://github.com/s48401203a/global-crisis-monitor)；PR [#2](https://github.com/s48401203a/global-crisis-monitor/pull/2) 含 2026-09 可靠性工作；CI 作业见 `.github/workflows/ci.yml`。
- 证据：`CHANGELOG.md`、`docs/adr/0004-sync-auth-verify.md`、`scripts/verify.sh`。
- 路线图：`projecttodo.md` 开放待办（合并后部署验证 → 运行稳定性 → 开源维护）。瓦片缓存 / Telegram / 新数据源仍是可选，不是现有能力。
- 协作：可协助核对 `verify.sh`、隔离库集成测试、文档与 PR；不自动 merge、不部署生产、不代提外部申请。

数据与运行时来自各公开接口及 [MapLibre GL](https://maplibre.org/)；国界等静态数据随仓库提供。各自条款以源站为准。

### 许可

[MIT](./LICENSE) © 2026 [s48401203a](https://github.com/s48401203a)

---

## English

### What this is

A **local-first** monitor that pulls **public APIs** into PostgreSQL / PostGIS and renders them on a MapLibre dashboard (flat map or globe). Built for local demos, teaching, and forks — not a hosted SaaS.

The important rule: **a CMA rainstorm warning is not a river flood.** A red rainstorm signal is typed as `rainstorm`. Only headlines that say flash flood / flood become `flood`. Blue and yellow routine alerts are hidden so the map stays readable.

### Features

- Smooth flat ⇄ globe transition with a starfield on the globe
- Dockable panels that collapse into name tabs at the window edge
- Combo search: space = AND, `OR`, `-term` to exclude; fields such as `type:` `country:` `source:` `mag:>=`
- Chinese place search inside China; English place names elsewhere
- CMA orange/red only; rainstorms and floods are separate layers

### Data sources

| Source | What you get | API key |
|---|---|---|
| USGS / EMSC | Global earthquakes | No |
| GDACS / EONET | Hazard / earth observation events | No |
| GDELT | Conflict-related news signals | No |
| China Meteorological Administration | Orange / red weather alerts | No |
| CENC (mirror) | China quakes M≥3 | No |
| Open-Meteo | Watch-point river discharge | No |
| NASA FIRMS | Near-real-time fire pixels | `FIRMS_MAP_KEY`, off by default |

China’s Ministry of Water Resources feed is not wired in this release, so a local river flood may be absent even when weather alerts exist.

### Quick start (macOS)

Needs Homebrew, PostgreSQL 17, PostGIS, Python 3.13, Node.js 20+. Frontend `npm ci` expects **npm 12** (see `devEngines` / CI). If your npm is 10, install npm 12 first.

```bash
git clone https://github.com/s48401203a/global-crisis-monitor.git
cd global-crisis-monitor
bash setup/macos-deploy.sh
./start.sh --open
./stop.sh
```

Or double-click `启动.command` / `停止.command` in Finder.

| URL | Role |
|------|------|
| http://127.0.0.1:5180 | Dev UI (Vite HMR; `/api` `/ws` proxied to 8001) |
| http://127.0.0.1:8001 | API; can also serve `web/dist` |

macOS defaults are **5180 / 8001** (to stay off the usual 5173 / 8000). Override with `VITE_PORT` / `API_PORT`.

Put passwords only in `app/.env` and `secrets/pg_superpass`. Never commit them.

```bash
cp app/.env.example app/.env
```

### Quick start (Windows)

```powershell
git clone https://github.com/s48401203a/global-crisis-monitor.git
Copy-Item app\.env.example app\.env
.\启动.bat
.\停止.bat
```

Full machine-to-machine steps: [DEPLOY.md](./DEPLOY.md).

### Architecture

```text
Public APIs  ──►  Collectors (APScheduler)  ──►  PostGIS `event`
                                                    │
Dashboard     ◄──  MapLibre  ◄──  FastAPI `/api/events`
```

API (v2, read-only GET; lists are gzip + ETag):

| Endpoint | Role |
|------|------|
| `/api/events?hours&since_seq&cursor&since&ids&bbox&types&category&min_severity&fields=summary\|full&limit` | GeoJSON events; stable `change_seq` pages. Reconcile returns per-id versions; refetch with `ids=` when content is behind. Never advance the cursor to global `high_water` |
| `/api/events/{id}` | Detail + observations + alerts |
| `/api/alerts?since&rule&limit` | Alert history |
| `/api/stats?hours&bbox` | Buckets by type/country; aggregates split from real events |
| `/api/theaters` | Editorial conflict theaters (not events) |
| `/api/health` · `/api/meta` | Source health with `pipeline_status`; type/source dictionary |
| `POST /api/ws-ticket` | Short-lived WebSocket ticket; connect with `/ws?ticket=` |
| `ws://…/ws` | Topics: `alert` · `events.changed` · `pipeline.status` |

| Path | Role |
|------|------|
| `app/` | FastAPI, collectors, ingest, severity |
| `web/` | MapLibre UI |
| `setup/` | Schema + macOS / Windows install |
| `start.sh` / `stop.sh` | macOS terminal start / stop |
| `启动.command` / `停止.command` | macOS Finder double-click start / stop |
| `启动.bat` / `停止.bat` | Windows start / stop |

Unit tests (no pytest):

```bash
cd app && PYTHONUTF8=1 .venv/bin/python -m tests.run_unit
```

Unit tests do not need `app/.env` or a live database. UI without a backend: `http://127.0.0.1:5180/?fixtures=test`.

### Semantics and sync (maintainers)

| Concept | Behavior |
|---|---|
| `severity` | **Current** severity; may fall when the authoritative source downgrades. Counts and alerts use this. |
| `severity_peak` | **Historical peak**; never decreases; not used in UI counts |
| Pagination | `change_seq` ascending; follow `next_cursor` while `truncated`; never treat truncated `server_time` or global `high_water` as a watermark |
| Incremental | `since_seq`; includes deleted/closed; no `occurred_at` filter |
| Delete | IDs absent from the reconcile set are dropped on the client |
| Close | `status=closed` can remain in the time window; versions include status; refetch via `ids=` if behind |
| Time window | Filter on `occurred_at`; events that slide out are pruned from the local store |
| Reconcile | Compare `{id,change_seq,status}`, not the ID set alone |

Schedule (attempt interval, **not** a recovery SLA): HTTP incremental ~20s; reconcile ~60s; ~1.5s after WebSocket open then 60s; immediate reconcile if a page is truncated. Failed reconcile/refetch keeps the old cursor. `change_seq` is assigned at statement time, visible after commit — **no guaranteed catch-up deadline**.

Troubleshooting: `/api/health` (`proxy`, `last_error`, `last_ingest_status`); `HTTP_PROXY_MODE=direct` if a stale proxy is set; access token cancel stops retries; `reconcile failed` in the console means the cursor did not advance. Upgrade: `bash setup/migrate.sh`. Rollback: `./backup.sh --restore`. Merging this PR does **not** migrate the business database.

### Operations (macOS)

```bash
bash scripts/verify.sh            # one-shot acceptance (unit / integration / frontend / e2e / runtime)
bash setup/install-launchd.sh     # login item for the API + daily 03:17 pg_dump (--uninstall to remove)
./backup.sh                       # manual backup; ./backup.sh --restore backups/xxx.dump
```

### Security

- `.env`, `secrets/`, `pgdata/`, and logs are not in git
- Do not paste database passwords into issues or PRs
- Rotate the Postgres password if it ever appeared in chat
- Before exposing a tunnel set `ACCESS_TOKEN` in `app/.env`: non-local requests must send `X-Access-Token` (or `?token=`); `公网预览.sh` refuses to open an unauthenticated tunnel

### Status and public facts

- Local demo / teaching / forks — **not** an official warning service, not SaaS. No published user counts or accuracy claims.
- Capabilities: public-source ingest, PostGIS, MapLibre UI, optional access token, incremental sync plus versioned reconcile (eventual consistency; see table above).
- Maintenance: public repo [s48401203a/global-crisis-monitor](https://github.com/s48401203a/global-crisis-monitor); PR [#2](https://github.com/s48401203a/global-crisis-monitor/pull/2); CI in `.github/workflows/ci.yml`.
- Evidence: `CHANGELOG.md`, `docs/adr/0004-sync-auth-verify.md`, `scripts/verify.sh`.
- Roadmap: open items in `projecttodo.md`. Tile cache / Telegram / extra sources are optional, not shipped.
- Assist: `verify.sh`, isolated-DB integration tests, docs and PRs. No auto-merge, production deploy, or third-party applications.

Runtime data come from the listed public APIs and [MapLibre GL](https://maplibre.org/). Static borders ship in-tree. Each source keeps its own terms.

### License

[MIT](./LICENSE) © 2026 [s48401203a](https://github.com/s48401203a)
