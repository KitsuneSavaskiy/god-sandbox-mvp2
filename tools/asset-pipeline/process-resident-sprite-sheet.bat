@echo off
setlocal

node "%~dp0process-resident-sprite-sheet.mjs" %*

if errorlevel 1 (
  echo.
  echo Sprite sheet processing failed. Please check the message above.
  exit /b 1
)

echo.
echo Sprite sheet processing completed.
endlocal
