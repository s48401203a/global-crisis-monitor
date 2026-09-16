# 全球综合危机监测中心 · 前端（Vite+）

# Frontend (Vite+)

仓库总说明 / project overview: [../../README.md](../README.md)

开发时先起后端，再起前端。默认 **http://127.0.0.1:5180/**，`/api` `/ws` 代理到 **8001**。  
Start the API first, then the UI. Default **http://127.0.0.1:5180/**; `/api` and `/ws` proxy to **8001**.

```powershell
$env:Path = "$env:USERPROFILE\.vite-plus\bin;" + $env:Path
cd web   # Windows: cd D:\crisis\web
vp install
vp dev --host --open
```

- 国界数据 / borders: `public/data/countries.geojson`

## 构建

```powershell
vp build
# 产物在 dist/，可拷到后端 static 做生产发布
```

## 目录（2026-09 模块化后）

```
web/
  index.html            # 无 CDN：maplibre-gl 与样式由 Vite 打包，字体用系统栈
  vite.config.js        # Vite+ · API/WS 代理 · lint(no-undef=error) · vitest include
  playwright.config.js  # e2e：fixtures 模式，桌面 + 390px 移动
  public/data/          # 离线国界 / 地名 / ISO3 中文名；test-fixtures.json
  src/
    main.js             # 组合根：地图图层装配、DOM 事件绑定、语言应用（≈650 行）
    state.js            # 跨模块共享的可变状态（单一 store）
    constants.js        # 类型配色、可筛选类型、时间常量、闪烁集合
    storage.js          # localStorage 单键 crisis.v3（自动迁移旧键）
    i18n/index.js       # 中英文案 L() / UI_I18N / getLang / setLang
    api/client.js       # /api/events 增量拉取（since）、health、theaters、WS 主题
    pipeline.js         # 筛选 → enrich → 地图 source / 特效 / 巡览 / 事件流
    grade.js            # 分级（优先服务端 grade）、CMA 等级、类型/来源/国家标签
    brief.js  headline.js  # 一句话简报；英文标题 → 中文（地名词表）
    breaking.js         # 突发事件判定、闪烁、自动飞行队列
    panels/index.js     # 事件流、图例开关、面板收起、搜索状态条、toast
    popup/index.js      # 事件弹窗定位与内容、地震波动效
    tour/index.js       # 空格巡览、区域锁定、点击国家面
    map/instance.js     # 地图实例与底图源
    map/projection.js   # 平面 ⇄ 地球仪过渡、地表切换、呼吸闪烁
    map/cosmos.js       # 地球仪星空
    map/labels.js       # 中英地名注记
    map/effects.js      # 地震圈 / 台风轨迹 / 洪水方向
    util/format.js  util/geo.js  util/timing.js
    event-search.js  region-gazetteer.js  dock-panels.js
  test/unit/*.test.js   # vitest（vp test）
  test/e2e/*.spec.js    # playwright（./node_modules/.bin/playwright test）
```

## 测试

```bash
vp check                              # 格式 + lint（no-undef 为 error）
vp test                               # 单元测试（纯模块：搜索、地名、分级、i18n 键一致、格式/几何）
./node_modules/.bin/playwright test   # e2e：?fixtures=test，拦截外部瓦片域名，桌面 3 条 + 移动 1 条
```
