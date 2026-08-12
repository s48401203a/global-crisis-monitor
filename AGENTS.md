# 全球综合危机监测系统 · Agent 指南

## 先读这些

1. [项目进度记录.md](./项目进度记录.md)：当前状态、唯一 TODO 清单、变更日志（必读）。
2. `D:\AI\Grok\0811\全球综合危机监测系统-开发执行规格-claude-opus-5.html`：权威规格；先读第 00、02、11 章。
3. `D:\AI\Grok\0811\全球综合危机监测系统-项目评审报告-claude-opus-5.html`：当前缺陷及任务分派。
4. 修改 `web/` 前，再读 `web/AGENTS.md`（Vite+ 操作约定）。

## 项目结构

- `app/app/`：FastAPI、APScheduler、采集器和告警逻辑。
- `web/`：开发中的 MapLibre 中文大屏；`web/src/` 是前端唯一编辑源。
- `app/app/static/`：当前服务模式的静态兜底页面。它与 `web/` 仍未完成构建产物统一，不能把它当作前端主源。
- `setup/`：安装、建库、迁移和一次性维护脚本。
- `service/`：WinSW 服务定义；`crisis-api` 依赖 `postgresql-x64-17`。
- `pgdata/`、`logs/`、`backups/`、`secrets/`：运行数据、日志、备份和凭证；不要随意编辑或提交。

## 日常操作

```powershell
# 一键启动 / 停止
D:\crisis\启动.bat
D:\crisis\停止.bat

# 前端开发（在 D:\crisis\web）
vp dev --host --open
vp build
vp check
vp test

# 健康检查
Invoke-RestMethod http://127.0.0.1:8000/api/health
Invoke-RestMethod http://127.0.0.1:5173/api/health
```

- FastAPI：`http://127.0.0.1:8000`；Vite+：`http://localhost:5173`，代理 `/api` 和 `/ws` 到 8000。
- 修改后端或服务配置后，重启 `crisis-api`；修改前端优先在 5173 验收。
- 后端测试目录目前没有自动化测试；新增或修复后端行为时，应补对应测试或运行规格第 11 章中相关的实际验收命令。

## 不可违反的约束

- Windows 原生部署：不引入 Docker、Redis、NSSM、Celery、fiona、GeoPandas 或额外队列框架。
- 数据库访问保持同步 psycopg，FastAPI HTTP 端点使用 `def`，不要改为 `async def`。
- 服务必须维持 UTF-8 输出设置；所有含中文的文件读写显式使用 UTF-8。
- APScheduler 保持 UTC、`misfire_grace_time=3600`、`coalesce=True`、`max_instances=1`。
- 不泄露或提交 `PGSUPERPASS`、`.env`、`secrets/` 内凭证。
- 规格与运行环境冲突时，以规格为准；功能、缺陷或环境变更后，在 `项目进度记录.md` 的变更日志追加记录，并更新其 TODO 状态。

## 当前优先事项与边界

- 先处理 `项目进度记录.md` §9 的 P0 项：告警排除 war 基线、FIRMS 采集器接线、以及 `vp build` 到服务模式的前端产物统一。
- `web/` 和后端可并行，但不要在未协调时跨越文件边界：前端工作仅改 `web/`（以及明确要求的规格文档）；后端/运维工作改 `app/`、`setup/`、`service/`、`*.ps1`。
- `TASK-B1`（构建并交付 `dist`）是后端服务静态目录切换工作的前置条件；不要手动继续维护两份前端副本。
