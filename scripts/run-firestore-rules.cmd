@echo off
setlocal
set "WORKOUT_APP_WORKSPACE=%~dp0.."
npx.cmd --yes --cache "%WORKOUT_APP_WORKSPACE%\.npm-cache" firebase-tools@15.20.0 emulators:exec --only firestore "node tests/firestore-rules.rules.mjs"
exit /b %ERRORLEVEL%
