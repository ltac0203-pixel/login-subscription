@echo off
chcp 65001 >nul
echo Tsunagi Deployment Prep v2.0 (2025-10-04): clean deployment dir, copy backend, build frontend, create .htaccess, verify structure.
echo.

:: Check if Node.js is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

:: Clean and create deployment directory
echo [1/7] Creating deployment directory...
if exist deployment rd /s /q deployment
mkdir deployment
mkdir deployment\api
mkdir deployment\api\controllers
mkdir deployment\api\core
mkdir deployment\api\config
mkdir deployment\api\database

echo [1/7] OK

:: Copy backend files
echo [2/7] Copying backend files...
xcopy /s /y /q backend\controllers\*.php deployment\api\controllers\ >nul
xcopy /s /y /q backend\core\*.php deployment\api\core\ >nul
xcopy /s /y /q backend\config\*.php deployment\api\config\ >nul
xcopy /s /y /q backend\database\*.sql deployment\api\database\ >nul
copy /y backend\index.php deployment\api\index.php >nul
if exist backend\server.php copy /y backend\server.php deployment\api\server.php >nul
echo [2/7] OK

:: Copy .env file
echo [3/7] Copying environment file...
if exist .env (
    copy /y .env deployment\.env >nul
) else (
    echo     WARNING: .env file not found!
)

echo [3/7] OK

:: Build frontend
echo [4/7] Building frontend assets...
cd frontend

:: Check if node_modules exists
if not exist node_modules\ (
    echo     WARNING: node_modules not found. Running npm install...
    call npm install
    if %errorlevel% neq 0 (
        echo [4/7] FAIL
        echo     ERROR: npm install failed!
        cd ..
        pause
        exit /b 1
    )
)

:: Build the project
call npm run build
if %errorlevel% neq 0 (
    echo [4/7] FAIL
    echo     ERROR: Frontend build failed!
    echo     Please check the error messages above and fix any issues.
    cd ..
    pause
    exit /b 1
)
cd ..
echo [4/7] OK

:: Copy frontend dist files
echo [5/7] Copying frontend files to deployment...
xcopy /s /y /q frontend\dist\*.* deployment\ >nul
if %errorlevel% neq 0 (
    echo [5/7] FAIL
    echo     ERROR: Failed to copy frontend files!
    pause
    exit /b 1
)
echo [5/7] OK

:: Create .htaccess for Apache
echo [6/7] Creating .htaccess file...
if exist .htaccess.template (
    copy /y .htaccess.template deployment\.htaccess >nul
    if %errorlevel% neq 0 (
        echo [6/7] FAIL
        echo     ERROR: Failed to copy .htaccess file!
        pause
        exit /b 1
    )
) else (
    echo     WARNING: .htaccess.template not found! Creating basic .htaccess...
    powershell -Command "Set-Content -Path 'deployment\.htaccess' -Value @('<IfModule mod_rewrite.c>','    RewriteEngine On','','    # Force HTTPS','    RewriteCond %%{HTTPS} off','    RewriteRule ^(.*)$ https://%%{HTTP_HOST}/%%{REQUEST_URI} [L,R=301]','','    # API requests','    RewriteCond %%{REQUEST_URI} ^/api/','    RewriteRule ^api/(.*)$ api/index.php [L,QSA]','','    # SPA fallback','    RewriteCond %%{REQUEST_FILENAME} !-f','    RewriteCond %%{REQUEST_FILENAME} !-d','    RewriteRule ^.*$ /index.html [L]','</IfModule>','','# Security headers','<IfModule mod_headers.c>','    Header set X-Content-Type-Options \"nosniff\"','    Header set X-Frame-Options \"SAMEORIGIN\"','    Header set X-XSS-Protection \"1; mode=block\"','</IfModule>')"
    if %errorlevel% neq 0 (
        echo [6/7] FAIL
        echo     ERROR: Failed to create .htaccess file!
        pause
        exit /b 1
    )
)

echo [6/7] OK

:: Verify deployment structure
echo.
echo [7/7] Verifying deployment structure...
set "VERIFICATION_FAILED=0"

if not exist deployment\index.html (
    echo     ERROR: index.html not found!
    set "VERIFICATION_FAILED=1"
)
if not exist deployment\.htaccess (
    echo     ERROR: .htaccess not found!
    set "VERIFICATION_FAILED=1"
)
if not exist deployment\.env (
    echo     WARNING: .env not found! You will need to create it manually.
)
if not exist deployment\api\index.php (
    echo     ERROR: api/index.php not found!
    set "VERIFICATION_FAILED=1"
)
if not exist deployment\assets\ (
    echo     ERROR: assets directory not found!
    set "VERIFICATION_FAILED=1"
)

if "%VERIFICATION_FAILED%"=="1" (
    echo.
    echo [7/7] FAIL
    echo     Verification FAILED! Please check the errors above.
    pause
    exit /b 1
)

echo [7/7] OK
echo.
echo Deployment preparation completed. The 'deployment' folder is ready for upload.
echo Next steps: upload deployment/ to your web server, set DB using deployment/api/database/create_tables.sql and update deployment/.env.
echo Then ensure Apache mod_rewrite and mod_headers are enabled and test at https://tsunagi.space/.
echo.
pause
