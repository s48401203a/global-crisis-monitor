@echo off
chcp 65001 >nul
echo 将本机 http://127.0.0.1:5173 映射到公网（需先启动 启动.bat / Vite）
echo 关掉本窗口即断开公网链接。
echo.
if not exist "D:\crisis\tools\cloudflared.exe" (
  echo 缺少 D:\crisis\tools\cloudflared.exe
  pause
  exit /b 1
)
"D:\crisis\tools\cloudflared.exe" tunnel --no-autoupdate --url http://127.0.0.1:5173
pause
