# ADR-0004 · 事件同步、访问令牌与验收门禁

- 日期：2026-09-16 · 状态：已采纳

## 背景

Phase 2 增量 API 在截断后仍用 `server_time` 推进水位，可能漏事件；HTTP 登录后 WebSocket 不带令牌；`scripts/verify.sh` 子 shell 失败不回传。

## 决定

1. **同步协议**：快照与增量都按 `event.change_seq` 升序稳定分页。`meta.truncated=true` 时客户端必须带 `next_cursor` 续读，**不得**把截断页的 `server_time` / `high_water` 当作已完整水位。删除/关闭走增量（不按 `occurred_at` 过滤）。`GET /api/events/reconcile` 返回窗口内 id 集合，用于断线恢复与延迟提交补齐。
2. **增量不是无损承诺**：PostgreSQL 序号在语句时分配、提交后才可见，晚提交事务的较小 `change_seq` 可能落在客户端已推进的水位之后。对账与定期快照是正确性来源；增量只是加速。未证明无损前不宣称无损增量。
3. **当前严重度 vs 峰值**：`severity` 可随权威源降级下降；`severity_peak` 只升不降。前端计数与告警用当前值。
4. **采集结果**：每次 `ingest_events` 返回独立 `IngestResult`。合法空结果为成功；部分失败标 `partial`；全部入库失败不记绿色、不广播未提交 id。
5. **WS 鉴权**：`POST /api/ws-ticket` 签发 60 秒 HMAC 票据，WS 用 `?ticket=`。长期 `?token=` 仍可用但会进访问日志。取消输入或连续错误后停止重试，避免无限弹窗。
6. **验收**：`verify.sh` 用临时文件汇总失败；严格模式 API 未运行记失败。集成测试默认临时库，不碰业务 `crisis`。

## 后果

- 旧客户端若只读一页并按 `since=server_time` 推进，仍可能漏数据；新前端按协议分页 + 对账。
- 超过约 2000×50 页的窗口需依赖对账/快照，不引入队列。
- 升级走 `bash setup/migrate.sh`（`10-reliability.sql`）。回滚：停服务后从 `backups/` 恢复；列可保留。
