@echo off
chcp 65001 >nul
title Gumbound Web 2026 - Administrador de Servidores
cd /d "%~dp0"

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0servidor.ps1"
echo.
pause
