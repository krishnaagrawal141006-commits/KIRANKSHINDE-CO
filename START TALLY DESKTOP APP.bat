@echo off
cd /d "%~dp0"
title CA Kiran K. Shinde & Co. - Tally Bridge Desktop Launcher
color 0b

echo ==============================================================================
echo   CA KIRAN K. SHINDE & CO. - TALLYPRIME DESKTOP APP (v1.3 LIVE)
echo   With WhatsApp Web Auto-Dispatcher & 1-Click Invoice PDF Desk
echo ==============================================================================
echo.
echo [1/2] Closing any old background or tray instances...
taskkill /F /IM "Kiran Tally Bridge.exe" /IM "electron.exe" >nul 2>&1

echo [2/2] Launching fresh Kiran Tally Bridge Desktop App...
start "" "%~dp0tally-desktop-app\dist\win-unpacked\Kiran Tally Bridge.exe"

echo App started! You can close this command window.
timeout /t 2 >nul
exit
