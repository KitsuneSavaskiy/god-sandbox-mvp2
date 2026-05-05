@echo off
setlocal

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup-resident-asset-folders.ps1" %*

if errorlevel 1 (
  echo.
  echo Folder setup failed. Please check the message above.
  exit /b 1
)

echo.
echo Folder setup completed.
endlocal
