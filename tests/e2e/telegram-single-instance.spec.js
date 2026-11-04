import { expect, test } from "@playwright/test";
import { failOnRuntimeErrors } from "./runtime-errors.js";

test.setTimeout(60_000);

const sdkUrl = "https://telegram.org/js/telegram-web-app.js*";
const primaryUserId = 846000001;

function fixtureData(userId) {
  return userId ? new URLSearchParams({
    query_id: `single-instance-fixture-${userId}`,
    user: JSON.stringify({ id: userId, first_name: "Fixture" }),
    auth_date: "1792278000",
    hash: "fixture-not-an-authentication-signature"
  }).toString() : "";
}

async function configurePage(page, userId, testInfo) {
  if (testInfo.project.name.startsWith("mobile")) await page.setViewportSize({ width: 402, height: 874 });
  const initData = fixtureData(userId);
  const sdk = `(() => {
    window.__singleInstanceSdkCalls ||= { close: 0, ready: 0, expand: 0 };
    if (window.Telegram?.WebApp) return;
    window.Telegram = { WebApp: {
      initData: ${JSON.stringify(initData)},
      initDataUnsafe: ${JSON.stringify(userId ? { user: { id: userId, first_name: "Fixture" } } : {})},
      version: "8.0", platform: "ios", colorScheme: "light",
      viewportHeight: window.innerHeight, viewportStableHeight: window.innerHeight,
      safeAreaInset: { top: 0, right: 0, bottom: 0, left: 0 },
      contentSafeAreaInset: { top: 0, right: 0, bottom: 0, left: 0 },
      onEvent() {}, offEvent() {}, setHeaderColor() {}, setBackgroundColor() {}, setBottomBarColor() {},
      ready() { window.__singleInstanceSdkCalls.ready += 1; },
      expand() { window.__singleInstanceSdkCalls.expand += 1; },
      close() { window.__singleInstanceSdkCalls.close += 1; }
    } };
  })();`;
  // Install deterministically before the module entry point; the real async SDK
  // script is also fulfilled, without resetting counters when it arrives later.
  await page.addInitScript({ content: sdk });
  await page.route(sdkUrl, (route) => route.fulfill({ contentType: "application/javascript", body: sdk }));
  const runtimeRequests = [];
  const serviceRequests = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (["/src/App.jsx", "/src/AppCore.jsx", "/src/app/AppBootstrap.jsx"].includes(url.pathname)) runtimeRequests.push(url.pathname);
    if (url.pathname.startsWith("/api/") || /(?:googleapis\.com|recaptcha\.net|firebaseappcheck\.googleapis\.com)$/.test(url.hostname)) serviceRequests.push(url.hostname + url.pathname);
  });
  return {
    url: initData ? `/#tgWebAppData=${encodeURIComponent(initData)}&tgWebAppVersion=8.0&tgWebAppPlatform=ios` : "/",
    runtimeRequests,
    serviceRequests,
    assertNoRuntimeErrors: failOnRuntimeErrors(page)
  };
}

async function isolateExternalServices(context) {
  await context.route("**/*", (route) => {
    const url = new URL(route.request().url());
    return ["localhost", "127.0.0.1"].includes(url.hostname) ? route.continue() : route.abort();
  });
}

async function expectLogin(page) {
  await expect(page.getByRole("heading", { name: "Войти в Zmena", exact: true })).toBeVisible({ timeout: 40_000 });
  await expect(page.getByRole("heading", { name: "Приложение уже открыто", exact: true })).toHaveCount(0);
}

async function checkGeometry(page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  for (const name of ["Закрыть это окно", "Проверить снова"]) {
    await expect(page.getByRole("button", { name, exact: true })).toBeInViewport({ ratio: 1 });
  }
}

test("same Telegram user gets a safe duplicate window, then can take ownership after the first page closes", async ({ context, page }, testInfo) => {
  await isolateExternalServices(context);
  // Web Locks are available only in supported secure contexts, so probe on
  // localhost without mounting the application before deciding this one skip.
  await page.goto("/manifest.json");
  const supportsLocks = await page.evaluate(() => typeof navigator.locks?.request === "function");
  test.skip(!supportsLocks, "This browser does not provide Web Locks; cross-window ownership is unsupported here");
  const owner = await configurePage(page, primaryUserId, testInfo);
  await page.goto(owner.url, { waitUntil: "domcontentloaded" });
  await expectLogin(page);
  await page.getByRole("group", { name: "Способ входа" }).getByRole("button", { name: "Email или логин", exact: true }).click();
  await page.getByLabel("Email или логин", { exact: true }).fill("fixture-unsent-draft");

  const duplicate = await context.newPage();
  const second = await configurePage(duplicate, primaryUserId, testInfo);
  try {
    await duplicate.goto(second.url, { waitUntil: "domcontentloaded" });
    await expect(duplicate.getByRole("heading", { name: "Приложение уже открыто", exact: true })).toBeVisible();
    await expect.poll(() => duplicate.evaluate(() => window.__singleInstanceSdkCalls.close)).toBeGreaterThanOrEqual(1);
    await expect(duplicate.locator("input")).toHaveCount(0);
    expect(second.runtimeRequests, "duplicate must stop before importing the auth/app runtime").toEqual([]);
    expect(second.serviceRequests, "duplicate must not start authentication or App Check network activity").toEqual([]);
    await checkGeometry(duplicate);
    await duplicate.screenshot({ path: testInfo.outputPath("duplicate-primary-viewport.png"), scale: "css" });
    await duplicate.setViewportSize({ width: 320, height: 720 });
    await checkGeometry(duplicate);
    await duplicate.screenshot({ path: testInfo.outputPath("duplicate-320.png"), scale: "css" });

    const closeCalls = await duplicate.evaluate(() => window.__singleInstanceSdkCalls.close);
    await duplicate.getByRole("button", { name: "Закрыть это окно", exact: true }).click();
    await expect.poll(() => duplicate.evaluate(() => window.__singleInstanceSdkCalls.close)).toBeGreaterThan(closeCalls);
    await expect(page.getByRole("heading", { name: "Войти в Zmena", exact: true })).toBeVisible();
    await expect(page.getByLabel("Email или логин", { exact: true })).toHaveValue("fixture-unsent-draft");
    expect(await page.evaluate(() => window.__singleInstanceSdkCalls.close)).toBe(0);
    owner.assertNoRuntimeErrors();

    await page.close();
    await duplicate.getByRole("button", { name: "Проверить снова", exact: true }).click();
    await expectLogin(duplicate);
    expect(await duplicate.evaluate(() => window.__singleInstanceSdkCalls.close)).toBe(0);
    second.assertNoRuntimeErrors();
  } finally {
    await duplicate.close();
  }
});

