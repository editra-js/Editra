REM Version: 2.0.0
REM Product: Editra
REM Version: 2.0.0
REM Purpose: Starts the local Editra HTTP server on Windows.
REM Licensing: MIT License (open source)
@echo off
cd /d "%~dp0"
start "Editra Server" /min node serve.js
timeout /t 1 /nobreak >nul
start "" "http://localhost:8080"
