@echo off
cd /d "%~dp0tally-connector"
title CA Kiran K. Shinde ^& Co. - WhatsApp Python Auto-Dispatcher
color 0a

echo ==============================================================================
echo   CA KIRAN K. SHINDE ^& CO. - WHATSAPP WEB PYTHON AUTO-DISPATCHER
echo   Polls Admin Panel Queue ^& Sends Message + 1:1 Bill PDF Automatically
echo ==============================================================================
echo.

if not exist ".venv\Scripts\python.exe" (
    echo [1/3] Creating local Python virtual environment...
    python -m venv .venv
)

".venv\Scripts\python.exe" -c "import playwright, segno" >nul 2>&1
if %errorlevel% neq 0 (
    echo [2/3] Installing Python dependencies (playwright + segno QR)...
    ".venv\Scripts\pip.exe" install -r requirements.txt
)

echo [3/3] Starting WhatsApp Web Auto-Dispatcher (with Bill PDF Attachment)...
echo (Keep the Chrome WhatsApp window open/minimized - QR scan is 1-time only!)
echo.
".venv\Scripts\python.exe" whatsapp_dispatcher.py %*
pause