test("different Telegram users in the same browser context do not block each other", async ({ context, page }, testInfo) => {
  await isolateExternalServices(context);
  const first = await configurePage(page, primaryUserId, testInfo);
  await page.goto(first.url, { waitUntil: "domcontentloaded" });
  await expectLogin(page);
  const otherPage = await context.newPage();
  const other = await configurePage(otherPage, primaryUserId + 1, testInfo);
  try {
    await otherPage.goto(other.url, { waitUntil: "domcontentloaded" });
    await expectLogin(otherPage);
    await expectLogin(page);
    expect(await otherPage.evaluate(() => window.__singleInstanceSdkCalls.close)).toBe(0);
    expect(await page.evaluate(() => window.__singleInstanceSdkCalls.close)).toBe(0);
    first.assertNoRuntimeErrors();
    other.assertNoRuntimeErrors();
  } finally {
    await otherPage.close();
  }
});

test("ordinary browser tabs remain independently usable without Telegram identity", async ({ context, page }, testInfo) => {
  await isolateExternalServices(context);
  const first = await configurePage(page, null, testInfo);
  await page.goto(first.url, { waitUntil: "domcontentloaded" });
  await expectLogin(page);
  const browserPage = await context.newPage();
  const second = await configurePage(browserPage, null, testInfo);
  try {
    await browserPage.goto(second.url, { waitUntil: "domcontentloaded" });
    await expectLogin(browserPage);
    await expectLogin(page);
    expect(await browserPage.evaluate(() => window.__singleInstanceSdkCalls.close)).toBe(0);
    first.assertNoRuntimeErrors();
    second.assertNoRuntimeErrors();
  } finally {
    await browserPage.close();
  }
});

test("an invitation in a duplicate window preserves its token and continues here after the owner closes", async ({ context, page }, testInfo) => {
  await isolateExternalServices(context);
  await page.goto("/manifest.json");
  const supportsLocks = await page.evaluate(() => typeof navigator.locks?.request === "function");
  test.skip(!supportsLocks, "This browser does not provide Web Locks; cross-window ownership is unsupported here");
  const owner = await configurePage(page, primaryUserId, testInfo);
  await page.goto(owner.url, { waitUntil: "domcontentloaded" });
  await expectLogin(page);

  const invitationPage = await context.newPage();
  const invitation = await configurePage(invitationPage, primaryUserId, testInfo);
  const token = "fixture_invite_846_123456789";
  const inviteUrl = invitation.url.replace("/#", `/?telegramInvite=${token}#`);
  try {
    await invitationPage.goto(inviteUrl, { waitUntil: "domcontentloaded" });
    await expect(invitationPage.getByRole("heading", { name: "Приложение уже открыто", exact: true })).toBeVisible();
    await expect(invitationPage.getByRole("button", { name: "Продолжить здесь", exact: true })).toBeInViewport({ ratio: 1 });
    await expect(invitationPage.getByText("Открытая тренировка в первом окне не изменяется.", { exact: true })).toBeVisible();
    expect(new URL(invitationPage.url()).searchParams.get("telegramInvite")).toBe(token);
    expect(await invitationPage.evaluate(() => window.__singleInstanceSdkCalls.close)).toBe(0);
    expect(invitation.runtimeRequests, "invite duplicate must not mount the application before ownership is available").toEqual([]);
    expect(invitation.serviceRequests).toEqual([]);
    await expectLogin(page);
    expect(await page.evaluate(() => window.__singleInstanceSdkCalls.close)).toBe(0);
    expect(await invitationPage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await invitationPage.screenshot({ path: testInfo.outputPath("duplicate-invitation-preserved.png"), scale: "css" });

    await page.close();
    await invitationPage.getByRole("button", { name: "Продолжить здесь", exact: true }).click();
    await expect(invitationPage.getByRole("heading", { name: "Приглашение от тренера", exact: true })).toBeVisible({ timeout: 40_000 });
    await expect(invitationPage.getByRole("button", { name: "Принять приглашение", exact: true })).toBeVisible();
    await expect(invitationPage.getByRole("heading", { name: "Приложение уже открыто", exact: true })).toHaveCount(0);
    expect(new URL(invitationPage.url()).searchParams.get("telegramInvite")).toBe(token);
    expect(await invitationPage.evaluate(() => window.__singleInstanceSdkCalls.close)).toBe(0);
    owner.assertNoRuntimeErrors();
    invitation.assertNoRuntimeErrors();
  } finally {
    await invitationPage.close();
  }
});
