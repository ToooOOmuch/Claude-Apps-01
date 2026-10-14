@echo off
rem ダブルクリックでアプリを起動し、ブラウザで開く
rem （日本語版 Windows で読めるよう、このファイルは Shift_JIS で保存している）
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo [エラー] Node.js が見つかりません。
  echo https://nodejs.org/ja から LTS 版をインストールしてから、もう一度ダブルクリックしてください。
  echo インストール後は、PC を再起動すると確実です。
  echo.
  pause
  exit /b 1
)

if not exist node_modules (
  echo 初回の準備をしています。数分かかることがあります...
  call npm install
  if errorlevel 1 (
    echo.
    echo [エラー] 準備（npm install）に失敗しました。上のメッセージを確認してください。
    pause
    exit /b 1
  )
)

echo.
echo アプリを起動します。ブラウザが自動で開きます。
echo 開かないときは、ブラウザで http://localhost:5173/ を開いてください。
echo 終わるときは、この画面を閉じてください。
echo.
call npm run dev -- --open

echo.
echo アプリが止まりました。上にエラーが出ていれば、その内容を確認してください。
pause
