@echo off
setlocal
set "WORKOUT_APP_WORKSPACE=%~dp0.."
npx.cmd --yes --cache "%WORKOUT_APP_WORKSPACE%\.npm-cache" firebase-tools@15.20.0 --project demo-workout-rules emulators:exec --only firestore,storage "node --test tests/firestore-rules.rules.mjs tests/exercise-cards.rules.mjs tests/admin-storage-access.rules.mjs tests/basic-workout-access.rules.mjs"
exit /b %ERRORLEVEL%
