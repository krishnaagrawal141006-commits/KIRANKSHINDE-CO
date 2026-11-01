@echo off
cd /d "%~dp0"
title Kiran K. Shinde & Co. Website Server
echo Starting website at http://localhost:5175/
echo Keep this window open while using the website.
"C:\Program Files\nodejs\node.exe" server.js
pause
