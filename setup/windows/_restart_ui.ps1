$ErrorActionPreference="Continue"
Set-Location D:\crisis\service
.\crisis-api.exe restart
Start-Sleep 12
$st = (Get-Service crisis-api).Status
"service=$st" | Set-Content D:\crisis\logs\ui-restart.txt -Encoding utf8
try {
  $r = Invoke-WebRequest "http://127.0.0.1:8000/" -UseBasicParsing -TimeoutSec 20
  "index=$($r.StatusCode) has_zh=$($r.Content -match '全球综合危机监测中心') has_motion=$($r.Content -match 'meshDrift')" | Add-Content D:\crisis\logs\ui-restart.txt -Encoding utf8
  $h = Invoke-RestMethod "http://127.0.0.1:8000/api/health" -TimeoutSec 15
  "locale=$($h.locale) src0=$($h.sources[0].source_zh)" | Add-Content D:\crisis\logs\ui-restart.txt -Encoding utf8
} catch {
  "err=$_" | Add-Content D:\crisis\logs\ui-restart.txt -Encoding utf8
}
