# projecttodo

主文件只保留最近主干变更。更早条目见 `projecttodo-archive/`。

## 开放待办

- [x] 本机验收：usgs/gdacs/eonet/gdelt/war 有数据；GDELT 本机未 429
- [ ] 未装 FIRMS_MAP_KEY，野火近实时火点默认关闭
- [ ] 原仓库 TASK-A7 瓦片缓存代理仍按条件任务，本轮不实施

## 归档索引

- 暂无更早归档

---

### 2026-09-16 【Grok 4.6】 可靠性：验收、鉴权、同步

- 修复 `verify.sh` 子 shell 失败误报 ALL PASS；`scripts/test_verify_gate.sh` 注入单测/lint/前端/构建/e2e/健康均非零
- WS 用 `POST /api/ws-ticket` 短期票据；取消/错令牌/过期停止无限弹窗与无效重试；访问测试进 CI
- 增量按 `change_seq` 分页，截断不推进水位；`/api/events/reconcile` 对账；窗口淘汰；延迟提交靠对账补齐
- ingest 每次独立结果；全部入库失败非绿；`severity` 当前值与 `severity_peak` 分离；迁移 `setup/10-reliability.sql`
- 集成测试默认临时库；不自动迁移业务库

### 2026-09-09 【Claude Fable 5.1】 Phase 4 工程化与运维

- CI：`.github/workflows/ci.yml` 四条作业（后端单测+PostGIS 集成；前端 check/test/build 并断言 dist 无 CDN；Playwright e2e；依赖审计只报告）
- launchd：`service/com.crisis.api.plist`（API 8001，KeepAlive 仅异常退出时重启）+ `service/com.crisis.backup.plist`（每日 03:17）；`setup/install-launchd.sh` 安装/卸载，本机已安装并验证 8001 由 launchd 托管
- 备份：`backup.sh`（pg_dump 自定义格式、`pg_restore --list` 校验、保留 KEEP 份、`--restore`）；本机已生成 `backups/crisis-*.dump`
- 隧道令牌：`ACCESS_TOKEN` 非空时 `/api` `/ws` 需 `X-Access-Token`/`?token=`；本机判定按对端回环 + 无 `CF-Connecting-IP`/公网 `X-Forwarded-For`（Vite 代理开 `xfwd`）；前端 401 时提示输入令牌；`公网预览.sh` 改映射 8001 且无令牌拒绝开放（`ALLOW_OPEN_TUNNEL=1` 可强制）
- 文档：`scripts/verify.sh` 一键验收；`CHANGELOG.md`；`docs/adr/0001–0003`；`项目进度记录.md`/`交付报告`/`终审报告` 归档到 `docs/archive/`；README/AGENTS/DEPLOY 补运维与安全口径
- 验证：`tests.integration_access` 9/9；`scripts/verify.sh --quick` 通过
- 未做：GitHub Actions 未实际在远端跑过（未 push）；`stop.sh` 未接管 launchd（停 8001 后由 `launchctl kickstart` 或重新登录恢复）

### 2026-09-09 【Claude Fable 5.1】 Phase 3 前端模块化与自包含

- `main.js` 4834 行 → 组合根 ≈650 行 + 17 个模块：`state.js`（单一 store）、`constants.js`、`storage.js`（localStorage 单键 `crisis.v3`，自动迁移旧键）、`i18n/`、`api/client.js`、`pipeline.js`、`grade.js`/`brief.js`/`headline.js`、`breaking.js`、`panels/`、`popup/`、`tour/`、`map/{instance,projection,cosmos,labels,effects}.js`、`util/{format,geo,timing}.js`
- 自包含：`maplibre-gl@5.6.1` 入 npm 依赖并打包；Google Fonts 改系统字体栈；`index.html` 无任何 CDN；e2e 拦截外部域名仍可加载
- 交互：事件流改事件委托（去内联 `onclick` 与 `window.*` 全局）；条目可 Tab 聚焦 + Enter 打开；所有 seg 组同步 `aria-selected`；健康点补读屏文字
- 窄屏（≤760px）：底部标签栏（筛选 / 事件流 / 数据源 / 地图）+ 单面板抽屉；停靠拖动在窄屏关闭；统计条落在折行顶栏下方
- 工具链：`vp check` 开 `no-undef=error`（模块拆分漏导入会在提交前拦住）；Vitest 22 例（格式/几何/搜索/地名/分级/i18n 键一致）；Playwright 4 例（fixtures 模式：无 CDN 加载、时间窗/搜索/弹窗/地球仪/语言、图层开关与键盘、390px 抽屉与弹窗）
- 验证：`vp check` 0 错误；`vp test` 22/22；`playwright test` 4/4；`vp build` 通过；实时 smoke 6 路径通过、0 pageerror
- 已知：模块间仍有 12 对函数级循环引用（ESM 函数提升下可运行，无顶层求值依赖）；`region-gazetteer.js`（747 行，地名表）与 `dock-panels.js`（734 行）未再拆；控制台偶见 MapLibre worker 的 `Unimplemented type: 4`（来自外部字形服务响应，Phase 5 自托管字形时消除）

