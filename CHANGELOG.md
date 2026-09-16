# Changelog

按阶段记录；细粒度条目见 `projecttodo.md`。日期为落地日。

## 2026-09-16 · 对账按版本补拉，禁止 ID 集合推进游标

- `GET /api/events/reconcile` 返回 `versions[{id,change_seq,status}]`；客户端比较版本后 `?ids=` 补拉
- 对账不再把 `storeSeq` 推到全局 `high_water`；补拉失败保持原游标
- 按 `change_seq` 合并，乱序旧响应不能覆盖新状态；刷新与对账串行

## 2026-09-16 · 可靠性：验收、鉴权、同步

- `scripts/verify.sh` 失败回传父进程；失败注入脚本覆盖单测/lint/前端/构建/e2e/健康
- HTTP/WS 统一鉴权：短期 `/api/ws-ticket`，取消与错误凭据停止重试
- 事件按 `change_seq` 分页；截断不推进水位；`/api/events/reconcile` 对账；窗口淘汰
- ingest 返回独立结果；全部入库失败不显示健康；`severity` 与 `severity_peak` 分离
- 集成测试使用临时库；访问/WS/同步测试进入 CI

## 2026-09-09 · Phase 4 工程化与运维
- GitHub Actions：后端单测 + PostGIS 集成、前端 check/test/build（断言无 CDN）、Playwright e2e、依赖审计（只报告）
- macOS `launchd`：`service/com.crisis.api.plist` + `setup/install-launchd.sh`；每日备份 `backup.sh` + `com.crisis.backup.plist`
- 隧道访问令牌 `ACCESS_TOKEN`（`/api` `/ws` 需 `X-Access-Token`）；`公网预览.sh` 改映射 8001 并拒绝无令牌开放
- `scripts/verify.sh` 一键验收；文档收敛：历史记录归档 `docs/archive/`，新增 `docs/adr/`

## 2026-09-09 · Phase 3 前端模块化与自包含
- `main.js` 拆为 17 个模块；`maplibre-gl` 入 npm；无 CDN；事件委托；a11y；≤760px 抽屉；localStorage 单键；Vitest 22 例 + Playwright 4 例

## 2026-09-09 · Phase 2 API v2 与增量推送
- `/api/events` since/bbox/types/fields/ETag/gzip；`/api/events/{id}` `/api/alerts` `/api/stats` `/api/meta`；服务端 `grade`；WS 主题消息；生命周期关闭与保留任务

## 2026-09-09 · Phase 1 数据语义与告警
- GDELT 国家×日聚合；战区独立表与图层；41 洪水关注点 / 6 关注区域；Open-Meteo 90 天中位数基线；FIRMS 区域聚类；告警判新/静默重写

## 2026-09-09 · Phase 0 止血
- 代理策略、源注册表、`pipeline_status`、EMSC 健康、错峰首采、dist 自动重建、`vp check` 可用、文档口径统一

## 2026-08 · Windows 原型阶段（Grok / GLM）
- 见 `docs/archive/项目进度记录.md`、`docs/archive/交付报告-grok-4.5.md`、`docs/archive/终审报告-grok-4.5.html`
