@echo off
cd /d "%~dp0tally-desktop-app"
title CA Kiran K. Shinde ^& Co. - Tally Desktop Bridge
color 0b

echo ==============================================================================
echo   CA KIRAN K. SHINDE ^& CO. - TALLYPRIME DESKTOP APP (v1.2)
echo ==============================================================================
echo.
echo Launching Kiran Tally Desktop Dashboard...
echo.

node node_modules\electron\cli.js .
