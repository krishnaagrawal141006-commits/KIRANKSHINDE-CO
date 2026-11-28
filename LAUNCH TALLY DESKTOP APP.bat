@echo off
cd /d "%~dp0tally-desktop-app"
title CA Kiran K. Shinde ^& Co. - Tally Desktop Bridge (Live Dev)
color 0b

echo ==============================================================================
echo   CA KIRAN K. SHINDE ^& CO. - TALLYPRIME DESKTOP APP (v1.3 LIVE)
echo   With WhatsApp Web Auto-Dispatcher ^& 1-Click Invoice PDF Desk
echo ==============================================================================
echo.
echo [1/2] Closing any old background or tray instances...
taskkill /F /IM "Kiran Tally Bridge.exe" /IM "electron.exe" >nul 2>&1

echo [2/2] Launching Kiran Tally Desktop Dashboard...
echo.

node node_modules\electron\cli.js .
