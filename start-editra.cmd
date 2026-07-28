@echo off
cd /d "%~dp0"
start "Editra Server" /min node serve.js
timeout /t 1 /nobreak >nul
start "" "http://localhost:8080"