### 2026-09-09 【Claude Fable 5.1】 Phase 2 API v2 与增量推送

- `/api/events` v2：`since`（含 deleted/closed）、`bbox`、`types`、`fields=summary|full`、ETag/304、gzip（全年 summary 线上 179 KB，原 2.36 MB）；`grade{band,tone,zh,en}` 服务端统一分级（`core/grade.py`，前端 `realGrade` 优先用之）
- 新端点：`/api/events/{id}`、`/api/alerts`、`/api/stats`（聚合信号与真实事件分列）、`/api/meta`
- WS 改主题消息 `/ws`：`alert`（兼容旧顶层 event_id）、`events.changed`（采集一轮后广播，前端 1.2 s 去抖后 `since` 增量拉取）、`pipeline.status`
- 生命周期 `core/lifecycle.py`：EONET/GDACS/CMA 连续 3 轮缺席且源健康 → `closed`（前端灰显、不触发突发）；保留任务：raw 90 天清空、alert 180 天、deleted 30 天、样本 400 天
- 国家归属：CMA/CENC 直写 CHN；其余落海时取 20 km 内最近国家
- 前端：featureStore + since 增量合并、时间窗切换才全量；5 s 重渲染仅在有闪烁态时执行；refresh 并发合并
- 验证：单测 35/35；`integration_api` 25/25；`integration_alerts` 5/5；`integration_lifecycle` 3/3；Playwright：首轮全量→后续 `since=`、切周全量、弹窗等级来自服务端并随语言切换、WS 收到 `events.changed`
- 未做：告警回看面板 UI（Phase 3 面板模块化时一起做）

### 2026-09-09 【Claude Fable 5.1】 Phase 0 止血 + Phase 1 数据语义与告警

- **Phase 0**（`b9a40c9`）：`app/net.py` 代理策略（`HTTP_PROXY_MODE=env|direct|url`）；`core/sources.py` 源注册表；`/api/health` 增 `pipeline_status`/`enabled`/`warnings`，前端顶栏多源异常红显；EMSC 写健康表；全部任务错峰首采；dist 缺失挂占位页；`start.sh` 按 mtime 重建 dist；`vp check` 通过（数据文件排除、typeCheck 关）；删除 `app/app/static/index.html`、`web/src/style.css`、重复 schema；一次性/Windows 脚本归入 `setup/oneoff/`、`setup/windows/`；AGENTS/README/DEPLOY/PR 模板口径统一
- **Phase 1**：GDELT 改「国家×日」聚合 `armed_clash`（`is_aggregate`），库内 1658 槽行合并为 279 行；战区热点迁入 `theater` 表 + `/api/theaters`，前端独立图层「战区基线」可开关、不计统计；`watch_point` 41 / `watch_region` 6 种子；Open-Meteo 逐日样本 `watch_sample`，基线 = 90 天中位数（≥14 样本，<20 m³/s 视为不在河道跳过）；FIRMS 改按关注区域 bbox + 1 km 网格聚类 + FRP 分档；告警改 `first_seen_at` 判新、`muted_until` 生效、聚合冲突按当日计数阈值
- 迁移：`setup/migrate.sh` + `07/08/09-*.sql`（幂等，记 `schema_migration`）；数据修正 `setup/oneoff/migrate_phase1_data.py`（已 apply，备份 `backups/pre-phase1-*.dump`）；`snap_watch_points.py` 吸附离河道点
- 验证：单测 30/30；`tests.integration_alerts` 5/5（首见 1 次、重 upsert 不重复、静默内小跃升不响、静默后跃升响、旧事件重启不响）；Playwright：战区层 12 点开关、战区弹窗、聚合信号弹窗；重启后告警 5 条（改前同场景 131 条）
- 已知：GDELT 聚合坐标改用本槽报道点均值，不再吸附国家质心

### 2026-09-09 【Claude Fable 5.1】 项目评审与整体改造方案

