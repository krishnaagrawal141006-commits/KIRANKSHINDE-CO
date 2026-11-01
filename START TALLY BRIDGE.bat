@echo off
cd /d "%~dp0"
title Tally Invoice Bridge
echo Starting Tally bridge on http://127.0.0.1:9100
echo Keep this window open while testing.
set /p TALLY_BRIDGE_TOKEN=Enter a private bridge token: 
"C:\Program Files\nodejs\node.exe" tally-bridge.js
pause
