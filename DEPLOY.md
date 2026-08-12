# 在另一台机器上部署（含 Mark）

本仓库是**可复现安装包**：含后端、前端源码、国界/地名数据、建库 SQL、服务定义与说明。  
**不含**数据库密码、`.env`、`secrets/`、`pgdata/`、Python 虚拟环境、`node_modules`。

## 环境要求

- Windows 10/11（规格锁定；Linux/Mac 需自行改路径与 WinSW）
- PostgreSQL **17.x** + **PostGIS 3.6.x**
- Python **3.13**
- Node.js 20+（仅构建前端时需要）
- 本机管理员权限（装库、装服务）

## 1. 克隆

```powershell
git clone https://github.com/s48401203a/global-crisis-monitor.git D:\crisis
cd D:\crisis
```

## 2. 数据库

```powershell
# 设置超级用户密码（不要写进仓库）
[Environment]::SetEnvironmentVariable('PGSUPERPASS', '你的强密码', 'User')
$env:PGSUPERPASS = '你的强密码'

# 按 setup 脚本建库（已有 PG 可只执行 03 + 05）
# psql -U postgres -f setup\03-create-db.sql
# psql -U postgres -d crisis -f setup\05-schema.sql
```

导入国界（若脚本可用）：

```powershell
cd D:\crisis\app
python setup\06-load-countries.py
```

## 3. 后端

```powershell
cd D:\crisis\app
python -m venv .venv
.\.venv\Scripts\pip install -r requirements.txt
Copy-Item .env.example .env
# 编辑 .env：把 <密码> 换成真实密码
```

单元测试（无需 pytest）：

```powershell
cd D:\crisis\app
.\.venv\Scripts\python.exe -m tests.run_unit
```

开发运行：

```powershell
cd D:\crisis\app
$env:PYTHONUTF8=1
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

服务化见 `service\crisis-api.xml`（工作目录改为本机路径）与 `setup\_install_service.ps1`。

后端会**优先挂载** `web\dist`（Vite 构建产物）。若没有 `dist\index.html`，回退 `app\app\static`。

## 4. 前端

```powershell
cd D:\crisis\web
npm install
# 开发热更新
npx vp dev --host --port 5173
# 生产构建（8000 端口大屏依赖此产物）
npx vp build
```

也可双击仓库根目录 `启动.bat`（本机路径写死为 `D:\crisis` 时需按实际修改 `start.ps1`）。

## 5. 验收

```powershell
Invoke-RestMethod http://127.0.0.1:8000/api/health
Invoke-RestMethod http://127.0.0.1:8000/api/events?limit=3
# 浏览器打开 http://127.0.0.1:8000/ 或 http://localhost:5173/
```

## 6. 公网预览（可选）

本机 Vite 已启动后，运行 `公网预览.bat`（需 `tools\cloudflared.exe`）。  
快速隧道地址每次重启会变。

## 数据文件（已入库）

| 路径 | 用途 |
|------|------|
| `web/public/data/countries.geojson` | 国界 50m |
| `web/public/data/place-labels.geojson` | 中英地名 |
| `web/public/data/iso3-zh.json` | ISO3 中文名 |
| `web/public/test-fixtures.json` | 开发夹具 `?fixtures=test` |
| `setup/05-schema.sql` | 全库 DDL |

## 不要复制到新机器的内容

- `app/.env`、`secrets/`（密码）
- `pgdata/`（本机数据库文件）
- `logs/`、`backups/`
- `app/.venv/`、`web/node_modules/`
