# ADR-0004 · 事件同步、访问令牌与验收门禁

- 日期：2026-09-16 · 状态：已采纳（2026-09-16 13:50 CST 补：版本对账）
- 修订：Grok 4.6

## 背景

Phase 2 增量 API 在截断后仍用 `server_time` 推进水位，可能漏事件；HTTP 登录后 WebSocket 不带令牌；`scripts/verify.sh` 子 shell 失败不回传。

第一轮可靠性修复后仍有缺陷：对账只比较事件 ID，不比较 `change_seq` / 状态，且在 `missing` 为空时把 `storeSeq` 推到全局 `high_water`。已有事件的等级、位置、关闭状态变化会被当成“已同步”，随后增量跳过这些更新。低序号事务晚提交同理。

## 决定

1. **分页**：快照与增量按 `event.change_seq` 升序稳定分页。`truncated=true` 时必须续读 `next_cursor`。不得把截断页的 `server_time` 或全局 `high_water` 当作水位。增量水位只用**本页已读**的 `page_high_water`。
2. **对账返回版本**：`GET /api/events/reconcile` 返回 `versions: [{id, change_seq, status}]`（仍带 `ids` / `closed_ids`）。客户端比较本地 `change_seq` 与 `status`；落后或缺失则 `GET /api/events?ids=` 补拉。**不得**仅因 ID 集合相同就认定内容已同步。
3. **游标**：对账成功也**不得**把 `storeSeq` 设为 `high_water`。补拉失败保持原游标。`change_seq` 在语句时分配、提交后才可见，不能当作提交顺序。
4. **乱序与并发**：按每条 `change_seq` 合并，旧响应不能覆盖新状态。刷新与对账串行（同一把 in-flight 锁），避免快照/增量交错写坏 store。
5. **增量不是无损**：低序号晚提交仍可能被 `since_seq` 跳过；补偿是下一轮版本对账或完整快照（stale 过多时）。一致性边界：窗口内事件在对账周期内（默认 60s，断线后立即）恢复到服务端当前 `change_seq`/`status`；不承诺瞬时无损。
6. **删除/关闭/窗口**：删除不在 reconcile 集合中，客户端丢掉 extra；关闭以 `status=closed` 进入 versions 并补拉；`occurred_at` 滑出窗口后淘汰。认证仍用短期 WS ticket。
7. **其余不变**：ingest 独立结果；`severity` / `severity_peak`；`verify.sh` 失败回传；集成测试用临时库。

## 后果

- 旧客户端只比 ID、并推进 `high_water` 仍会漏内容更新。
- 超过约 200 条 stale 时对账改走完整快照。
- 升级仍走 `bash setup/migrate.sh`（`10-reliability.sql`）。
