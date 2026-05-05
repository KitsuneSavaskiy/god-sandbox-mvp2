@echo off
setlocal

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0import-resident-sprite-source.ps1" %*

if errorlevel 1 (
  echo.
  echo Sprite source import failed. Please check the message above.
  exit /b 1
)

echo.
echo Sprite source import completed.
endlocal
