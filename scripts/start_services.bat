@echo off
chcp 65001 >nul
title Lingxi Service Starter / 服务启动器

:menu
echo ============================================================
echo   Lingxi Service Starter (服务启动器)
echo ============================================================
echo.
echo   [1] Start Backend Service (启动后端服务)
echo   [2] Start Frontend Dev Server (启动前端开发服务器)
echo   [3] Start Both Services (同时启动前后端)
echo   [4] Exit (退出)
echo.
set /p choice=Enter your choice (1-4):

if "%choice%"=="1" goto backend_only
if "%choice%"=="2" goto frontend_only
if "%choice%"=="3" goto both
if "%choice%"=="4" goto exit_script
echo Invalid option, please try again. (无效选项，请重新输入。)
goto menu

:backend_only
echo.
echo Starting Backend Service... (正在启动后端服务)
start "Lingxi-Backend" cmd /c "cd /d %~dp0..\backend && uv run main.py"
echo Backend started. API Docs: http://localhost:8000/docs
goto menu

:frontend_only
echo.
echo Starting Frontend Dev Server... (正在启动前端开发服务器)
start "Lingxi-Frontend" cmd /c "cd /d %~dp0.. && npm run dev"
echo Frontend started. Visit: http://localhost:3000
goto menu

:both
echo.
echo Cleaning up previous processes... (正在清理已有进程)
taskkill /F /IM node.exe >nul 2>&1
taskkill /F /IM python.exe >nul 2>&1
timeout /t 2 /nobreak >nul

echo Starting Backend Service... (正在启动后端服务)
start "Lingxi-Backend" cmd /c "cd /d %~dp0..\backend && uv run main.py"
echo Waiting for backend to be ready on port 8000... (等待后端就绪)

:wait_backend
timeout /t 3 /nobreak >nul
curl -s -o nul -w "%%{http_code}" http://localhost:8000/api/health 2>nul | findstr "200" >nul
if %errorlevel% neq 0 (
    echo Backend not ready yet, retrying... (后端尚未就绪，继续等待)
    goto wait_backend
)

echo Backend is ready! Starting Frontend Dev Server... (后端已就绪，正在启动前端)
start "Lingxi-Frontend" cmd /c "cd /d %~dp0.. && npm run dev"

echo Backend API Docs: http://localhost:8000/docs
echo Frontend Page: http://localhost:3000
echo Both services are running. You may close this window.
echo (前后端均已启动，您可以关闭本窗口。)
goto menu

:exit_script
exit