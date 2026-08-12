$ErrorActionPreference = "Continue"
$log = "D:\crisis\logs\postgis-install.log"
function L($m){ Add-Content $log $m -Encoding utf8; Write-Host $m }
L "start"
$gis = "$env:TEMP\postgis.exe"
if (-not (Test-Path $gis) -or (Get-Item $gis).Length -lt 1MB) {
  L "download"
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
  Invoke-WebRequest -Uri "https://download.osgeo.org/postgis/windows/pg17/postgis-bundle-pg17x64-setup-3.6.2-1.exe" -OutFile $gis -UseBasicParsing
}
L ("size=" + (Get-Item $gis).Length)
# NSIS silent; some builds need /D= path
$p = Start-Process $gis -ArgumentList "/S" -Wait -PassThru
L ("exit=" + $p.ExitCode)
# also try with install dir if failed
if ($p.ExitCode -ne 0) {
  $p2 = Start-Process $gis -ArgumentList '/S','/D=C:\PostgreSQL\17' -Wait -PassThru
  L ("exit2=" + $p2.ExitCode)
}
Get-ChildItem C:\PostgreSQL\17 -Recurse -Filter "postgis*.dll" -ErrorAction SilentlyContinue | Select-Object -First 5 FullName | ForEach-Object { L $_.FullName }
L "done"
