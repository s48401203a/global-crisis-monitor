# Changelog

按阶段记录；细粒度条目见 `projecttodo.md`。日期为落地日。

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
