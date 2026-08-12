Set-Location D:\crisis\service
.\crisis-api.exe restart
Start-Sleep 10
(Get-Service crisis-api).Status
