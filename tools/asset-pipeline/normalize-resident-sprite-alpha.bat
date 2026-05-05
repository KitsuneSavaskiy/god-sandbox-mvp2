@echo off
setlocal

node "%~dp0normalize-resident-sprite-alpha.mjs" %*

if errorlevel 1 (
  echo.
  echo Alpha normalization failed. Please check the message above.
  exit /b 1
)

echo.
echo Alpha normalization completed.
endlocal
