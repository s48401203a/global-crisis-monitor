# D:\crisis\setup\01-system-prereq.ps1  —— 需管理员权限,执行后必须重启

# 1.1 启用长路径支持(红线 #6)
New-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem" `
  -Name "LongPathsEnabled" -Value 1 -PropertyType DWORD -Force
git config --system core.longpaths true

# 1.2 创建目录结构(全部在 D 盘,C 盘仅剩 51.7 GB)
$dirs = @(
  'D:\crisis\app', 'D:\crisis\pgdata', 'D:\crisis\logs', 'D:\crisis\logs\pg',
  'D:\crisis\service', 'D:\crisis\backups', 'D:\crisis\secrets', 'D:\crisis\setup'
)
$dirs | ForEach-Object { New-Item -ItemType Directory -Force -Path $_ | Out-Null }

# 1.3 Defender 排除项 —— 不加会导致 PG 写入性能显著下降
Add-MpPreference -ExclusionPath 'D:\crisis'
Add-MpPreference -ExclusionProcess 'python.exe','postgres.exe','pg_ctl.exe'

# 1.4 PowerShell 编码永久化(写入 $PROFILE)
$profileDir = Split-Path $PROFILE -Parent
if (-not (Test-Path $profileDir)) { New-Item -ItemType Directory -Force -Path $profileDir | Out-Null }
$enc = @'
$OutputEncoding = [Console]::InputEncoding = [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding
$PSDefaultParameterValues['*:Encoding'] = 'utf8'
$env:WSL_UTF8 = '1'
$env:PYTHONUTF8 = '1'
'@
# 仅当尚未写入时追加,避免重复执行污染 $PROFILE
if (-not (Test-Path $PROFILE) -or -not (Select-String -Path $PROFILE -Pattern 'PYTHONUTF8' -Quiet)) {
  Add-Content -Path $PROFILE -Value $enc -Encoding utf8
}

Write-Host "步骤 1 完成。请重启机器后继续步骤 2。" -ForegroundColor Yellow
