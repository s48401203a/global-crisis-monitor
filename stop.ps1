#Requires -Version 5.1
<#
.SYNOPSIS
  一键停止「全球综合危机监测系统」应用服务
  - 停止 crisis-api Windows 服务
  - 结束占用 8000 端口的 uvicorn / python 进程
  - 默认不停止 PostgreSQL（数据库服务保持，便于再次快速启动）
  - 若需同时停库，可加参数: -StopPostgres
#>
param(
  [switch]$StopPostgres
)

$ErrorActionPreference = 'Continue'
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$LogDir = Join-Path $Root 'logs'
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
$Log = Join-Path $LogDir 'stop-script.log'

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
  Log '需要管理员权限以停止 Windows 服务，正在提权…'
  $script = $PSCommandPath
  $argList = "-NoProfile -ExecutionPolicy Bypass -File `"$script`""
  if ($StopPostgres) { $argList += ' -StopPostgres' }
  try {
    Start-Process -FilePath 'powershell.exe' -ArgumentList $argList -Verb RunAs | Out-Null
  } catch {
    Log "提权失败: $_"
    return $false
  }
  exit 0
}

if (-not (Test-Admin)) {
  Ensure-Admin | Out-Null
  exit 0
}

Write-Host ''
Write-Host '========================================' -ForegroundColor Yellow
Write-Host '  全球综合危机监测系统 · 停止' -ForegroundColor Yellow
Write-Host '========================================' -ForegroundColor Yellow
Write-Host ''

# 1) 停止 crisis-api
$svcName = 'crisis-api'
$svcDir = Join-Path $Root 'service'
$winsw = Join-Path $svcDir 'crisis-api.exe'
$api = Get-Service -Name $svcName -ErrorAction SilentlyContinue

if ($api) {
  if ($api.Status -eq 'Running') {
    Log '停止 crisis-api …'
    Set-Location $svcDir
    if (Test-Path $winsw) {
      & $winsw stop 2>&1 | ForEach-Object { Log "$_" }
    } else {
      Stop-Service $svcName -Force -ErrorAction SilentlyContinue
    }
    Start-Sleep -Seconds 3
  }
  $st = (Get-Service $svcName -ErrorAction SilentlyContinue).Status
  Log "crisis-api: $st"
  if ($st -eq 'Stopped') {
    Write-Host "[OK] crisis-api 已停止" -ForegroundColor Green
  } else {
    Write-Host "[警告] crisis-api 状态: $st ，将清理 8000 端口" -ForegroundColor Yellow
  }
} else {
  Log '未安装 crisis-api 服务'
  Write-Host "[信息] 未检测到 crisis-api 服务" -ForegroundColor DarkGray
}

# 2) 停止 Vite 开发服务器（5173）
Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue | ForEach-Object {
  $procId = $_.OwningProcess
  if ($procId -and $procId -gt 4) {
    try {
      $p = Get-Process -Id $procId -ErrorAction SilentlyContinue
      if ($p) {
        Log "结束 Vite 端口 5173 进程 PID=$procId ($($p.ProcessName))"
        Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
      }
    } catch {}
  }
}

# 3) 清理 8000 端口上的残留进程（uvicorn 直接启动时）
$killed = 0
Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue | ForEach-Object {
  $procId = $_.OwningProcess
  if ($procId -and $procId -gt 4) {
    try {
      $p = Get-Process -Id $procId -ErrorAction SilentlyContinue
      if ($p) {
        Log "结束占用 8000 的进程 PID=$procId ($($p.ProcessName))"
        Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
        $killed++
      }
    } catch {
      Log "结束 PID=$procId 失败: $_"
    }
  }
}
# 额外：工作目录在 D:\crisis\app 的 uvicorn python（若仍存活）
Get-CimInstance Win32_Process -Filter "Name='python.exe'" -ErrorAction SilentlyContinue | ForEach-Object {
  if ($_.CommandLine -and $_.CommandLine -match 'uvicorn' -and $_.CommandLine -match 'app\.main:app') {
    try {
      Log "结束 uvicorn python PID=$($_.ProcessId)"
      Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
      $killed++
    } catch {}
  }
}
if ($killed -gt 0) {
  Write-Host "[OK] 已清理 $killed 个相关进程" -ForegroundColor Green
} else {
  Write-Host "[OK] 无残留 8000/uvicorn 进程" -ForegroundColor Green
}

# 3) 可选停止 PostgreSQL
if ($StopPostgres) {
  $pgName = 'postgresql-x64-17'
  $pg = Get-Service -Name $pgName -ErrorAction SilentlyContinue
  if ($pg -and $pg.Status -eq 'Running') {
    Log "停止 $pgName …"
    Stop-Service $pgName -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
    Write-Host "[OK] PostgreSQL 已停止" -ForegroundColor Green
  }
} else {
  Write-Host "[信息] PostgreSQL 保持运行（再次启动更快）。若需停库请执行: stop.ps1 -StopPostgres" -ForegroundColor DarkGray
}

# 4) 确认端口
Start-Sleep -Seconds 1
$still = Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue
if ($still) {
  Write-Host "[警告] 8000 端口仍被占用" -ForegroundColor Yellow
  Log '8000 仍监听'
} else {
  Write-Host "[OK] 8000 端口已释放" -ForegroundColor Green
  Log '停止完成'
}

Write-Host ''
Write-Host '停止完成。启动请运行: 启动.bat 或 start.ps1' -ForegroundColor Cyan
Write-Host ''
if ($Host.Name -eq 'ConsoleHost') {
  Start-Sleep -Seconds 2
}
exit 0
