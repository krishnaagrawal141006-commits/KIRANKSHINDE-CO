@echo off
cd /d "%~dp0"
title Kiran K. Shinde & Co. - TallyPrime Cloud Sync Connector
color 0b

echo ==============================================================================
echo   KIRAN K. SHINDE & CO. - TALLYPRIME CLOUD CONNECTOR (v1.0)
echo ==============================================================================
echo.
echo Starting local connector bridge to website cloud...
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
    if exist "C:\Program Files\nodejs\node.exe" (
        "C:\Program Files\nodejs\node.exe" tally-connector\kiran-tally-sync.js
    ) else (
        echo [ERROR] Node.js is not found on this computer!
        echo Please install Node.js from https://nodejs.org
        pause
    )
    exit /b
)

node tally-connector\kiran-tally-sync.js

pause
