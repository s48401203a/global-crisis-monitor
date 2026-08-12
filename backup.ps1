# D:\crisis\backup.ps1
$ErrorActionPreference = "Stop"
$env:PGPASSFILE = "D:\crisis\secrets\pgpass.conf"
$env:PGCLIENTENCODING = "UTF8"
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$pgdump = "C:\PostgreSQL\17\bin\pg_dump.exe"
& $pgdump -h localhost -U postgres -Fc -Z 6 -f "D:\crisis\backups\crisis-$stamp.dump" crisis
Get-ChildItem D:\crisis\backups\*.dump | Sort-Object LastWriteTime -Desc | Select-Object -Skip 14 | Remove-Item -Force
