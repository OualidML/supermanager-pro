@echo off
title HOUARI ACHAACH - SuperManager Pro POS
color 0b
cls

echo ======================================================================
echo          HOUARI ACHAACH - PAINT SHOP & PVC SOLUTIONS
echo               SuperManager Pro - Desktop Standalone
echo ======================================================================
echo.
echo [*] Initialisation de l'application hors-ligne...
echo [*] Lancement du serveur local sur http://localhost:4173 ...
echo.

cd /d "%~dp0"

:: Check if Node is installed, if not, launch via PowerShell lightweight server
where node >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo [OK] Environnement standard detecte.
    start "" "http://localhost:4173"
    npx vite preview --port 4173 --host 0.0.0.0
) else (
    echo [*] Lancement du serveur autonome integre Windows...
    start "" "http://localhost:4173"
    powershell -NoProfile -ExecutionPolicy Bypass -Command "$listener = New-Object System.Net.HttpListener; $listener.Prefixes.Add('http://localhost:4173/'); $listener.Start(); Write-Host 'Serveur actif sur http://localhost:4173'; while ($listener.IsListening) { $context = $listener.GetContext(); $req = $context.Request; $res = $context.Response; $path = $req.Url.LocalPath.TrimStart('/'); if ([string]::IsNullOrEmpty($path)) { $path = 'index.html' }; $filePath = Join-Path (Join-Path (Get-Location) 'dist') $path; if (-not (Test-Path $filePath)) { $filePath = Join-Path (Join-Path (Get-Location) 'dist') 'index.html' }; $bytes = [System.IO.File]::ReadAllBytes($filePath); $res.ContentLength64 = $bytes.Length; if ($filePath.EndsWith('.html')) { $res.ContentType = 'text/html; charset=utf-8' } elseif ($filePath.EndsWith('.js')) { $res.ContentType = 'application/javascript' } elseif ($filePath.EndsWith('.css')) { $res.ContentType = 'text/css' } elseif ($filePath.EndsWith('.jpg')) { $res.ContentType = 'image/jpeg' } elseif ($filePath.EndsWith('.png')) { $res.ContentType = 'image/png' }; $res.OutputStream.Write($bytes, 0, $bytes.Length); $res.OutputStream.Close() }"
)

pause
