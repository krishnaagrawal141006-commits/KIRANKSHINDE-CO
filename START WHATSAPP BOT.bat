@echo off
cd /d "%~dp0tally-connector"
title CA Kiran K. Shinde & Co. - WhatsApp Python Auto-Dispatcher
color 0a

echo ==============================================================================
echo   CA KIRAN K. SHINDE ^& CO. - WHATSAPP WEB PYTHON AUTO-DISPATCHER
echo   Polls Admin Panel Queue ^& Sends Messages Automatically via Office WhatsApp
echo ==============================================================================
echo.

if not exist ".venv\Scripts\python.exe" (
    echo [1/3] Creating local Python virtual environment...
    python -m venv .venv
)

if not exist ".venv\Lib\site-packages\playwright" (
    echo [2/3] Installing Playwright browser automation package...
    .venv\Scripts\pip.exe install playwright
)

echo [3/3] Starting WhatsApp Web Auto-Dispatcher...
echo (Keep the Chrome WhatsApp window open/minimized - QR scan is 1-time only!)
echo.
.venv\Scripts\python.exe whatsapp_dispatcher.py
pause
