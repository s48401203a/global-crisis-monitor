# 全球综合危机监测中心 · Agent 指南

## 先读这些（都在仓库内）

1. [README.md](./README.md)：定位、数据源、快速开始、架构。
2. [DEPLOY.md](./DEPLOY.md)：macOS（主）与 Windows 部署步骤。
3. [projecttodo.md](./projecttodo.md)：开放待办与变更日志；每次功能改动、修 bug、环境变更后**在文末追加一条**（日期 + 模型名 + 摘要）。
4. [docs/项目评审与改造方案-fable-5.1.html](./docs/项目评审与改造方案-fable-5.1.html)：2026-09 评审结论、问题编号（D-01…）与五阶段改造路线；执行 Phase N 前先读第 04/05 章。
5. 修改 `web/` 前再读 `web/AGENTS.md`（Vite+ 操作约定）。

历史文档已归档到 `docs/archive/`（2026-08 Windows 阶段记录），只作溯源；架构决策见 `docs/adr/`；阶段变更见 `CHANGELOG.md`。

## 项目结构

- `app/app/`：FastAPI、APScheduler、采集器、入库与告警。`net.py` 出站代理策略；`core/sources.py` 数据源注册表（健康阈值、中英文名）。
- `web/`：MapLibre 大屏；`web/src/` 是前端唯一编辑源（已模块化，见 `web/README.md` 目录图；`main.js` 只做装配，不要再往里堆业务逻辑）；`web/dist/` 由 `vp build` 生成、不入库，后端挂载它。
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
cd web && npx vp check && npx vp test && npx vp build              # 前端格式/lint(no-undef) + 单测 + 构建
cd web && ./node_modules/.bin/playwright test                      # e2e（fixtures 模式，不依赖后端）
```

bash scripts/verify.sh            # 一键验收：单测 + 集成 + 前端 check/test/build + e2e + 运行面
bash setup/install-launchd.sh     # 开机自启 API（launchd）+ 每日 03:17 备份；--uninstall 卸载
./backup.sh                       # 手动备份到 backups/（保留 7 份）；--restore <dump> 恢复
```

Windows 见 DEPLOY.md「Windows」小节（`启动.bat` / `停止.bat`，默认 5173 / 8000）。

公网隧道（`公网预览.sh`）必须先在 `app/.env` 设置 `ACCESS_TOKEN`（`openssl rand -hex 16`）；隧道映射 8001 的构建产物，不再暴露 Vite 开发服务器。

## 不可违反的约束

- 单机部署：不引入 Docker、Redis、Celery、NSSM、fiona、GeoPandas 或额外队列框架。
- 数据库访问保持同步 psycopg，FastAPI HTTP 端点使用 `def`，不要改为 `async def`。
- 所有含中文的文件读写显式 UTF-8；服务进程 `PYTHONUTF8=1`。
- APScheduler 保持 UTC、`misfire_grace_time=3600`、`coalesce=True`、`max_instances=1`；新任务必须传 `next_run_time` 错峰首采。
- 采集器出站请求一律走 `app/net.py`（`make_client` / `websocket_proxy`），不要直接 `httpx.get`。
- 新增数据源必须同时登记到 `core/sources.py`，否则健康面板与 `/api/meta` 看不到它。
- 不泄露或提交 `.env`、`secrets/`、`pgdata/`、日志、备份。
- 提交前 `git diff`；`web/` 改动必须 `vp check` 通过（pre-commit 钩子会跑 `vp staged`），不要 `--no-verify`。跨模块共享的状态放 `web/src/state.js`，不要新增 `window.*` 全局或内联 `onclick`。

## 当前优先事项

Phase 0–4 已于 2026-09-09 完成（见 CHANGELOG.md）。剩余为 Phase 5 可选增强：瓦片缓存代理/离线底图、Webhook/Telegram 告警通道、ACLED 等权威冲突源、水文源、历史回放。任何改动合并前跑 `bash scripts/verify.sh`。
