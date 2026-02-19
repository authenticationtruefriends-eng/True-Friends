@echo off
setlocal

REM Get the directory where this batch file is located
set "PROJECT_DIR=%~dp0"

echo ========================================
echo   True Friends - Complete Startup
echo ========================================
echo.
echo Project Directory: %PROJECT_DIR%
echo.

REM Start Backend Server
echo [1/4] Starting Backend Server...
start "Backend Server" cmd /k "cd /d "%PROJECT_DIR%backend" && node index.js"
timeout /t 3 /nobreak >nul

REM Start Frontend Server
echo [2/4] Starting Frontend Server...
start "Frontend Server" cmd /k "cd /d "%PROJECT_DIR%frontend" && npm run dev"
timeout /t 5 /nobreak >nul

REM Start Backend Tunnel
echo [3/4] Starting Backend Tunnel...
start "Backend Tunnel - COPY THIS URL" cmd /k "cd /d "%PROJECT_DIR%" && npx localtunnel --port 5000"
timeout /t 3 /nobreak >nul

REM Start Frontend Tunnel
echo [4/4] Starting Frontend Tunnel...
start "Frontend Tunnel" cmd /k "cd /d "%PROJECT_DIR%" && npx localtunnel --port 5173"

echo.
echo ========================================
echo   ALL SERVICES STARTED!
echo ========================================
echo.
echo NEXT STEPS:
echo 1. Look at the "Backend Tunnel - COPY THIS URL" window
echo 2. Copy the URL that appears (https://something.loca.lt)
echo 3. Go to your website
echo 4. Triple-click the logo
echo 5. Paste the Backend Tunnel URL
echo.
echo Press any key to close this window...
pause >nul
