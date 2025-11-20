@echo off
setlocal enabledelayedexpansion

REM ================================
REM CONFIGURACIÓN ESPECÍFICA
REM ================================
REM Repo GitHub de PlanoPozoSanto
set "REPO_URL=https://github.com/fserickfse-maker/PlanoPozoSanto_2.git"

REM Rama principal
set "BRANCH=main"

REM Nombre del entorno virtual (ajusta si usas otro)
set "VENV_DIR=venv"

REM ================================
REM NO TOCAR DESDE AQUÍ (A MENOS QUE SEPAS)
REM ================================

cd /d "%~dp0"

echo.
echo =========================================
echo   SUBIDA AUTOMATIZADA: PlanoPozoSanto
echo =========================================
echo Carpeta del proyecto: %cd%
echo.

REM Verificar Git instalado
git --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Git no esta instalado o no se reconoce el comando 'git'.
    echo Instala Git desde la pagina oficial y vuelve a ejecutar este archivo.
    pause
    exit /b 1
)

REM Verificar URL configurada
if "%REPO_URL%"=="" (
    echo [ERROR] Falta configurar REPO_URL en el .bat
    pause
    exit /b 1
)

REM Generar requirements.txt si existe el venv
if exist "%VENV_DIR%\Scripts\python.exe" (
    echo [OK] Entorno virtual detectado en "%VENV_DIR%".
    echo Actualizando requirements.txt ...
    call "%VENV_DIR%\Scripts\activate.bat"
    if errorlevel 1 (
        echo [ADVERTENCIA] No se pudo activar el entorno virtual. Verifica el nombre o ruta.
    ) else (
        pip freeze > requirements.txt
        echo [OK] requirements.txt generado/actualizado.
    )
) else (
    echo [INFO] No se encontro "%VENV_DIR%\Scripts\python.exe".
    echo Si tu entorno tiene otro nombre, ajusta VENV_DIR en este archivo.
)

REM Crear .gitignore si no existe
if not exist ".gitignore" (
    echo Creando .gitignore ...
    (
        echo %VENV_DIR%/
        echo __pycache__/
        echo *.pyc
        echo .env
        echo .env.*
        echo .vscode/
        echo .idea/
    ) > .gitignore
    echo [OK] .gitignore creado.
) else (
    echo [OK] .gitignore ya existe.
)

REM Inicializar repo git si no existe
if not exist ".git" (
    echo Inicializando repositorio git ...
    git init
    git branch -M %BRANCH%
    git remote add origin "%REPO_URL%"
) else (
    echo [OK] Repositorio git ya inicializado.
)

REM Asegurar remoto origin correcto
git remote get-url origin >nul 2>&1
if errorlevel 1 (
    echo No existe remoto origin. Agregando...
    git remote add origin "%REPO_URL%"
) else (
    for /f "tokens=*" %%u in ('git remote get-url origin') do set "CURRENT_URL=%%u"
    if /I not "!CURRENT_URL!"=="%REPO_URL%" (
        echo [INFO] El remoto origin actual es:
        echo   !CURRENT_URL!
        echo Se actualizara a:
        echo   %REPO_URL%
        git remote set-url origin "%REPO_URL%"
    )
    echo [OK] Remoto origin configurado.
)

echo.
echo Agregando archivos al area de staging...
git add .

REM Verificar si hay cambios para commit
git diff --cached --quiet
if %errorlevel%==0 (
    echo [INFO] No hay cambios nuevos para commitear.
) else (
    set /p COMMIT_MSG="Mensaje de commit (Enter para usar uno por defecto): "
    if "!COMMIT_MSG!"=="" (
        set "COMMIT_MSG=Update PlanoPozoSanto"
    )
    git commit -m "!COMMIT_MSG!"
)

echo.
echo Haciendo push a GitHub (rama %BRANCH%)...
git push -u origin %BRANCH%

echo.
echo =========================================
echo   PROCESO COMPLETADO PARA PlanoPozoSanto
echo =========================================
pause
endlocal
exit /b 0
