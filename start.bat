@echo off
REM 中文：双击入口，使用 PowerShell 执行根目录的一键启动脚本。
REM English: Double-click entry point that runs the root one-click startup script through PowerShell.

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0start.ps1"

if errorlevel 1 (
  echo.
  echo Startup failed. See the message above.
  pause
)
