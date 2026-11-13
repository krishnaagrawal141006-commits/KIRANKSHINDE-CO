@echo off
cd /d "%~dp0"
title Launching Kiran Tally Bridge Desktop App...

echo Starting CA Kiran K. Shinde ^& Co. Tally Desktop Bridge...
start "" "%~dp0tally-desktop-app\dist\win-unpacked\Kiran Tally Bridge.exe"
exit