- 新增 `docs/项目评审与改造方案-fable-5.1.html`（自包含、菜单分页、护眼主题、刷新保留位置）
- 评审方法：全量源码阅读 + 单测 18/18 + `./start.sh --no-open` 拉起 8001/5180 + API 负载实测 + psql 抽查 + Playwright 6 条关键路径
- 结论：P0 4 项（GDELT 15 分钟槽灌水 1540 行 war、watch_point/watch_region 为空、代理失效致全源静默中断、dist 落后源码）；五阶段改造路线见文档第 05 章
- 未改任何源码；服务当前处于运行状态

### 2026-09-09 【Grok 4.6】 GitHub main + Cloudflare 公网预览

- PR #1 合入 `main`：https://github.com/s48401203a/global-crisis-monitor
- macOS `公网预览.sh` 用 cloudflared 快速隧道映射 Vite 5180；`stop.sh` 会停隧道
- 快速隧道地址每次重启会变，本机关机后失效

### 2026-08-15 【Grok 4.6】 推送顶栏与时间窗改动

- 推到 `feat/macos-local-deploy` / PR #1；含 LICENSE
- 当日默认、日周月半年全年、贴边事件流、顶栏拆分、图形框按内容平铺

### 2026-08-15 【Grok 4.6】 图形框按内容平铺

- 顶栏/统计/筛选/健康按内容收缩；事件流高度随列表，不再整屏留白
- 日周月按钮单行贴字；筛选与健康不再重叠

### 2026-08-15 【Grok 4.6】 顶栏改单行并拆出标题/语言

- 标题独立左上，语言按钮独立右上，中间工具条单行缩小

### 2026-08-15 【Grok 4.6】 事件流贴边并与弹窗互避

- 事件流展开时固定贴右缘；同边收起签改到面板内侧
- 详情弹窗按侧栏占位换锚点，避免压住事件流

### 2026-08-15 【Grok 4.6】 默认当日与日周月年筛选

- 主页默认当日（当地 0 点起）；筛选改为日 / 周 / 月 / 半年 / 全年
- API `hours` 上限放到 9000，以覆盖全年

### 2026-08-14 【Grok 4.6】 增加 MIT LICENSE 与署名

- 根目录 `LICENSE`（MIT © s48401203a）；README 作者/非官方声明；顶栏副标题标非官方

### 2026-08-14 【Grok 4.6】 评审修复后推送

- deleted 不再被同源采集救活；WS 不再二次入队
- 告警只在首次或等级跃升时推；deploy 端口/阈值与 5180/8001 对齐

### 2026-08-14 【Grok 4.6】 弹窗避让顶栏与分级停留

- 信息框不再压住顶栏：空间不够就改到标点下方，并限制高度
- 自然灾害 5 级/橙停 30 秒、7 级/红停 60 秒，再巡下一条新发生

### 2026-08-14 【Grok 4.6】 信息框贴近标点

- 弹窗尖角贴着圆点；溢出时平移地图，不再把框挪离标点

### 2026-08-14 【Grok 4.6】 新灾害自动提醒

- 够格的新事件：图标闪烁、飞到发生点、弹出信息框
- 暴雨橙/红纳入后端推送；小震不刷屏；首屏只跟最近 15 分钟内最新一条

### 2026-08-14 【Grok 4.6】 仓库中英双语说明

- README 中英对照：定位、数据源、快速开始、架构、安全
- DEPLOY.md / web/README 补英文入口与 5180/8001

### 2026-08-14 【Grok 4.6】 推送 feat 分支并更新公开 PR

- 仓库 `s48401203a/global-crisis-monitor` 保持 Public
- 提交 macOS 部署后的大屏/中国预警改动，更新 PR #1 说明

### 2026-08-14 【Grok 4.6】 暴雨红预警不再当洪水

- 暴雨/强降雨/地质灾害改为 `rainstorm`；仅山洪/洪水保留洪水
- 蓝/黄预警不入库、不显示；箭头只给高严重度实测径流，未聚焦最多 3 条
- 同源修订会改类型，避免已删除黄/蓝被救活

### 2026-08-14 【Grok 4.6】 接入中国公开预警/地震

- 中央气象台 `weather.cma.cn/api/map/alarm`：暴雨/山洪/地质/台风/火/干旱
- 中国地震台网速报（CENC 镜像）：M≥3
- 水利部水情接口本轮不可用；河南当前仅有大风预警，沙颍河洪水不在气象预警清单

### 2026-08-14 【Grok 4.6】 中外城市检索语言

- 中国城市中文搜（杭州/河南）；国外城市英文搜（Tokyo / New York），多词市名可识别

