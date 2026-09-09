# 全球综合危机监测中心 · 前端（Vite+）
# Frontend (Vite+)

仓库总说明 / project overview: [../../README.md](../README.md)

开发时先起后端，再起前端。默认 **http://127.0.0.1:5180/**，`/api` `/ws` 代理到 **8001**。  
Start the API first, then the UI. Default **http://127.0.0.1:5180/**; `/api` and `/ws` proxy to **8001**.

```powershell
$env:Path = "$env:USERPROFILE\.vite-plus\bin;" + $env:Path
cd D:\crisis\web
vp install
vp dev --host --open
```

- 国界数据 / borders: `public/data/countries.geojson`

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
