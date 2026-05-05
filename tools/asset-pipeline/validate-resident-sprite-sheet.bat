@echo off
setlocal

node "%~dp0validate-resident-sprite-sheet.mjs" %*

if errorlevel 1 (
  echo.
  echo Sprite sheet validation found an issue. Please check the message above.
  exit /b 1
)

echo.
echo Sprite sheet validation completed.
endlocal
