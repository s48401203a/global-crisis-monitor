$ErrorActionPreference="Stop"
Start-Service postgresql-x64-17
Start-Sleep 4
$s = (Get-Service postgresql-x64-17).Status
Set-Content D:\crisis\logs\pg-start-status.txt $s
if ($s -ne "Running") { exit 1 }
exit 0
