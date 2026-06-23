@echo off
setlocal

echo.
echo === Build ===
call npm.cmd run build || exit /b %ERRORLEVEL%

echo.
echo === Bundle budget ===
call npm.cmd run check:bundle || exit /b %ERRORLEVEL%

echo.
echo === Unit tests ===
call npm.cmd test || exit /b %ERRORLEVEL%

echo.
echo === Critical lint ===
call npm.cmd run lint:critical || exit /b %ERRORLEVEL%

echo.
echo All verification checks passed.
