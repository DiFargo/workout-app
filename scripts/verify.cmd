@echo off
setlocal

call node scripts\verify.mjs --e2e
exit /b %ERRORLEVEL%
