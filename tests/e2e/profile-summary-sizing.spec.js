import { expect, test } from "./app-test.js";
import { failOnRuntimeErrors } from "./runtime-errors.js";

test.setTimeout(60_000);

test.beforeEach(() => {
  test.skip(test.info().project.name !== "mobile-chromium", "Own viewport matrix");
});

for (const viewport of [
  { width: 402, height: 874 },
  { width: 320, height: 720 },
  { width: 874, height: 402 }
]) {
  test(`summary status stays readable and day cards stay aligned at ${viewport.width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: "reduce" });
    const assertNoErrors = failOnRuntimeErrors(page);
    let baseline;
    for (const state of ["today", "recovery", "today-long", "recovery-long"]) {
      await page.goto(`/?clientHarness=1&clientHarnessTheme=warm-light&clientDashboardWorkoutState=${state}`);
      const title = page.getByTestId("profile-summary-hero-title");
      await expect(title).toBeVisible({ timeout: 20_000 });
      const hero = title.locator("..");
      const badge = hero.locator("div").first().locator("span").first();
      await expect(badge).toHaveText(state.startsWith("recovery") ? "День отдыха" : "Сегодня по плану");
      const badgeBox = await badge.boundingBox();
      expect(badgeBox.height).toBeGreaterThanOrEqual(28);
      expect(Number.parseFloat(await badge.evaluate((el) => getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(13);
      const box = await hero.boundingBox();
      const button = page.getByTestId("profile-summary-primary");
      const buttonBox = await button.boundingBox();
      const geometry = { height: box.height, buttonY: buttonBox.y - box.y };
      if (!baseline) baseline = geometry;
      expect(Math.abs(geometry.height - baseline.height)).toBeLessThanOrEqual(1);
      expect(Math.abs(geometry.buttonY - baseline.buttonY)).toBeLessThanOrEqual(1);
      expect(buttonBox.height).toBeGreaterThanOrEqual(48);
      expect(buttonBox.y + buttonBox.height).toBeLessThanOrEqual(box.y + box.height - 15);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
      if (viewport.width === 402) await page.screenshot({ path: testInfo.outputPath(`${state}.png`), fullPage: true });
      await button.click();
      await expect(page.getByTestId("workout-today-card")).toBeVisible();
    }
    assertNoErrors();
  });
}

test("summary grows for enlarged text without clipping its action", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto("/?clientHarness=1&clientHarnessTheme=warm-light&clientDashboardWorkoutState=recovery-long");
  const hero = page.getByTestId("profile-summary-hero-title").locator("..");
  await expect(hero).toBeVisible();
  const original = await hero.boundingBox();
  await hero.evaluate((el) => {
    for (const target of el.querySelectorAll("h2, p, button, div:first-child > span:first-child")) {
      const style = getComputedStyle(target);
      target.style.fontSize = `${Number.parseFloat(style.fontSize) * 2}px`;
      target.style.lineHeight = "1.4";
    }
  });
  const enlarged = await hero.boundingBox();
  const description = await hero.locator(":scope > p").boundingBox();
  const button = page.getByTestId("profile-summary-primary");
  const action = await button.boundingBox();
  expect(enlarged.height).toBeGreaterThan(original.height);
  expect(action.y).toBeGreaterThanOrEqual(description.y + description.height);
  expect(action.y + action.height).toBeLessThanOrEqual(enlarged.y + enlarged.height - 15);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  await button.click();
  await expect(page.getByTestId("workout-today-card")).toBeVisible();
});

test("Telegram dashboard uses a more compact card while keeping the primary action touchable", async ({ page }) => {
  await page.setViewportSize({ width: 402, height: 874 });
  await page.goto("/?clientHarness=1&clientHarnessTheme=warm-light&clientDashboardWorkoutState=recovery");
  await expect(page.locator('[data-testid^="client-harness-"]').first()).toBeAttached({ timeout: 40_000 });
  const hero = page.getByTestId("profile-summary-hero-title").locator("..");
  const action = page.getByTestId("profile-summary-primary");
  await expect(hero).toBeVisible();
  const browserHeight = (await hero.boundingBox()).height;

  await page.locator("html").evaluate((html) => html.setAttribute("data-platform", "telegram"));
  await expect.poll(() => hero.boundingBox().then((box) => box.height)).toBeLessThan(browserHeight);
  await expect(action).toHaveCSS("min-height", "46px");
  await expect(hero).toHaveCSS("padding", "14px");
});
