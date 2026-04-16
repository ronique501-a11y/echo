@echo off
echo ====================================
echo EchoHub - Auto-Start with Watchdog
echo ====================================
echo.

cd /d D:\Echo

REM Check if hub is running
curl -s http://localhost:3847/health >nul 2>&1
if %errorlevel% neq 0 (
    echo Starting EchoHub...
    start /B cmd /c "node hub\server.js > hub\hub.log 2>&1"
    timeout /t 3 /nobreak > nul
) else (
    echo EchoHub already running
)

REM Check if watchdog is running
tasklist | findstr watchdog >nul 2>&1
if %errorlevel% neq 0 (
    echo Starting Tunnel Watchdog...
    start /B cmd /c "node tunnel-watchdog.js"
) else (
    echo Watchdog already running
)

echo.
echo ====================================
echo EchoHub is running!
echo ====================================
echo.
echo Hub:      http://localhost:3847
echo Web UI:   http://localhost:3847/
echo.
echo Check tunnel status:
echo curl http://localhost:3847/health
echo.
pause
