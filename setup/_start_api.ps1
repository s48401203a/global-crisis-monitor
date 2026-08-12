$ErrorActionPreference="Continue"
if ((Get-Service postgresql-x64-17 -ErrorAction SilentlyContinue).Status -ne "Running") {
  Start-Service postgresql-x64-17
  Start-Sleep 4
}
Set-Location D:\crisis\service
if ((Get-Service crisis-api -ErrorAction SilentlyContinue).Status -eq "Running") {
  .\crisis-api.exe restart
} else {
  .\crisis-api.exe start
}
Start-Sleep 10
$st = (Get-Service crisis-api).Status
"crisis-api=$st" | Set-Content D:\crisis\logs\start-api.txt -Encoding utf8
try {
  $h = Invoke-RestMethod "http://127.0.0.1:8000/api/health" -TimeoutSec 20
  "health_ok events=$($h.event_total) sources=$($h.sources.Count)" | Add-Content D:\crisis\logs\start-api.txt -Encoding utf8
  $r = Invoke-WebRequest "http://127.0.0.1:8000/" -UseBasicParsing -TimeoutSec 15
  "index=$($r.StatusCode)" | Add-Content D:\crisis\logs\start-api.txt -Encoding utf8
} catch {
  "err=$_" | Add-Content D:\crisis\logs\start-api.txt -Encoding utf8
}
