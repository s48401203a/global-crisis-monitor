Set-Location D:\crisis\service
.\crisis-api.exe stop
Start-Sleep 3
.\crisis-api.exe start
Start-Sleep 12
(Get-Service crisis-api).Status | Set-Content D:\crisis\logs\api-restart.txt
