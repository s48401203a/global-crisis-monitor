# 全球综合危机监测中心 · Global Crisis Monitor

**Local-first dashboard for public crisis data.** Earthquakes, rainstorms, river floods, cyclones, wildfires, and conflict signals — ingested locally, shown on a Chinese/English MapLibre globe.

**公开数据、本机部署的危机大屏。** 地震、暴雨预警、河道洪水、气旋、野火、冲突信号在本地入库，用地图（平面 / 地球仪）查看。

[中文](#中文) · [English](#english) · [Deploy](./DEPLOY.md) · [PR](https://github.com/s48401203a/global-crisis-monitor/pull/1)

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

需要 Homebrew、PostgreSQL 17、PostGIS、Python 3.13、Node.js 20+。

```bash
git clone https://github.com/s48401203a/global-crisis-monitor.git
cd global-crisis-monitor
bash setup/macos-deploy.sh
./start.sh --open
./stop.sh
```

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

| 路径 | 说明 |
|------|------|
| `app/` | FastAPI、采集器、入库与严重度 |
| `web/` | MapLibre 前端 |
| `setup/` | 建库与 macOS / Windows 安装 |
| `start.sh` / `stop.sh` | macOS 启停 |
| `启动.bat` / `停止.bat` | Windows 启停 |

单测（无需 pytest）：

```bash
cd app && PYTHONUTF8=1 .venv/bin/python -m tests.run_unit
```

### 安全

- 仓库不含 `.env`、`secrets/`、`pgdata/`、日志
- 不要把数据库密码写进 issue / PR
- 若密码曾出现在聊天里，请在本机轮换 Postgres 密码

### 现状

本地演示可用。FIRMS 无密钥则关闭。根目录 Vite+ `vp staged` hook 仍缺 `vite.config.ts`，提交时需 `--no-verify`。欢迎 issue / PR。

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

Needs Homebrew, PostgreSQL 17, PostGIS, Python 3.13, Node.js 20+.

```bash
git clone https://github.com/s48401203a/global-crisis-monitor.git
cd global-crisis-monitor
bash setup/macos-deploy.sh
./start.sh --open
./stop.sh
```

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

| Path | Role |
|------|------|
| `app/` | FastAPI, collectors, ingest, severity |
| `web/` | MapLibre UI |
| `setup/` | Schema + macOS / Windows install |
| `start.sh` / `stop.sh` | macOS start / stop |
| `启动.bat` / `停止.bat` | Windows start / stop |

Unit tests (no pytest):

```bash
cd app && PYTHONUTF8=1 .venv/bin/python -m tests.run_unit
```

### Security

- `.env`, `secrets/`, `pgdata/`, and logs are not in git
- Do not paste database passwords into issues or PRs
- Rotate the Postgres password if it ever appeared in chat

### Status

Usable as a local demo. FIRMS stays off without a map key. The repo-root Vite+ `vp staged` hook still expects a root `vite.config.ts`, so commits use `--no-verify`. Issues and PRs are welcome.

### License

[MIT](./LICENSE) © 2026 [s48401203a](https://github.com/s48401203a)
