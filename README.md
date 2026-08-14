# 全球综合危机监测系统

Windows / macOS 本机部署的全球自然灾害 + 战争/冲突监测演示：公开数据源聚合 → PostgreSQL/PostGIS → 中文 Web 大屏（平面 / 地球仪）。

数据源包括 USGS / GDACS / EONET / GDELT、中央气象台预警、中国地震台网速报等。暴雨预警与河道洪水分开显示；蓝/黄日常预警默认不展示。

**本仓库不含数据库密码、`.env`、`secrets/`、`pgdata/` 等运行时凭证与数据。**

## 运行入口

- 前端开发：`http://127.0.0.1:5180`（Vite+，代理 `/api` `/ws` → 8001）
- 后端 API：`http://127.0.0.1:8001`

```powershell
# 一键启动 / 停止（本机已装 PostgreSQL 17 + 服务 crisis-api）
.\启动.bat
.\停止.bat
```

复制环境模板后自行填写密码：

```powershell
Copy-Item app\.env.example app\.env
```

完整换机部署步骤见 [DEPLOY.md](./DEPLOY.md)。终审报告见 [docs/终审报告-grok-4.5.html](./docs/终审报告-grok-4.5.html)。

## macOS 本机部署

规格原文按 Windows 锁定；本仓库在 macOS 上用 Homebrew PostgreSQL 17 + PostGIS，不用 Docker / WinSW。

```bash
bash setup/macos-deploy.sh
./start.sh --open
./stop.sh
```

| 地址 | 说明 |
|------|------|
| http://127.0.0.1:5180 | 开发主界面（Vite HMR，`/api` `/ws` 代理到 8001） |
| http://127.0.0.1:8001 | 后端 API + `web/dist` 静态页 |

密码只写在 `app/.env` 与 `secrets/pg_superpass`，不要提交。

本机 5173 / 8000 已被占用时，脚本会改用 **5180 / 8001**。

## 主要界面能力

- 平面图 ⇄ 地球仪过渡；地球仪有星空背景
- 信息框可拖动，贴边收起为名称签
- 组合关键字搜索（且 / OR / 排除 / 字段）；中国城市中文、国外城市英文
- 中央气象台橙/红预警：暴雨归「暴雨预警」，仅山洪/洪水归「洪水」

## 目录

| 路径 | 说明 |
|------|------|
| `app/` | FastAPI + APScheduler + 采集器 |
| `web/` | 前端开发源（MapLibre） |
| `setup/` | 安装 / 建库脚本 |
| `setup/macos-deploy.sh` | macOS 一键落地（Homebrew PostgreSQL 17 + PostGIS） |
| `start.sh` / `stop.sh` | macOS 一键启动 / 停止 |
| `service/` | WinSW 服务定义（不含 exe） |
| `AGENTS.md` | Agent 协作约定 |
| `项目进度记录.md` | 进度与 TODO |

## 安全

请勿提交 `PGSUPERPASS`、`app/.env`、`secrets/`。若密码曾出现在聊天或临时脚本中，请在本机轮换 Postgres 密码。
