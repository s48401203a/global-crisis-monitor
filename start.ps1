#Requires -Version 5.1
<#
.SYNOPSIS
  一键启动「全球综合危机监测系统」
  - 确保 PostgreSQL 运行
  - 启动 crisis-api Windows 服务（或回退到本机 uvicorn）
  - 打开浏览器
#>
$ErrorActionPreference = 'Continue'
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$LogDir = Join-Path $Root 'logs'
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
$Log = Join-Path $LogDir 'start-script.log'

function Log([string]$m) {
  $line = "[{0}] {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $m
  Add-Content -Path $Log -Value $line -Encoding utf8
  Write-Host $line
}

function Test-Admin {
  $id = [Security.Principal.WindowsIdentity]::GetCurrent()
  $p = New-Object Security.Principal.WindowsPrincipal($id)
  return $p.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Ensure-Admin {
  if (Test-Admin) { return $true }
  Log '需要管理员权限以操作 Windows 服务，正在提权…'
  $script = $MyInvocation.PSCommandPath
  if (-not $script) { $script = $PSCommandPath }
  $args = "-NoProfile -ExecutionPolicy Bypass -File `"$script`""
  try {
    Start-Process -FilePath 'powershell.exe' -ArgumentList $args -Verb RunAs | Out-Null
  } catch {
    Log "提权失败: $_"
    return $false
  }
  exit 0
}

# 服务操作需要管理员
if (-not (Test-Admin)) {
  Ensure-Admin | Out-Null
  exit 0
}

$env:PYTHONUTF8 = '1'
$env:Path = 'C:\PostgreSQL\17\bin;D:\crisis\app\.venv\Scripts;' + $env:Path

Write-Host ''
Write-Host '========================================' -ForegroundColor Cyan
Write-Host '  全球综合危机监测系统 · 启动' -ForegroundColor Cyan
Write-Host '========================================' -ForegroundColor Cyan
Write-Host ''

# 1) PostgreSQL
$pgName = 'postgresql-x64-17'
$pg = Get-Service -Name $pgName -ErrorAction SilentlyContinue
if (-not $pg) {
  Log "未找到服务 $pgName，请确认 PostgreSQL 17 已安装"
  Write-Host "错误: 未找到 PostgreSQL 服务 $pgName" -ForegroundColor Red
  pause
  exit 1
}
if ($pg.Status -ne 'Running') {
  Log "启动 $pgName …"
  Start-Service $pgName
  Start-Sleep -Seconds 3
}
$pgStatus = (Get-Service $pgName).Status
Log "PostgreSQL: $pgStatus"
if ($pgStatus -ne 'Running') {
  Write-Host "错误: PostgreSQL 未能启动" -ForegroundColor Red
  pause
  exit 1
}
Write-Host "[OK] PostgreSQL 运行中" -ForegroundColor Green

# 2) crisis-api 服务
$svcName = 'crisis-api'
$svcDir = Join-Path $Root 'service'
$winsw = Join-Path $svcDir 'crisis-api.exe'
$api = Get-Service -Name $svcName -ErrorAction SilentlyContinue

if ($api) {
  if ($api.Status -eq 'Running') {
    Log 'crisis-api 已在运行，执行 restart 以加载最新配置'
    Set-Location $svcDir
    if (Test-Path $winsw) {
      & $winsw restart 2>&1 | ForEach-Object { Log "$_" }
    } else {
      Restart-Service $svcName -Force
    }
  } else {
    Log '启动 crisis-api …'
    Set-Location $svcDir
    if (Test-Path $winsw) {
      & $winsw start 2>&1 | ForEach-Object { Log "$_" }
    } else {
      Start-Service $svcName
    }
  }
  Start-Sleep -Seconds 8
  $apiStatus = (Get-Service $svcName -ErrorAction SilentlyContinue).Status
  Log "crisis-api: $apiStatus"
  if ($apiStatus -ne 'Running') {
    Write-Host "[警告] Windows 服务未就绪，尝试直接启动 uvicorn …" -ForegroundColor Yellow
    # fall through to uvicorn
  } else {
    Write-Host "[OK] crisis-api 服务运行中" -ForegroundColor Green
  }
} else {
  Log '未安装 crisis-api 服务，使用 uvicorn 前台/后台启动'
  Write-Host "[信息] 未检测到 crisis-api 服务，改用 uvicorn" -ForegroundColor Yellow
}

# 若服务未运行则用 venv uvicorn
$needUvicorn = $false
$api = Get-Service -Name $svcName -ErrorAction SilentlyContinue
if (-not $api -or $api.Status -ne 'Running') {
  $needUvicorn = $true
}

if ($needUvicorn) {
  $py = Join-Path $Root 'app\.venv\Scripts\python.exe'
  $appDir = Join-Path $Root 'app'
  if (-not (Test-Path $py)) {
    Log "找不到虚拟环境: $py"
    Write-Host "错误: 未找到 $py" -ForegroundColor Red
    pause
    exit 1
  }
  # 释放 8000
  Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue | ForEach-Object {
    try { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue } catch {}
  }
  Start-Sleep -Seconds 1
  $outLog = Join-Path $LogDir 'uvicorn-console.out.log'
  $errLog = Join-Path $LogDir 'uvicorn-console.err.log'
  Start-Process -FilePath $py `
    -ArgumentList '-m','uvicorn','app.main:app','--host','127.0.0.1','--port','8000','--workers','1' `
    -WorkingDirectory $appDir `
    -WindowStyle Hidden `
    -RedirectStandardOutput $outLog `
    -RedirectStandardError $errLog
  Start-Sleep -Seconds 6
  Log 'uvicorn 进程已启动'
  Write-Host "[OK] uvicorn 已在 127.0.0.1:8000 启动" -ForegroundColor Green
}

# 3) 健康检查
$url = 'http://127.0.0.1:8000'
$ok = $false
for ($i = 1; $i -le 15; $i++) {
  try {
    $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 3
    if ($r.StatusCode -eq 200) { $ok = $true; break }
  } catch {
    Start-Sleep -Seconds 1
  }
}

if ($ok) {
  Log "健康检查通过: $url"
  Write-Host "[OK] 后端 API 可用: $url" -ForegroundColor Green
} else {
  Log '健康检查失败'
  Write-Host "[错误] 未能访问 $url ，请查看 $Log 与 $LogDir\app.log" -ForegroundColor Red
  pause
  exit 1
}

# 3.5) 自动构建前端 dist（终结双前端分叉：确保 8000 端口呈现与 web/src 一致的最新前端）
$webDir = Join-Path $Root 'web'
$distIndex = Join-Path $webDir 'dist\index.html'
$needBuild = $false
if (-not (Test-Path $distIndex)) {
  $needBuild = $true
  Log 'dist 不存在，执行 vp build'
} else {
  # dist 落后于 src 任一文件或 index.html 即重建
  $srcFiles = @()
  $srcDir = Join-Path $webDir 'src'
  if (Test-Path $srcDir) { $srcFiles += Get-ChildItem -Path $srcDir -Recurse -File }
  $pubDir = Join-Path $webDir 'public'
  if (Test-Path $pubDir) { $srcFiles += Get-ChildItem -Path $pubDir -Recurse -File }
  $idxHtml = Join-Path $webDir 'index.html'
  if (Test-Path $idxHtml) { $srcFiles += Get-Item $idxHtml }
  $viteCfg = Join-Path $webDir 'vite.config.js'
  if (Test-Path $viteCfg) { $srcFiles += Get-Item $viteCfg }
  if ($srcFiles) {
    $srcNewest = ($srcFiles | Sort-Object LastWriteTime -Descending | Select-Object -First 1).LastWriteTime
    if ($srcNewest -gt (Get-Item $distIndex).LastWriteTime) {
      $needBuild = $true
      Log 'dist 落后于 src，执行 vp build'
    }
  }
}
if ($needBuild) {
  $env:Path = "$env:USERPROFILE\.vite-plus\bin;" + $env:Path
  $vp = Get-Command vp -ErrorAction SilentlyContinue
  if ($vp) {
    Push-Location $webDir
    $buildOk = $false
    try {
      & vp build 2>&1 | ForEach-Object { Log "build: $_" }
      $buildOk = ($LASTEXITCODE -eq 0)
    } finally { Pop-Location }
    if ($buildOk) { Log 'vp build 完成' } else { Log 'vp build 失败（exit!=0）' }
  } else {
    Log '未找到 vp，跳过自动 build（请手动 vp build）'
  }
}

# 4) 启动 Vite+ 前端热更新（优先）
$viteUrl = 'http://127.0.0.1:5173'
$viteOk = $false
if (Test-Path (Join-Path $webDir 'package.json')) {
  $env:Path = "$env:USERPROFILE\.vite-plus\bin;" + $env:Path
  # 若 5173 已在监听则复用
  $listening = Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue
  if (-not $listening) {
    Log '启动 Vite+ 前端 (vp dev) …'
    $vOut = Join-Path $LogDir 'vite-dev.out.log'
    $vErr = Join-Path $LogDir 'vite-dev.err.log'
    $vp = Get-Command vp -ErrorAction SilentlyContinue
    $viteCmd = if ($vp) { $vp.Source } else { 'npx' }
    $viteArgs = if ($vp) { @('dev','--host','--open') } else { @('vite','--host','--open') }
    Start-Process -FilePath $viteCmd -ArgumentList $viteArgs `
      -WorkingDirectory $webDir `
      -WindowStyle Hidden `
      -RedirectStandardOutput $vOut `
      -RedirectStandardError $vErr
    Start-Sleep -Seconds 4
  } else {
    Log 'Vite 开发服务器已在 5173 运行'
  }
  for ($i = 1; $i -le 12; $i++) {
    try {
      $vr = Invoke-WebRequest -Uri $viteUrl -UseBasicParsing -TimeoutSec 2
      if ($vr.StatusCode -eq 200) { $viteOk = $true; break }
    } catch { Start-Sleep -Seconds 1 }
  }
}

if ($viteOk) {
  Write-Host "[OK] 前端 Vite+ 热更新: $viteUrl" -ForegroundColor Green
  try { Start-Process $viteUrl } catch { Log "打开浏览器失败: $_" }
  Write-Host ''
  Write-Host '启动完成。' -ForegroundColor Cyan
  Write-Host "  开发预览(HMR): $viteUrl" -ForegroundColor Cyan
  Write-Host "  后端 API:       $url" -ForegroundColor DarkGray
  Write-Host '停止请运行: 停止.bat 或 stop.ps1' -ForegroundColor DarkGray
} else {
  Write-Host "[警告] Vite 前端未就绪，回退打开后端静态页 $url" -ForegroundColor Yellow
  try { Start-Process $url } catch {}
  Write-Host "可手动: cd $webDir && vp dev --host --open" -ForegroundColor DarkGray
}

Write-Host ''
if ($Host.Name -eq 'ConsoleHost') {
  Start-Sleep -Seconds 2
}
exit 0
