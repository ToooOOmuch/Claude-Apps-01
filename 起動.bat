@echo off
rem Start the app and open it in the browser.
rem This file is ASCII only so that it works with any Windows code page.

rem Re-run inside "cmd /k" so the window stays open even if something fails.
if not defined JANTAMA_STUDIO_WINDOW (
  set JANTAMA_STUDIO_WINDOW=1
  cmd /k "%~f0"
  exit /b
)

cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo [ERROR] Node.js is not installed.
  echo Install the LTS version from https://nodejs.org/ja and restart your PC.
  echo Then double-click this file again.
  echo.
  exit /b 1
)

if not exist node_modules (
  echo First-time setup. This can take a few minutes...
  call npm install
  if errorlevel 1 (
    echo.
    echo [ERROR] npm install failed. Check the messages above.
    exit /b 1
  )
)

echo.
echo Starting the app. Your browser will open automatically.
echo If it does not, open http://localhost:5173/ in your browser.
echo Keep this window open while you use the app. Close it to stop.
echo.
call npm run dev -- --open
