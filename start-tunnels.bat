@echo off
echo ========================================
echo   True Friends - Starting Tunnels
echo ========================================
echo.

REM Start backend tunnel in a new window
echo [1/2] Starting Backend Tunnel (Port 5000)...
start "Backend Tunnel" cmd /k "cd /d %~dp0backend && npx localtunnel --port 5000 && pause"

REM Wait 3 seconds
timeout /t 3 /nobreak >nul

REM Start frontend tunnel in a new window
echo [2/2] Starting Frontend Tunnel (Port 5173)...
start "Frontend Tunnel" cmd /k "cd /d %~dp0frontend && npx localtunnel --port 5173 && pause"

echo.
echo ========================================
echo   Tunnels Started!
echo ========================================
echo.
echo IMPORTANT: Copy the Backend Tunnel URL and paste it in your website:
echo   1. Go to https://truefriendss.com:5173
echo   2. Triple-click the logo
echo   3. Paste the Backend Tunnel URL
echo.
echo Press any key to exit this window...
pause >nul
