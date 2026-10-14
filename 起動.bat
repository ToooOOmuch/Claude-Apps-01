@echo off
rem ダブルクリックでアプリを起動し、ブラウザで開く
chcp 65001 >nul
cd /d "%~dp0"
if not exist node_modules (
  echo 初回の準備をしています...
  call npm install
)
echo アプリを起動します。終わるときはこの画面を閉じてください。
call npm run dev -- --open
