# 全球综合危机监测系统 · 交付报告

- **模型 / 执行者**: grok-4.5  
- **规格依据**: `D:\AI\Grok\0811\全球综合危机监测系统-开发执行规格-claude-opus-5.html`  
- **部署根目录**: `D:\crisis\`  
- **交付日期**: 2026-08-12  
- **服务入口**: http://127.0.0.1:8000  

---

## 1. 各 Phase 验收实际结果

### Phase 0 · 环境

| # | 验收项 | 结果 |
|---|--------|------|
| 1 | LongPathsEnabled | **1**（通过） |
| 2 | postgresql-x64-17 | **Running**（通过） |
| 3 | PostGIS | **POSTGIS="3.6.2 3.6.2"**（通过） |
| 4 | Python 编码 | `utf8_mode= 1` / `preferred= utf-8`（通过） |
| 5 | 依赖 + 时区 | `Asia/Shanghai`（通过） |

**问题与解法**

1. **postgresql.conf 首行 BOM**：安装后服务无法启动，日志报 conf 第 1 行语法错误。去除 UTF-8 BOM 并写入规格调优项后恢复。  
2. **PostGIS 静默 `/S` 首次 exit=2**：加 `/D=C:\PostgreSQL\17` 后成功，`postgis-3.dll` 就位。  
3. **长路径**：注册表已置 1；本机在未完整重启的情况下 `uv pip install` 已成功（若日后深层路径再失败，请重启一次以彻底生效）。  

### Phase 1 · 数据层 + USGS + upsert

| # | 验收项 | 结果 |
|---|--------|------|
| 1 | `country` 行数 | **177**（≥170，通过） |
| 2 | 地震 total / nullpt | **233 / 0**（通过） |
| 3 | observation orphan | **0**（通过） |
| 4 | country_iso3 定位 | located **191** / total **233**（海域空属正常，通过） |
| 5 | 重复执行采集后 observation 重复行 | **0 行**（upsert 通过） |

**问题与解法**

1. **`AmbiguousParameter` on footprint `:fp`**：`CASE WHEN :fp IS NULL` 无法推断类型。改为 `CAST(:fp AS text)`，jsonb 同理。  
2. **单条失败导致整批 abort**：`ingest` 为每条事件加 `begin_nested()` savepoint。  
3. **`06-load-countries.py` 找不到 app**：加入基于脚本路径的 `sys.path` 修正。  

### Phase 2 · 全源 + 去重

| # | 验收项 | 结果 |
|---|--------|------|
| 1 | 各源 observation | usgs / gdacs / eonet 有数据；**gdelt 本环境 429**（见下） |
| 2 | 同 event 多源 | **有**：如 id 235 `gdacs,usgs` M7.4；id 241 `gdacs,usgs` M6.3（通过） |
| 3 | 过度合并 (>4 源) | **0 行**（通过） |
| 4 | 冲突置信度分布 | 当前 **0 条 conflict**（GDELT 429） |
| 5 | severity 分布 | 各 type 有 lo/avg/hi 区间，非单点（通过） |

**问题与解法**

1. **跨源去重初验为空**：USGS `all_day` 与 GDACS 历史大震时间窗不重叠。用 **一次** `4.5_week.geojson` 回填后与 GDACS 重合，去重逻辑验证通过。常规运行仍按规格 `all_hour` / `all_day`。  
2. **GDELT 持续 HTTP 429**：本出口 IP 被限流。采集器已加 User-Agent + 指数退避；**代码与表结构就绪**，限流解除后自动恢复。`source_health` 已正确记为 error。  
3. **同源 observation 重复 event**：在 `dedupe.find_matching_event` 增加 observation 优先查找，保证 upsert 修订。  

### Phase 3 · API + 前端 + Windows 服务

| # | 验收项 | 结果 |
|---|--------|------|
| 1 | `/api/events` GeoJSON | **features≈236（24h）/ 358（7d）**（通过） |
| 2 | `/api/health` | **200**，含各源状态（通过） |
| 3 | 浏览器首页 + 底图 | `/` **200**；`/data/countries.geojson` **200**（通过） |
| 4 | 服务 Running | **crisis-api = Running**（通过） |
| 5 | 服务模式 API | health / events 正常（通过） |
| 6 | 无 UnicodeEncodeError / ProactorEventLoop | **0 / 0**（通过） |
| 7 | 日志中文 | `app.log` 为 **UTF-8**，内容「系统启动完成…」（通过；PowerShell 默认控制台可能显示乱码，文件本身正确） |

**问题与解法**

1. **`/api/events` 500**：`:cat IS NULL` 参数类型歧义。改为按需拼接 category 条件。  
2. **WinSW XML**：提取规格时多了注释行导致「XML declaration must be first」。重写 `crisis-api.xml` 后安装成功。  
3. **前端底图路径**：StaticFiles 挂在 `/`，将 `countries.geojson` 改为 `/data/countries.geojson`。  

### Phase 4 · 告警与长稳

| # | 验收项 | 结果 |
|---|--------|------|
| 1 | 关注区域 | 已写入 `test-north-china`（通过） |
| 2 | `evaluate_alerts()` | 首次返回多条规则命中（通过） |
| 3 | 静默窗口 | 二次调用返回 **[]**（通过） |
| 4 | 24h 源健康 | 服务已装好并持续运行；**完整 24h 观察需自然流逝**，见 §3 |
| 5 | 每小时入库 | 当前集中在启动小时（629 条回填）；后续由调度器按间隔增量 |

**备份**

- `pg_dump` 测试成功：`D:\crisis\backups\crisis-test.dump`  
- 计划任务：`CrisisDB-DailyBackup`（每日 03:00，脚本 `D:\crisis\backup.ps1`）  

---

## 2. 运行与运维摘要

| 项 | 值 |
|----|-----|
| PostgreSQL | 17.10 · 数据目录 `D:\crisis\pgdata` · 服务 `postgresql-x64-17` |
| PostGIS | 3.6.2 |
| 应用服务 | WinSW `crisis-api` · 自动启动 · 依赖 PG |
| 代码 / venv | `D:\crisis\app` · Python 3.13 venv |
| 配置 | `D:\crisis\app\.env`（密码仅本地，不进 Git） |
| 日志 | `D:\crisis\logs\app.log` |
| 超级用户密码 | 环境变量 `PGSUPERPASS` / 用户级已设（用户提供） |

**常用命令**

```powershell
# 服务
Set-Location D:\crisis\service
.\crisis-api.exe status
.\crisis-api.exe restart

