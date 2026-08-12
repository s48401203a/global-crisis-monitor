@echo off
chcp 65001 >nul
cd /d "%~dp0"
title 危机监测系统 - 停止
echo.
echo  正在停止全球综合危机监测系统...
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0stop.ps1"
set ERR=%ERRORLEVEL%
if %ERR% neq 0 (
  echo.
  echo 停止过程出现问题，退出码 %ERR%
  pause
  exit /b %ERR%
)
exit /b 0
