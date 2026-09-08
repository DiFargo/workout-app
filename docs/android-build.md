# Android build

The Android shell is generated with Capacitor and uses the production Vite
build from `dist`.

## One-time setup

Install Android Studio with:

- Android SDK Platform 36
- Android SDK Build-Tools
- Android SDK Command-line Tools

The project uses JDK 21. Android Studio can use its bundled JDK, or `JAVA_HOME`
can point to another JDK 21 installation.

## Sync and run

From the repository root:

```powershell
npm install
npm run android:build
npm run android:open
```

`android:build` runs the production build for Firebase project
`tren-85720`, then copies the result into the native Android project.

## APK / Play Store bundle

In Android Studio choose **Build > Generate Signed Bundle / APK**. Use an APK
for direct installation and an AAB for Google Play. A debug APK, when built,
is written to:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

The Android application id is `com.workoutapp.app`. Change it in
`capacitor.config.ts` before publishing if a different id is required.
