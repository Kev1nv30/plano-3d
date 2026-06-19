@echo off
setlocal
cd /d "%~dp0"

set PORT=4173
set URL=http://127.0.0.1:%PORT%/

echo.
echo  Plano 3D - Gimnasio en casa
echo  ---------------------------
echo  Servidor: %URL%
echo  Cierra esta ventana o pulsa Ctrl+C para detener.
echo.

where py >nul 2>&1
if %errorlevel% equ 0 (
    set PYTHON=py
    goto :run
)

where python >nul 2>&1
if %errorlevel% equ 0 (
    set PYTHON=python
    goto :run
)

echo Error: no se encontro Python.
echo Instala Python desde https://www.python.org/ o abre index.html en el navegador.
pause
exit /b 1

:run
start "" cmd /c "ping -n 2 127.0.0.1 >nul && start "" "%URL%""
%PYTHON% -m http.server %PORT%
