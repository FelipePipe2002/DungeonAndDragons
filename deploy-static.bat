@echo off
setlocal EnableExtensions EnableDelayedExpansion

cd /d "%~dp0"

set "ROOT_DIR=%~dp0"
set "FRONTEND_DIR=%ROOT_DIR%Frontend"
set "BACKEND_DIR=%ROOT_DIR%Backend"

set "OPENSSH_DIR=%SystemRoot%\System32\OpenSSH"
set "SCP=%OPENSSH_DIR%\scp.exe"
set "SSH=%OPENSSH_DIR%\ssh.exe"

set "REMOTE_USER=felipepipe"
set "REMOTE_HOST=192.168.0.107"

rem --- Next app directory (systemd WorkingDirectory)
set "REMOTE_APP_DIR=/home/felipepipe/dnd-app"
set "REMOTE_TMP=/home/felipepipe/dnd-tmp"

rem --- Static assets
set "REMOTE_STAGING=/home/felipepipe/dnd-upload"
set "REMOTE_STATIC_TARGET=/var/www/dnd"

rem --- Backend jar target
set "REMOTE_BACKEND_DIR=/home/felipepipe/dnd-backend"
set "BACKEND_JAR=dnd-backend-0.0.1-SNAPSHOT.jar"

rem --- systemd service names (segun tu systemctl cat)
set "FRONTEND_SERVICE_NAME=dnd-app.service"
set "BACKEND_SERVICE_NAME=dnd-backend.service"

rem --- Local archive name
set "APP_ARCHIVE=dnd-app-src.tgz"

if not exist "%SCP%" (
  echo No se encontro scp.exe en "%SCP%".
  exit /b 1
)

if not exist "%SSH%" (
  echo No se encontro ssh.exe en "%SSH%".
  exit /b 1
)

if not exist "%FRONTEND_DIR%\package.json" (
  echo No se encontro el frontend en "%FRONTEND_DIR%".
  exit /b 1
)

if not exist "%BACKEND_DIR%\pom.xml" (
  echo No se encontro el backend en "%BACKEND_DIR%".
  exit /b 1
)

echo ==================================================
echo Deploy to %REMOTE_USER%@%REMOTE_HOST%
echo Frontend app dir: %REMOTE_APP_DIR%
echo Static to:        %REMOTE_STATIC_TARGET%
echo Backend jar to:   %REMOTE_BACKEND_DIR%/%BACKEND_JAR%
echo Front service:    %FRONTEND_SERVICE_NAME%
echo Back service:     %BACKEND_SERVICE_NAME%
echo ==================================================

rem --------------------------------------------------
rem 0) Build local Next (y assets si queres)
rem --------------------------------------------------
echo [0/11] Ensuring local frontend deps + building...
pushd "%FRONTEND_DIR%"
if errorlevel 1 goto :error

if not exist "node_modules\.bin\next.cmd" (
  call npm install
  if errorlevel 1 goto :error
)

call npm run build
if errorlevel 1 goto :error

call npm run build:assets
if errorlevel 1 goto :error

popd

rem --------------------------------------------------
rem 1) Build backend jar
rem --------------------------------------------------
echo [1/11] Building backend jar...
pushd "%BACKEND_DIR%"
if errorlevel 1 goto :error

if exist "mvnw.cmd" (
  call mvnw.cmd clean package
) else (
  call mvn clean package
)
if errorlevel 1 goto :error

if not exist "target\%BACKEND_JAR%" (
  echo No se genero "target\%BACKEND_JAR%".
  exit /b 1
)

popd

rem --------------------------------------------------
rem 2) Pack app source (sin node_modules/.git/.next)
rem --------------------------------------------------
echo [2/11] Packing app source to %APP_ARCHIVE%...
pushd "%FRONTEND_DIR%"
if errorlevel 1 goto :error

if exist "%APP_ARCHIVE%" del /q "%APP_ARCHIVE%"

rem Usa tar con excludes (Windows tar soporta --exclude)
tar -czf "%APP_ARCHIVE%" ^
  --exclude="node_modules" ^
  --exclude=".git" ^
  --exclude=".next" ^
  --exclude="*.tgz" ^
  --exclude="*.tar.gz" ^
  --exclude="*.log" ^
  --exclude="%APP_ARCHIVE%" ^
  .

if errorlevel 1 goto :error
popd

rem --------------------------------------------------
rem 3) Upload app archive + extract on server
rem --------------------------------------------------
echo [3/11] Uploading app archive...
"%SSH%" "%REMOTE_USER%@%REMOTE_HOST%" "rm -rf %REMOTE_TMP% && mkdir -p %REMOTE_TMP%"
if errorlevel 1 goto :error

