@echo off
REM Local PostgreSQL Database Setup Script for RowBooster (Windows)
REM This script creates the database

echo ======================================
echo Local PostgreSQL Setup for RowBooster
echo ======================================
echo.

REM Default values
set DB_USER=postgres
set DB_NAME=rowbooster
set DB_HOST=localhost
set DB_PORT=5432

if not "%POSTGRES_USER%" == "" set DB_USER=%POSTGRES_USER%
if not "%POSTGRES_DB%" == "" set DB_NAME=%POSTGRES_DB%
if not "%POSTGRES_HOST%" == "" set DB_HOST=%POSTGRES_HOST%
if not "%POSTGRES_PORT%" == "" set DB_PORT=%POSTGRES_PORT%

echo Configuration:
echo   Database: %DB_NAME%
echo   User: %DB_USER%
echo   Host: %DB_HOST%
echo   Port: %DB_PORT%
echo.

REM Check if psql is available
where psql >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo ERROR: PostgreSQL (psql) is not installed or not in PATH
    echo Please install PostgreSQL from: https://www.postgresql.org/download/windows/
    echo Make sure to add PostgreSQL bin directory to your PATH
    pause
    exit /b 1
)

echo Creating database '%DB_NAME%'...
echo.

REM Create database - ignore error if already exists
psql -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -c "CREATE DATABASE %DB_NAME%;" 2>nul
if %ERRORLEVEL% equ 0 (
    echo [SUCCESS] Database '%DB_NAME%' created successfully
) else (
    echo [INFO] Database '%DB_NAME%' already exists
)

echo.
echo ======================================
echo Database setup complete!
echo ======================================
echo.
echo Next steps:
echo 1. Update .env file with your PostgreSQL credentials
echo 2. Run: npm install
echo 3. Run: npm run db:push (to create tables)
echo 4. Run: npx tsx scripts/init-db.ts (to initialize default data)
echo 5. Run: npm run dev (to start the application)
echo.
echo Your DATABASE_URL should be:
echo DATABASE_URL="postgresql://%DB_USER%:YOUR_PASSWORD@%DB_HOST%:%DB_PORT%/%DB_NAME%"
echo.
pause