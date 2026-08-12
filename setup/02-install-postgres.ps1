# D:\crisis\setup\02-install-postgres.ps1  —— 需管理员权限
# 前置:用户须先设置环境变量 PGSUPERPASS,禁止把密码写进脚本

if (-not $env:PGSUPERPASS) {
    Write-Error "请先设置环境变量 PGSUPERPASS(PostgreSQL 超级用户密码)后重试"
    exit 1
}

# 2.1 静默安装 PostgreSQL 17.10
$pg = "$env:TEMP\pg17.exe"
Invoke-WebRequest 'https://get.enterprisedb.com/postgresql/postgresql-17.10-2-windows-x64.exe' -OutFile $pg
Start-Process $pg -Wait -ArgumentList @(
  '--mode','unattended', '--unattendedmodeui','minimal',
  '--prefix','C:\PostgreSQL\17',
  '--datadir','D:\crisis\pgdata',      # 关键:数据目录放 D 盘
  '--serverport','5432',
  '--superpassword',$env:PGSUPERPASS,
  '--locale','C',                       # 关键:选 C 而非 Chinese,避免 locale 936 冲突
  '--install_runtimes','1'
)

# 2.2 静默安装 PostGIS 3.6.2 bundle(NSIS 安装器,/S 为静默)
$gis = "$env:TEMP\postgis.exe"
Invoke-WebRequest 'https://download.osgeo.org/postgis/windows/pg17/postgis-bundle-pg17x64-setup-3.6.2-1.exe' -OutFile $gis
Start-Process $gis -Wait -ArgumentList '/S'

# 2.3 验证服务(服务名格式固定为 postgresql-x64-<主版本>)
Get-Service postgresql-x64-17
if ((Get-Service postgresql-x64-17).Status -ne 'Running') {
    Start-Service postgresql-x64-17
}

# 2.4 复查 PROJ_LIB 污染(红线 #12)
Write-Host "PROJ_LIB  = $([Environment]::GetEnvironmentVariable('PROJ_LIB','Machine'))"
Write-Host "GDAL_DATA = $([Environment]::GetEnvironmentVariable('GDAL_DATA','Machine'))"
