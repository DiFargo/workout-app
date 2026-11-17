import { defineConfig, devices } from "@playwright/test";
import process from "node:process";

const port = Number(process.env.ADMIN_PREVIEW_PORT || 4175);

export default defineConfig({
  testDir: "./tests/local-preview",
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  outputDir: "test-results/admin-preview",
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: "retain-on-failure"
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1366, height: 768 } } },
    { name: "mobile", use: { ...devices["Desktop Chrome"], viewport: { width: 402, height: 874 }, isMobile: true, hasTouch: true } }
  ],
  webServer: {
    command: `node ./node_modules/vite/bin/vite.js --config vite.admin-preview.config.js --host 127.0.0.1 --port ${port} --strictPort`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
    timeout: 60_000
  }
});
