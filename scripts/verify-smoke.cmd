@echo off
setlocal

call scripts\verify.cmd || exit /b %ERRORLEVEL%

echo.
echo === Client and trainer smoke e2e ===
call npm.cmd run test:e2e -- tests/e2e/client-smoke.spec.js tests/e2e/trainer-workspace.spec.js || exit /b %ERRORLEVEL%

echo.
echo All smoke verification checks passed.
