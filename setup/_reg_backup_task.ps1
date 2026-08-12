$ErrorActionPreference="Stop"
$action = New-ScheduledTaskAction -Execute "PowerShell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -File D:\crisis\backup.ps1"
$trigger = New-ScheduledTaskTrigger -Daily -At 3:00AM
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
Register-ScheduledTask -TaskName "CrisisDB-DailyBackup" -Action $action -Trigger $trigger -Principal $principal -Force | Out-Null
"task_ok" | Set-Content D:\crisis\logs\backup-task.txt
