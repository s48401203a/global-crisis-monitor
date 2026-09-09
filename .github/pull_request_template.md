## 摘要

<!-- 说明解决的问题、用户可见变化及影响范围。 -->

## 变更内容

-

## 验收证据

- [ ] `vp check` 通过，或在下方说明现有格式化例外
- [ ] `vp test` 通过，或说明当前没有测试及替代验证
- [ ] `vp build` 通过
- [ ] 涉及后端时：`http://127.0.0.1:8001/api/health` 正常（`pipeline_status` 为 ok；Windows 为 8000）
- [ ] 涉及前端时：`http://127.0.0.1:5180` 已手动验证（Windows 为 5173）
- [ ] 涉及服务模式时：已验证 8001 端口挂载的 `web/dist` 与源码一致（`./start.sh` 会自动重建）
- [ ] 涉及数据/采集器时：已运行 `python -m tests.run_unit` 并观察 `/api/health` 对应源为 ok

## 风险与回滚

<!-- 说明数据迁移、服务重启、外部数据源、地图瓦片或兼容性风险；没有则写“无”。 -->

## 安全检查

- [ ] 未提交 `.env`、`secrets/`、`pgdata/`、日志、备份、`node_modules/` 或 WinSW 二进制
- [ ] 未在代码、日志、截图或 PR 描述中暴露凭证
- [ ] 没有引入 Docker、Redis、异步 psycopg、NSSM 或其他被规格禁止的依赖
