@echo off
cd /d C:\Users\User\scholorhaab

echo Starting ScholarHAAB locally...
echo.
echo [1/2] Starting Tutor API on http://127.0.0.1:8000
start "ScholarHAAB Tutor API" cmd /k "cd /d C:\Users\User\scholorhaab && python -m uvicorn api_server:app --host 127.0.0.1 --port 8000"

timeout /t 5 /nobreak >nul

echo [2/2] Starting Web App on http://127.0.0.1:3000
start "ScholarHAAB Web App" cmd /k "cd /d C:\Users\User\scholorhaab && npm run dev -- --hostname 127.0.0.1 --port 3000"

timeout /t 8 /nobreak >nul

echo.
echo ScholarHAAB should now be available at:
echo   Web App   : http://127.0.0.1:3000
echo   Tutor API : http://127.0.0.1:8000/health
echo.
echo If the browser does not open, copy this URL:
echo   http://127.0.0.1:3000
start "" "http://127.0.0.1:3000"
