# projecttodo

主文件只保留最近主干变更。更早条目见 `projecttodo-archive/`。

## 开放待办

- [x] 本机验收：usgs/gdacs/eonet/gdelt/war 有数据；GDELT 本机未 429
- [ ] 未装 FIRMS_MAP_KEY，野火近实时火点默认关闭
- [ ] 原仓库 TASK-A7 瓦片缓存代理仍按条件任务，本轮不实施

## 归档索引

- 暂无更早归档

---

### 2026-08-14 【Grok 4.6】 提交 macOS 部署 PR

- **规模**：分支 `feat/macos-local-deploy` → PR #1，不含 `.env` / `secrets/`
- **链接**：https://github.com/s48401203a/global-crisis-monitor/pull/1

### 2026-08-14 【Grok 4.6】 macOS 完整落地部署

- **规模**：克隆 GitHub 仓库；Homebrew PostgreSQL 17 + PostGIS；Python 3.13 venv；Vite 前端依赖；新增 `setup/macos-deploy.sh`、`start.sh`、`stop.sh`
- **入口**：`http://127.0.0.1:5173`（HMR） / `http://127.0.0.1:8000/api/health`
- **空间**：新增系统公式（postgresql@17、postgis/gdal 依赖）+ `app/.venv` + `web/node_modules`；密钥仅 `app/.env` 与 `secrets/`，不入库
- **阻塞修复**：`app/app/main.py` USGS 回补 job 从 lambda 改为模块级函数，否则 SQLAlchemyJobStore 无法序列化，API 起不来
- **审查后修补**：恢复 50m 国界文件；deploy 入库不再覆盖该文件；start.sh 记录监听 PID、Vite 失败改非 0、缺 dist 时 build、PATH 含 `~/.local/bin`
