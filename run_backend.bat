@echo off
echo Starting True Friends Backend...
cd backend
if not exist node_modules (
    echo Installing dependencies...
    call npm install
)
node index.js
pause
