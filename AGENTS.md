# 全球综合危机监测中心 · Agent 指南

## 先读这些（都在仓库内）

1. [README.md](./README.md)：定位、数据源、快速开始、架构。
2. [DEPLOY.md](./DEPLOY.md)：macOS（主）与 Windows 部署步骤。
3. [projecttodo.md](./projecttodo.md)：开放待办与变更日志；每次功能改动、修 bug、环境变更后**在文末追加一条**（日期 + 模型名 + 摘要）。
4. [docs/项目评审与改造方案-fable-5.1.html](./docs/项目评审与改造方案-fable-5.1.html)：2026-09 评审结论、问题编号（D-01…）与五阶段改造路线；执行 Phase N 前先读第 04/05 章。
5. 修改 `web/` 前再读 `web/AGENTS.md`（Vite+ 操作约定）。

历史文档（`项目进度记录.md`、`交付报告-grok-4.5.md`、`docs/终审报告-grok-4.5.html`）为 2026-08 Windows 阶段记录，只作溯源，不再是操作依据。

## 项目结构

- `app/app/`：FastAPI、APScheduler、采集器、入库与告警。`net.py` 出站代理策略；`core/sources.py` 数据源注册表（健康阈值、中英文名）。
- `web/`：MapLibre 大屏；`web/src/` 是前端唯一编辑源；`web/dist/` 由 `vp build` 生成、不入库，后端挂载它。
- `app/app/static/data/`：后端提供的国界数据；`app/app/placeholder/`：dist 缺失时的占位页。
- `setup/`：建库 SQL、`macos-deploy.sh`、Windows 安装脚本（`setup/windows/`）、一次性维护脚本（`setup/oneoff/`，已完成任务，勿再运行）。
- `service/`：Windows WinSW 服务定义。
- `logs/`、`backups/`、`secrets/`、`app/.env`：运行数据与凭证，不提交。

## 日常操作（macOS，默认端口 5180 / 8001）

```bash
./start.sh --open        # PostgreSQL + uvicorn :8001 + Vite HMR :5180；dist 落后源码时自动重建
./stop.sh                # 停 API / Vite / 隧道；--stop-postgres 一并停库
curl -s http://127.0.0.1:8001/api/health | python3 -m json.tool   # 含 pipeline_status / proxy / warnings

cd app && PYTHONUTF8=1 .venv/bin/python -m tests.run_unit          # 后端单测（无 pytest）
cd web && npx vp check && npx vp build                             # 前端格式/lint + 构建
```

Windows 见 DEPLOY.md「Windows」小节（`启动.bat` / `停止.bat`，默认 5173 / 8000）。

## 不可违反的约束

- 单机部署：不引入 Docker、Redis、Celery、NSSM、fiona、GeoPandas 或额外队列框架。
- 数据库访问保持同步 psycopg，FastAPI HTTP 端点使用 `def`，不要改为 `async def`。
- 所有含中文的文件读写显式 UTF-8；服务进程 `PYTHONUTF8=1`。
- APScheduler 保持 UTC、`misfire_grace_time=3600`、`coalesce=True`、`max_instances=1`；新任务必须传 `next_run_time` 错峰首采。
- 采集器出站请求一律走 `app/net.py`（`make_client` / `websocket_proxy`），不要直接 `httpx.get`。
- 新增数据源必须同时登记到 `core/sources.py`，否则健康面板与 `/api/meta` 看不到它。
- 不泄露或提交 `.env`、`secrets/`、`pgdata/`、日志、备份。
- 提交前 `git diff`；`web/` 改动必须 `vp check` 通过（pre-commit 钩子会跑 `vp staged`），不要 `--no-verify`。

## 当前优先事项

按改造方案分阶段推进：Phase 0 止血（已完成）→ Phase 1 数据语义与告警 → Phase 2 API v2 → Phase 3 前端拆分 → Phase 4 工程化。每阶段独立分支/PR，合并前跑方案中写明的可失败验证。
