@echo off
setlocal

REM Get the directory where this batch file is located
set "PROJECT_DIR=%~dp0"

echo ========================================
echo   True Friends - LAN Startup
echo ========================================
echo.
echo Your Local IP: 192.168.1.82
echo.

REM Start Backend Server
echo [1/2] Starting Backend Server...
start "Backend Server" cmd /k "cd /d "%PROJECT_DIR%backend" && node index.js"
timeout /t 3 /nobreak >nul

REM Start Frontend Server
echo [2/2] Starting Frontend Server...
start "Frontend Server" cmd /k "cd /d "%PROJECT_DIR%frontend" && npm run dev"

echo.
echo ========================================
echo   SERVICES STARTED FOR LAN!
echo ========================================
echo.
echo ACCESS INFORMATION:
echo 1. On THIS PC: http://localhost:5173
echo 2. On OTHER DEVICES (Phone/Tablet): http://192.168.1.82:5173
echo.
echo Make sure all devices are connected to the SAME Wi-Fi.
echo.
echo Press any key to close this window...
pause >nul
