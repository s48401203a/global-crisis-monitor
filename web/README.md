# 全球综合危机监测中心 · 前端（Vite+）

按 `D:\AI\Grok\0811\Vite-VitePlus-Agent技术说明书.html` 迁移到 **Vite+ (`vp`)**。

## 开发（热更新自动预览）

1. 先启动后端 API（`D:\crisis\启动.bat` 或确保 `crisis-api` 服务 Running）
2. 前端：

```powershell
$env:Path = "$env:USERPROFILE\.vite-plus\bin;" + $env:Path
cd D:\crisis\web
vp install
vp dev --host --open
```

浏览器默认：**http://localhost:5173/**

- `/api/*`、`/ws/*` 代理到 `http://127.0.0.1:8000`
- 国界数据：`public/data/countries.geojson`

## 构建

```powershell
vp build
# 产物在 dist/，可拷到后端 static 做生产发布
```

## 目录

```
web/
  index.html
  vite.config.js    # Vite+ + API 代理
  public/data/      # 离线国界
  src/
    main.js         # 原监测大屏逻辑
    styles.css
```
