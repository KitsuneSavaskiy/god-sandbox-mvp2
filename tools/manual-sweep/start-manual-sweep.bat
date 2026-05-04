@echo off
setlocal

cd /d "%~dp0..\.."

if not exist ".local\manual-sweep" mkdir ".local\manual-sweep"

echo GodSandbox manual sweep mode
echo Runtime files may be written under .local\manual-sweep.
echo The browser will open /sandbox?mode=manual-sweep.
echo Press Ctrl+C in this window to stop the dev server.
echo.

npm run app:manual-sweep