"%SCP%" "%FRONTEND_DIR%\%APP_ARCHIVE%" "%REMOTE_USER%@%REMOTE_HOST%:%REMOTE_TMP%/%APP_ARCHIVE%"
if errorlevel 1 goto :error

echo [3b/11] Stopping frontend service to avoid race conditions...
"%SSH%" -t "%REMOTE_USER%@%REMOTE_HOST%" "sudo systemctl stop %FRONTEND_SERVICE_NAME% || true"
if errorlevel 1 goto :error

rem --------------------------------------------------
rem 4) Extract app archive on server (to REMOTE_APP_DIR)
rem --------------------------------------------------
echo [4/11] Extracting archive into %REMOTE_APP_DIR%...
"%SSH%" -t "%REMOTE_USER%@%REMOTE_HOST%" "mkdir -p %REMOTE_APP_DIR% && tar -xzf %REMOTE_TMP%/%APP_ARCHIVE% -C %REMOTE_APP_DIR% && rm -f %REMOTE_TMP%/%APP_ARCHIVE% && rmdir %REMOTE_TMP% 2>/dev/null || rm -rf %REMOTE_TMP%"
if errorlevel 1 goto :error

rem --------------------------------------------------
rem 5) Prepare remote staging for static assets
rem --------------------------------------------------
echo [5/11] Preparing remote staging folder...
"%SSH%" "%REMOTE_USER%@%REMOTE_HOST%" "rm -rf %REMOTE_STAGING% && mkdir -p %REMOTE_STAGING%"
if errorlevel 1 goto :error

rem --------------------------------------------------
rem 6) Upload local static bundle to staging
rem --------------------------------------------------
echo [6/11] Uploading static files with scp...
"%SCP%" -r "%FRONTEND_DIR%\deploy-static\*" "%REMOTE_USER%@%REMOTE_HOST%:%REMOTE_STAGING%/"
if errorlevel 1 goto :error

rem --------------------------------------------------
rem 7) Replace /var/www/dnd with staging content (static)
rem --------------------------------------------------
echo [7/11] Replacing %REMOTE_STATIC_TARGET% content...
"%SSH%" -t "%REMOTE_USER%@%REMOTE_HOST%" "sudo mkdir -p %REMOTE_STATIC_TARGET% && sudo find %REMOTE_STATIC_TARGET% -mindepth 1 -maxdepth 1 -exec rm -rf {} + && sudo cp -a %REMOTE_STAGING%/. %REMOTE_STATIC_TARGET%/ && rm -rf %REMOTE_STAGING%"
if errorlevel 1 goto :error

rem --------------------------------------------------
rem 8) Upload backend jar
rem --------------------------------------------------
echo [8/11] Uploading backend jar...
"%SSH%" "%REMOTE_USER%@%REMOTE_HOST%" "mkdir -p %REMOTE_BACKEND_DIR%"
if errorlevel 1 goto :error

"%SCP%" "%BACKEND_DIR%\target\%BACKEND_JAR%" "%REMOTE_USER%@%REMOTE_HOST%:%REMOTE_BACKEND_DIR%/%BACKEND_JAR%"
if errorlevel 1 goto :error

rem --------------------------------------------------
rem 9) Install + build Next on server
rem --------------------------------------------------
echo [9/11] Installing deps + building Next on server...
"%SSH%" -t "%REMOTE_USER%@%REMOTE_HOST%" "cd %REMOTE_APP_DIR% && rm -rf .next && npm install --include=dev --no-fund --no-audit && npm run build"
if errorlevel 1 goto :error

rem --------------------------------------------------
rem 10) Restart backend service + logs
rem --------------------------------------------------
echo [10/11] Restarting service %BACKEND_SERVICE_NAME% and showing logs...
"%SSH%" -t "%REMOTE_USER%@%REMOTE_HOST%" "sudo systemctl restart %BACKEND_SERVICE_NAME% && sudo systemctl --no-pager --full status %BACKEND_SERVICE_NAME% && echo '--- journal last 80 lines ---' && sudo journalctl -u %BACKEND_SERVICE_NAME% -n 80 --no-pager"
if errorlevel 1 goto :error

rem --------------------------------------------------
rem 11) Restart frontend systemd service + logs
rem --------------------------------------------------
echo [11/11] Restarting service %FRONTEND_SERVICE_NAME% and showing logs...
"%SSH%" -t "%REMOTE_USER%@%REMOTE_HOST%" "sudo systemctl start %FRONTEND_SERVICE_NAME% && sudo systemctl --no-pager --full status %FRONTEND_SERVICE_NAME% && echo '--- journal last 80 lines ---' && sudo journalctl -u %FRONTEND_SERVICE_NAME% -n 80 --no-pager"
if errorlevel 1 goto :error

echo.
echo Deployment completed successfully.
exit /b 0

:error
echo.
echo Deployment failed. Exit code: %errorlevel%
exit /b %errorlevel%
