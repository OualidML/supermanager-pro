@echo off
title HOUARI ACHAACH - SuperManager Pro POS
cd /d "%~dp0"

:: Launch the standalone native Windows executable
if exist "SuperManager-Pro.exe" (
    start "" "SuperManager-Pro.exe"
    exit
)

:: If exe is missing, fallback to node/browser
where node >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    start "" "http://localhost:4173"
    npx vite preview --port 4173 --host 127.0.0.1
) else (
    start "" "http://127.0.0.1:4173"
)
