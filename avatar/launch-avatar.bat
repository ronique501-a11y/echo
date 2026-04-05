@echo off
cd /d D:\Echo\avatar
start /b node avatar-watch.js > watcher.log 2>&1
timeout /t 1 /nobreak >nul
start http://localhost:8765/
echo Echo avatar is now running!
