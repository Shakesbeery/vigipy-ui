@echo off
title vigipy-ui Launcher
cd /d "%~dp0"
echo ======================================================================
echo   Starting vigipy-ui Pharmacovigilance Workstation...
echo ======================================================================

set "PY_EXE="
if exist "%USERPROFILE%\anaconda3\envs\vigipy\python.exe" (
    set "PY_EXE=%USERPROFILE%\anaconda3\envs\vigipy\python.exe"
) else if exist "C:\Users\shake\anaconda3\envs\vigipy\python.exe" (
    set "PY_EXE=C:\Users\shake\anaconda3\envs\vigipy\python.exe"
) else if exist "%CONDA_PREFIX%\python.exe" (
    set "PY_EXE=%CONDA_PREFIX%\python.exe"
) else (
    set "PY_EXE=python"
)

"%PY_EXE%" run_app.py
if errorlevel 1 (
    echo.
    echo [!] Launch terminated with exit code %errorlevel%.
    pause
)
