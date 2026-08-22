import { defineConfig, devices } from "@playwright/test";

const e2eFirebaseEnvironment = {
  VITE_FIREBASE_ENVIRONMENT: "e2e",
  VITE_FIREBASE_API_KEY: "AIzaSyA12345678901234567890123456789012",
  VITE_FIREBASE_AUTH_DOMAIN: "workout-app-e2e.firebaseapp.com",
  VITE_FIREBASE_PROJECT_ID: "workout-app-e2e",
  VITE_FIREBASE_STORAGE_BUCKET: "workout-app-e2e.appspot.com",
  VITE_FIREBASE_MESSAGING_SENDER_ID: "000000000000",
  VITE_FIREBASE_APP_ID: "1:000000000000:web:e2e"
};
const reuseExistingE2eServer = process.env.PW_REUSE_SERVER === "1";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://127.0.0.1:4174",
    trace: "retain-on-failure"
  },
  projects: [
    {
      name: "mobile-chromium",
      use: {
        ...devices["Pixel 5"],
        viewport: { width: 320, height: 720 }
      }
    },
    {
      name: "desktop-chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1366, height: 768 }
      }
    }
  ],
  webServer: {
    command: "node ./node_modules/vite/bin/vite.js --host 127.0.0.1 --port 4174 --strictPort",
    url: "http://127.0.0.1:4174",
    env: {
      ...process.env,
      ...e2eFirebaseEnvironment
    },
    // E2E must own its server so it cannot silently attach to a developer or
    // production-configured Vite process. Set PW_REUSE_SERVER=1 only
    // when deliberately reusing an already isolated e2e server.
    reuseExistingServer: reuseExistingE2eServer,
    timeout: 120_000
  }
});
