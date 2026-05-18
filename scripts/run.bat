@echo off
echo Lingxi - Starting / Restarting...
taskkill /F /IM node.exe >nul 2>&1
taskkill /F /IM python.exe >nul 2>&1
timeout /t 2 /nobreak >nul
start "Lingxi-Backend" cmd /c "cd /d %~dp0..\backend && uv run main.py"
start "Lingxi-Frontend" cmd /c "cd /d %~dp0.. && npm run dev"
echo Backend: http://localhost:8000/docs
echo Frontend: http://localhost:3000
timeout /t 3 /nobreak >nul
exit