# 手动采集
Set-Location D:\crisis\app
.\.venv\Scripts\Activate.ps1
$env:PYTHONUTF8=1
python -c "from app.collectors.usgs import UsgsCollector; print(UsgsCollector().run())"
```

---

## 3. 第 12.3 节已知局限 · 实际验证情况

| 局限 | 实测结论 |
|------|----------|
| 野火时效不足（EONET） | EONET 已接入 200 条 open 事件；为目录级，前端有 source / 时间字段，未伪装「实时火点」。FIRMS 默认关闭。 |
| 冲突仅国家级（GDELT GEO 失效） | DOC API 实现完整；**本机出口当前 429**，冲突层暂无数据。解除限流后将按国家质心入库。 |
| 洪水按点采样 | `OpenMeteoFloodCollector` 已挂调度；`watch_point` 空则不产生事件。GDACS 洪水作为面状补充已有数据。 |
| 去重参数需校准 | 经验初值下已出现 **usgs+gdacs** 双源合并，且无 >4 源过度合并。若偏松/偏紧可调 `EQ_*`。 |
| 无 ACLED | 未接入（免密钥约束）。 |
| 单机无高可用 | 符合设计；服务 + 延迟启动 + USGS 回补可部分覆盖停机空档。 |

---

## 4. 24 小时长稳（待自然观察）

服务已在本机以 **Windows 服务**方式运行。规格要求连续 24 小时后复核：

```sql
SELECT source, last_success_at, consecutive_failures,
       round(total_success::numeric/GREATEST(1,total_success+total_failure),3) AS success_rate
  FROM source_health ORDER BY 1;

SELECT date_trunc('hour', first_seen_at) AS h, count(*)
  FROM event
 WHERE first_seen_at > now() - INTERVAL '24 hours'
 GROUP BY 1 ORDER BY 1;
```

并检查：

```powershell
Select-String -Path D:\crisis\logs\*.log -Pattern 'UnicodeEncodeError|ProactorEventLoop'
```

**当前时点**：usgs/gdacs/eonet 健康；gdelt 因上游 429 为 error（预期会持续直到限流解除）。

---

## 5. 规格外最小必要修补清单（仍服从红线）

| 修补 | 原因 |
|------|------|
| ingest CAST + savepoint | 否则 Phase 1 整批入库失败 |
| events 查询去掉 NULL 参数比较 | 否则 API 500 |
| WinSW XML 去前置注释 | 否则服务无法加载配置 |
| HTTP 429 退避 | GDELT 限流可恢复 |
| observation 优先匹配 | 避免同源修订产生重复 event |

未引入 Docker / Redis / 禁装列表中的任何包。

---

## 6. 交付结论

- **Phase 0–3 验收命令已真实执行并通过**（GDELT 上游 429 为环境限制，采集器与健康面板行为正确）。  
- **Phase 4 告警与静默通过**；备份脚本与计划任务已就位。  
- **系统已作为 `crisis-api` Windows 服务运行**，浏览器访问 http://127.0.0.1:8000 可看地图底图、事件与源健康。  
- **完整 24h 空档/成功率曲线**需服务继续运行满 24 小时后按 §3 SQL 复核。  

**安全提醒**：数据库密码已写入本机 `D:\crisis\app\.env` 与 `D:\crisis\secrets\pgpass.conf`，请勿提交到 Git 或对外分享；若密码曾出现在聊天记录中，建议在方便时轮换。
