import { test as base } from "@playwright/test";

export * from "@playwright/test";

export async function isolateTelegramSdk(page) {
  await page.route("https://telegram.org/js/telegram-web-app.js*", route => route.fulfill({
    contentType: "application/javascript", body: ""
  }));
}

// General UI fixtures do not authenticate through Telegram. Keep that external
// transport deterministic; telegram-sdk-startup.spec.js uses the original test
// and independently exercises delayed and failed SDK loading.
export const test = base.extend({
  telegramSdkTransport: [async ({ page }, use) => {
    await isolateTelegramSdk(page);
    await use();
  }, { auto: true }]
});
