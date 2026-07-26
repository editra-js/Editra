REM © Minsoft. All rights reserved.
REM Product: Editra (Minsoft product)
REM Author: Editra Team
REM Version: 1.15.0
REM Purpose: Starts the local Editra HTTP server on Windows.
REM Licensing: MIT License (open source)
@echo off
cd /d "%~dp0"
start "Editra Server" /min node serve.js
timeout /t 1 /nobreak >nul
start "" "http://localhost:8080"
