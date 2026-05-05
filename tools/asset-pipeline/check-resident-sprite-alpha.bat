@echo off
setlocal

node "%~dp0check-resident-sprite-alpha.mjs" %*

if errorlevel 1 (
  echo.
  echo Alpha check found something to review. Please check the message above.
  exit /b 1
)

echo.
echo Alpha check completed.
endlocal
