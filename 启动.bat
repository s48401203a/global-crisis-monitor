@echo off
chcp 65001 >nul
cd /d "%~dp0"
title 危机监测系统 - 启动
echo.
echo  正在启动全球综合危机监测系统...
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start.ps1"
set ERR=%ERRORLEVEL%
if %ERR% neq 0 (
  echo.
  echo 启动失败，退出码 %ERR%
  pause
  exit /b %ERR%
)
exit /b 0
