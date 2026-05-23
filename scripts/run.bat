@echo off
echo Lingxi - Starting / Restarting...
taskkill /F /IM node.exe >nul 2>&1
taskkill /F /IM python.exe >nul 2>&1
timeout /t 2 /nobreak >nul

echo Starting Backend...
start "Lingxi-Backend" cmd /c "cd /d %~dp0..\backend && uv run main.py"
echo Waiting for backend to be ready on port 8000...

:wait_backend
timeout /t 3 /nobreak >nul
curl -s -o nul -w "%%{http_code}" http://localhost:8000/api/health 2>nul | findstr "200" >nul
if %errorlevel% neq 0 (
    echo Backend not ready yet, retrying...
    goto wait_backend
)

echo Backend is ready! Starting Frontend...
start "Lingxi-Frontend" cmd /c "cd /d %~dp0.. && npm run dev"

echo Backend: http://localhost:8000/docs
echo Frontend: http://localhost:3000
echo Both services started. You can close this window.
exit