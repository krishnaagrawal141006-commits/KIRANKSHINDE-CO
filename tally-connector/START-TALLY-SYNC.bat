@echo off
cd /d "%~dp0"
title Kiran K. Shinde & Co. - TallyPrime Cloud Sync Connector
color 0b

echo ==============================================================================
echo   KIRAN K. SHINDE & CO. - TALLYPRIME CLOUD CONNECTOR (v1.0)
echo ==============================================================================
echo.
echo Starting local connector bridge to https://cakiran.co.in ...
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not found on this computer!
    echo Please install Node.js from https://nodejs.org or contact your system admin.
    echo.
    pause
    exit /b
)

echo [OK] Node.js runtime detected.
echo [OK] Connecting to local TallyPrime (Port 9000) and Cloud Sync Queue...
echo.
echo Keep this window OPEN while working in TallyPrime.
echo Minimized is fine!
echo ==============================================================================
echo.

node kiran-tally-sync.js

pause
