@echo off
cd /d "%~dp0tally-desktop-app"
title Building Kiran Tally Standalone .EXE
color 0a

echo ==============================================================================
echo   CA KIRAN K. SHINDE ^& CO. - BUILDING TALLYPRIME .EXE APPLICATION
echo ==============================================================================
echo.
echo Packaging into standalone Windows executable...
echo.

node node_modules\electron-builder\cli.js --win portable

echo.
echo ==============================================================================
echo   BUILD COMPLETE! Check folder: tally-desktop-app\dist\
echo ==============================================================================
echo.
pause
