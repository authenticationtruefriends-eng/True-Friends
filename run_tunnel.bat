@echo off
echo Starting Cloudflare Quick Tunnel...
echo.
echo NOTE: If you see a 502 error, ensure your Vite server is running at the address below.
echo.
cloudflared.exe tunnel --url https://localhost:5173 --no-tls-verify
pause