### 2026-08-14 【Grok 4.6】 搜索定位无事件时显示中文城市名

- 「命中 0」改为「已定位 · 无事件」；地图补全省/市中文注记，关掉中文界面下的英文栅格地名

### 2026-08-14 【Grok 4.6】 城市名写入搜索关键字

- 事件按坐标打上省/市名（含杭州等）；可搜城市或 `城市:杭州`

### 2026-08-14 【Grok 4.6】 省/市地名可搜索

- 「河南」等按坐标落省匹配；当前窗口无事件时提示已识别地区，不再当无效关键字

### 2026-08-14 【Grok 4.6】 组合关键字搜索

- 顶栏搜索框：空格且 / OR 或 / -排除 / 引号短语；字段 类型、国家、来源、类别、震级
- 同时过滤地图点与事件流；`/` 聚焦，Esc 清空

### 2026-08-14 【Grok 4.6】 日志目录 500MB 循环清理

- `logs/` 合计超过 500MB 时先删最旧轮转文件，再裁活动日志头部；启停脚本与每 10 分钟定时任务执行
- 上限可用 `LOG_MAX_BYTES` 覆盖

### 2026-08-14 【Grok 4.6】 贴边按面板边缘自动收起

- 改为面板贴窗即收起（指针不必顶到屏幕边）；贴边过程中触发；名称签按文字尺寸
- 浏览器实拖验收：事件流贴左竖签、筛选贴左、健康贴底横签、轻挪不收、点击展开回原位

### 2026-08-14 【Grok 4.6】 信息框拖动贴边收起

- 四块信息框可拖动；指针靠窗口边缘收成名称签；左右竖排、上下横排；再点展开回原位
- 新增 `web/src/dock-panels.js`，布局写入 localStorage

### 2026-08-14 【Grok 4.6】 弹窗与界面自适应

- 事件信息窗避让顶栏/侧栏并限高滚动；同点不再叠两条巡览 toast；顶栏与 toast 按视口收窄

### 2026-08-14 【Grok 4.6】 地球仪宇宙星空背景

- MapLibre fog 提高星光与地平线；叠加银河带 + 闪烁星点（screen 合成），平面图不显示

### 2026-08-14 【Grok 4.6】 预览端口改为 5180 / 8001

- 5173 与 8000 被「CAD dwg识别」占用；本项目 Vite=5180、API=8001

### 2026-08-14 【Grok 4.6】 项目迁入独立目录并转移会话

- 新根目录：`/Users/oscar/AI/newproject/grok/全球综合危机监测中心`
- Grok 会话已复制到新 cwd 分组；恢复见 `.grok/RESUME.md`

### 2026-08-14 【Grok 4.6】 平面⇄地球仪过渡再顺滑

- 单时间轴 rAF 插值镜头/裁切；投影硬切用画布快照淡出，不再分段 easeTo

### 2026-08-14 【Grok 4.6】 平面⇄地球仪完整过渡

- 收成悬浮球 → 圆内切投影 → 展开定格；去掉中间硬切的卷卡片两段式

### 2026-08-14 【Grok 4.6】 Vite 自动预览

- 5173 已是本项目 HMR，未重复拉起；`open http://127.0.0.1:5173/`
- 后端 8000 仍在，`/api` 代理可用

### 2026-08-14 【Grok 4.6】 提交 macOS 部署 PR

- **规模**：分支 `feat/macos-local-deploy` → PR #1，不含 `.env` / `secrets/`
- **链接**：https://github.com/s48401203a/global-crisis-monitor/pull/1

### 2026-08-14 【Grok 4.6】 macOS 完整落地部署

- **规模**：克隆 GitHub 仓库；Homebrew PostgreSQL 17 + PostGIS；Python 3.13 venv；Vite 前端依赖；新增 `setup/macos-deploy.sh`、`start.sh`、`stop.sh`
- **入口**：`http://127.0.0.1:5173`（HMR） / `http://127.0.0.1:8000/api/health`
- **空间**：新增系统公式（postgresql@17、postgis/gdal 依赖）+ `app/.venv` + `web/node_modules`；密钥仅 `app/.env` 与 `secrets/`，不入库
- **阻塞修复**：`app/app/main.py` USGS 回补 job 从 lambda 改为模块级函数，否则 SQLAlchemyJobStore 无法序列化，API 起不来
- **审查后修补**：恢复 50m 国界文件；deploy 入库不再覆盖该文件；start.sh 记录监听 PID、Vite 失败改非 0、缺 dist 时 build、PATH 含 `~/.local/bin`
