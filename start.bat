@echo off
rem Double-click to start the Local Face website on http://localhost:3000
cd /d "%~dp0"
if not exist node_modules (
    echo Installing dependencies...
    call npm install
)
node server.js
pause
