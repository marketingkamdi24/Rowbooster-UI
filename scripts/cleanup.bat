@echo off
echo ============================================
echo Rowbooster Project Cleanup Script
echo ============================================
echo.

echo [1/7] Stopping all Node.js processes...
taskkill /F /IM node.exe 2>nul
taskkill /F /IM tsx.exe 2>nul
echo Node.js processes stopped.
echo.

echo [2/7] Killing processes on common development ports...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5000 ^| findstr LISTENING') do taskkill /F /PID %%a 2>nul
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5173 ^| findstr LISTENING') do taskkill /F /PID %%a 2>nul
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000 ^| findstr LISTENING') do taskkill /F /PID %%a 2>nul
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8080 ^| findstr LISTENING') do taskkill /F /PID %%a 2>nul
echo Ports freed.
echo.

echo [3/7] Stopping Chrome/Chromium processes (Puppeteer)...
taskkill /F /IM chrome.exe 2>nul
taskkill /F /IM chromium.exe 2>nul
echo Browser processes stopped.
echo.

echo [4/7] Clearing npm cache...
call npm cache clean --force
echo npm cache cleared.
echo.

echo [5/7] Removing node_modules...
if exist node_modules (
    echo Deleting node_modules directory...
    rmdir /s /q node_modules
    echo node_modules removed.
) else (
    echo node_modules not found.
)
echo.

echo [6/7] Removing build artifacts...
if exist dist (
    rmdir /s /q dist
    echo dist folder removed.
)
if exist client\dist (
    rmdir /s /q client\dist
    echo client\dist folder removed.
)
if exist .vite (
    rmdir /s /q .vite
    echo .vite cache removed.
)
echo Build artifacts removed.
echo.

echo [7/7] Clearing Puppeteer cache...
if exist %LOCALAPPDATA%\Puppeteer (
    rmdir /s /q %LOCALAPPDATA%\Puppeteer
    echo Puppeteer cache cleared.
) else (
    echo Puppeteer cache not found.
)
echo.

echo ============================================
echo Cleanup Complete!
echo ============================================
echo.
echo You may now run "npm install" to reinstall dependencies.
echo.
pause