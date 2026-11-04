import { test as base } from "@playwright/test";

export * from "@playwright/test";

export async function isolateTelegramSdk(page) {
  await page.route("https://telegram.org/js/telegram-web-app.js*", route => route.fulfill({
    contentType: "application/javascript", body: ""
  }));
}

// These isolated UI tests use a fake Firebase project and never authenticate
// with Google. Fail its optional redirect resolver immediately, rather than
// letting a blocked external transport hold authStateReady indefinitely.
export async function isolateGoogleAuthTransport(page) {
  await page.route("https://apis.google.com/js/api.js*", route => route.abort("failed"));
  await page.route("https://workout-app-e2e.firebaseapp.com/__/auth/**", route => route.abort("failed"));
}

// General UI fixtures do not authenticate through Telegram. Keep that external
// transport deterministic; telegram-sdk-startup.spec.js uses the original test
// and independently exercises delayed and failed SDK loading.
export const test = base.extend({
  telegramSdkTransport: [async ({ page }, use) => {
    await isolateTelegramSdk(page);
    await isolateGoogleAuthTransport(page);
    await use();
  }, { auto: true }]
});
