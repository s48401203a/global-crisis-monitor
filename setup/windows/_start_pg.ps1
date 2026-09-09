$ErrorActionPreference="Continue"
Start-Service postgresql-x64-17
Start-Sleep 3
(Get-Service postgresql-x64-17).Status
Get-Content D:\crisis\pgdata\log\* -Tail 30 -ErrorAction SilentlyContinue
Get-ChildItem D:\crisis\pgdata -ErrorAction SilentlyContinue | Select-Object -First 20 Name
Get-ChildItem D:\crisis\pgdata\log -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Desc | Select-Object -First 3 Name
