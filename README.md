# 全球综合危机监测系统

Windows 本机部署的全球自然灾害 + 战争/冲突监测演示：公开数据源聚合 → PostgreSQL/PostGIS → 中文 Web 大屏（平面 / 地球仪）。

**本仓库不含数据库密码、`.env`、`secrets/`、`pgdata/` 等运行时凭证与数据。**

## 运行入口

- 前端开发：`http://localhost:5173`（Vite+，代理 `/api` `/ws` → 8000）
- 后端 API：`http://127.0.0.1:8000`

```powershell
# 一键启动 / 停止（本机已装 PostgreSQL 17 + 服务 crisis-api）
.\启动.bat
.\停止.bat
```

复制环境模板后自行填写密码：

```powershell
Copy-Item app\.env.example app\.env
```

## 目录

| 路径 | 说明 |
|------|------|
| `app/` | FastAPI + APScheduler + 采集器 |
| `web/` | 前端开发源（MapLibre） |
| `setup/` | 安装 / 建库脚本 |
| `service/` | WinSW 服务定义（不含 exe） |
| `AGENTS.md` | Agent 协作约定 |
| `项目进度记录.md` | 进度与 TODO |

## 安全

请勿提交 `PGSUPERPASS`、`app/.env`、`secrets/`。若密码曾出现在聊天或临时脚本中，请在本机轮换 Postgres 密码。
