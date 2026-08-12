#Requires -RunAsAdministrator
# 一键：长路径 + 目录 + Defender + PG17.10 + PostGIS + 建库调优
$ErrorActionPreference = 'Stop'
$log = 'D:\crisis\logs\elevated-phase0.log'
New-Item -ItemType Directory -Force -Path 'D:\crisis\logs' | Out-Null
function Log($m) {
  $line = "[{0}] {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $m
  Add-Content -Path $log -Value $line -Encoding utf8
  Write-Host $line
}

try {
  # 从用户环境变量读取，禁止硬编码密码
  $pass = [Environment]::GetEnvironmentVariable('PGSUPERPASS', 'User')
  if (-not $pass) { $pass = $env:PGSUPERPASS }
  if (-not $pass) { throw 'PGSUPERPASS not set in User or process env' }
  $env:PGSUPERPASS = $pass
  $env:PYTHONUTF8 = '1'
  $env:PGPASSWORD = $pass

  Log '=== 1. LongPaths ==='
  New-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem' `
    -Name 'LongPathsEnabled' -Value 1 -PropertyType DWORD -Force | Out-Null
  try { git config --system core.longpaths true } catch { Log "git longpaths skip: $_" }
  $lp = (Get-ItemProperty 'HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem').LongPathsEnabled
  Log "LongPathsEnabled=$lp"

  Log '=== 2. Directories + Defender ==='
  $dirs = @(
    'D:\crisis\app', 'D:\crisis\pgdata', 'D:\crisis\logs', 'D:\crisis\logs\pg',
    'D:\crisis\service', 'D:\crisis\backups', 'D:\crisis\secrets', 'D:\crisis\setup'
  )
  $dirs | ForEach-Object { New-Item -ItemType Directory -Force -Path $_ | Out-Null }
  try {
    Add-MpPreference -ExclusionPath 'D:\crisis' -ErrorAction SilentlyContinue
    Add-MpPreference -ExclusionProcess 'python.exe','postgres.exe','pg_ctl.exe' -ErrorAction SilentlyContinue
  } catch { Log "Defender skip: $_" }

  # Profile UTF-8
  $profileDir = Split-Path $PROFILE -Parent
  if (-not (Test-Path $profileDir)) { New-Item -ItemType Directory -Force -Path $profileDir | Out-Null }
  $enc = @'
$OutputEncoding = [Console]::InputEncoding = [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding
$PSDefaultParameterValues['*:Encoding'] = 'utf8'
$env:WSL_UTF8 = '1'
$env:PYTHONUTF8 = '1'
'@
  if (-not (Test-Path $PROFILE) -or -not (Select-String -Path $PROFILE -Pattern 'PYTHONUTF8' -Quiet -ErrorAction SilentlyContinue)) {
    Add-Content -Path $PROFILE -Value $enc -Encoding utf8
  }

  $pgService = Get-Service -Name 'postgresql-x64-17' -ErrorAction SilentlyContinue
  if (-not $pgService) {
    Log '=== 3. Download + Install PostgreSQL 17.10 ==='
    $pg = "$env:TEMP\pg17.exe"
    if (-not (Test-Path $pg) -or (Get-Item $pg).Length -lt 10MB) {
      Log 'Downloading PostgreSQL installer...'
      [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
      Invoke-WebRequest -Uri 'https://get.enterprisedb.com/postgresql/postgresql-17.10-2-windows-x64.exe' -OutFile $pg -UseBasicParsing
    }
    Log "Installer size=$((Get-Item $pg).Length)"
    $args = @(
      '--mode','unattended','--unattendedmodeui','minimal',
      '--prefix','C:\PostgreSQL\17',
      '--datadir','D:\crisis\pgdata',
      '--serverport','5432',
      '--superpassword',$pass,
      '--locale','C',
      '--install_runtimes','1'
    )
    $p = Start-Process -FilePath $pg -ArgumentList $args -Wait -PassThru
    Log "PG install exit=$($p.ExitCode)"
    if ($p.ExitCode -ne 0) { throw "PostgreSQL install failed exit=$($p.ExitCode)" }
  } else {
    Log 'PostgreSQL service already present, skip install'
  }

  $gisInstalled = Test-Path 'C:\PostgreSQL\17\bin\postgis_restore.pl'
  # broader check for postgis
  $postgisDll = Get-ChildItem 'C:\PostgreSQL\17' -Recurse -Filter 'postgis*.dll' -ErrorAction SilentlyContinue | Select-Object -First 1
  if (-not $postgisDll) {
    Log '=== 4. Download + Install PostGIS 3.6.2 ==='
    $gis = "$env:TEMP\postgis.exe"
    if (-not (Test-Path $gis) -or (Get-Item $gis).Length -lt 1MB) {
      Log 'Downloading PostGIS bundle...'
      [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
      Invoke-WebRequest -Uri 'https://download.osgeo.org/postgis/windows/pg17/postgis-bundle-pg17x64-setup-3.6.2-1.exe' -OutFile $gis -UseBasicParsing
    }
    $p2 = Start-Process -FilePath $gis -ArgumentList '/S' -Wait -PassThru
    Log "PostGIS install exit=$($p2.ExitCode)"
  } else {
    Log "PostGIS already present: $($postgisDll.FullName)"
  }

  Log '=== 5. Ensure service running ==='
  $svc = Get-Service postgresql-x64-17 -ErrorAction SilentlyContinue
  if (-not $svc) {
    # alternate service names
    $svc = Get-Service | Where-Object { $_.Name -like 'postgresql*' } | Select-Object -First 1
    Log "Found service $($svc.Name) status=$($svc.Status)"
  }
  if ($svc -and $svc.Status -ne 'Running') {
    Start-Service $svc.Name
    Start-Sleep -Seconds 3
  }
  Log "Service=$($svc.Name) Status=$((Get-Service $svc.Name).Status)"

  # PATH for this process
  $env:Path = "C:\PostgreSQL\17\bin;" + $env:Path
  $psql = 'C:\PostgreSQL\17\bin\psql.exe'
  if (-not (Test-Path $psql)) { throw "psql not found at $psql" }

  Log '=== 6. Create database crisis if missing ==='
  $exists = & $psql -U postgres -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='crisis'" 2>&1
  Log "exists_check=$exists"
  if ("$exists".Trim() -ne '1') {
    & $psql -U postgres -d postgres -v ON_ERROR_STOP=1 -c "CREATE DATABASE crisis ENCODING 'UTF8' LOCALE_PROVIDER 'builtin' BUILTIN_LOCALE 'C.UTF-8' TEMPLATE template0;"
    Log 'CREATE DATABASE done'
  }
  & $psql -U postgres -d crisis -v ON_ERROR_STOP=1 -c "CREATE EXTENSION IF NOT EXISTS postgis; CREATE EXTENSION IF NOT EXISTS pg_trgm; CREATE EXTENSION IF NOT EXISTS btree_gin;"
  $ver = & $psql -U postgres -d crisis -tAc "SELECT PostGIS_Full_Version();"
  Log "PostGIS=$ver"

  Log '=== 7. Tune postgresql.conf ==='
  $conf = 'D:\crisis\pgdata\postgresql.conf'
  if (-not (Test-Path $conf)) {
    $conf = 'C:\PostgreSQL\17\data\postgresql.conf'
  }
  if (Test-Path $conf) {
    $raw = Get-Content $conf -Raw -Encoding UTF8
    $settings = @{
      'shared_buffers' = '512MB'
      'work_mem' = '32MB'
      'maintenance_work_mem' = '512MB'
      'effective_cache_size' = '16GB'
      'max_connections' = '100'
      'wal_compression' = 'on'
      'listen_addresses' = "'localhost'"
      'logging_collector' = 'on'
      'log_directory' = "'D:/crisis/logs/pg'"
      'log_rotation_size' = '100MB'
      'timezone' = "'UTC'"
    }
    foreach ($k in $settings.Keys) {
      $v = $settings[$k]
      if ($raw -match "(?m)^\s*#?\s*$k\s*=") {
        $raw = [regex]::Replace($raw, "(?m)^\s*#?\s*$k\s*=.*$", "$k = $v")
      } else {
        $raw += "`r`n$k = $v"
      }
    }
    Set-Content -Path $conf -Value $raw -Encoding UTF8
    Log "Tuned $conf"
    if ($svc) {
      Restart-Service $svc.Name -Force
      Start-Sleep -Seconds 5
      Log "Service restarted Status=$((Get-Service $svc.Name).Status)"
    }
  } else {
    Log "WARN conf not found"
  }

  Log '=== 8. PROJ_LIB check ==='
  Log "PROJ_LIB=$([Environment]::GetEnvironmentVariable('PROJ_LIB','Machine'))"
  Log "GDAL_DATA=$([Environment]::GetEnvironmentVariable('GDAL_DATA','Machine'))"

  Log '=== PHASE0_ELEVATED_OK ==='
  exit 0
} catch {
  Log "FATAL: $_"
  Log $_.ScriptStackTrace
  exit 1
}
