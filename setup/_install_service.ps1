$ErrorActionPreference = "Continue"
$log = "D:\crisis\logs\winsw-install.log"
"" | Set-Content $log -Encoding utf8
function L($m){ Add-Content $log $m -Encoding utf8; Write-Host $m }
Set-Location D:\crisis\service
if (Get-Service crisis-api -ErrorAction SilentlyContinue) {
  .\crisis-api.exe stop 2>&1 | Out-String | ForEach-Object { L $_ }
  Start-Sleep 2
  .\crisis-api.exe uninstall 2>&1 | Out-String | ForEach-Object { L $_ }
  Start-Sleep 2
}
$out = .\crisis-api.exe install 2>&1 | Out-String
L "install: $out"
$out2 = .\crisis-api.exe start 2>&1 | Out-String
L "start: $out2"
Start-Sleep 25
$st = (Get-Service crisis-api -ErrorAction SilentlyContinue).Status
L "service=$st"
try {
  $h = Invoke-RestMethod "http://127.0.0.1:8000/api/health" -TimeoutSec 30
  L ("health_ok events=" + $h.event_total + " sources=" + $h.sources.Count)
} catch { L "health_err=$_" }
try {
  $ev = Invoke-RestMethod "http://127.0.0.1:8000/api/events?hours=24" -TimeoutSec 60
  L ("features=" + $ev.features.Count)
} catch { L "events_err=$_" }
$u = Select-String -Path "D:\crisis\logs\*.log","D:\crisis\logs\*.out.log","D:\crisis\logs\*.err.log" -Pattern "UnicodeEncodeError" -ErrorAction SilentlyContinue
$p = Select-String -Path "D:\crisis\logs\*.log","D:\crisis\logs\*.out.log","D:\crisis\logs\*.err.log" -Pattern "ProactorEventLoop" -ErrorAction SilentlyContinue
L ("UnicodeEncodeError_count=" + @($u).Count)
L ("ProactorEventLoop_count=" + @($p).Count)
if (Test-Path D:\crisis\logs\app.log) {
  L "--- app.log tail ---"
  Get-Content D:\crisis\logs\app.log -Tail 20 -Encoding utf8 | ForEach-Object { L $_ }
}
L DONE
