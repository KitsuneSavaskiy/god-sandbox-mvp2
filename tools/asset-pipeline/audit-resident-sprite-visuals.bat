@echo off
setlocal

node "%~dp0audit-resident-sprite-visuals.mjs" %*

if errorlevel 1 (
  echo.
  echo Resident sprite visual audit failed. Please check the message above.
  exit /b 1
)

echo.
echo Resident sprite visual audit completed.
endlocal
