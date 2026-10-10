import { test, expect } from "./app-test.js";
import { failOnRuntimeErrors } from "./runtime-errors.js";

async function openSearch(page) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?clientHarness=1&clientHarnessTheme=warm-light");
  await page.getByTestId("client-nav-nutrition").click();
  await page.getByTestId("nutrition-orbit-add").click();
  await expect(page.getByTestId("food-search-screen")).toBeVisible();
}

for (const viewport of [{ width: 402, height: 874 }, { width: 320, height: 568 }]) {
  test(`product back retains query, results and meal at ${viewport.width}`, async ({ page }, testInfo) => {
    const errors = failOnRuntimeErrors(page);
    await page.setViewportSize(viewport);
    await openSearch(page);
    await page.locator('[data-food-search-header-action="toggle-meal"]').click();
    await page.locator('[data-food-search-meal="lunch"]').click();
    const input = page.getByTestId("food-search-input").locator("input");
    const cards = page.locator("[data-food-search-result-card]");
    await input.fill("yogurt");
    await input.press("Enter");
    await expect(cards).toHaveCount(2);
    const results = await cards.allTextContents();
    for (let index = 0; index < 2; index += 1) {
      await cards.nth(index).click();
      await expect(page.getByTestId("food-product-page")).toBeVisible();
      await expect(page.locator('[data-food-product-header-action="toggle-meal"]')).toContainText("Обед");
      await page.getByRole("button", { name: "К поиску", exact: true }).click();
      await expect(input).toHaveValue("yogurt");
      await expect(cards).toHaveCount(2);
      expect(await cards.allTextContents()).toEqual(results);
      await expect(page.locator('[data-food-search-header-action="toggle-meal"]')).toContainText("Обед");
    }
    await page.screenshot({ path: testInfo.outputPath(`search-return-${viewport.width}.png`) });
    errors();
  });
}

test("my products remains on the same tab when returning from a product", async ({ page }) => {
  await page.setViewportSize({ width: 402, height: 874 });
  await openSearch(page);
  await page.getByTestId("food-search-my-products-action").click();
  const input = page.locator("#my-foods-search");
  await input.fill("Oat");
  await page.locator("[data-food-search-result-card]").click();
  await page.getByRole("button", { name: "К поиску", exact: true }).click();
  await expect(input).toHaveValue("Oat");
  await expect(page.getByTestId("food-search-header")).toHaveAttribute("data-food-search-header-variant", "my-products");
  await expect(page.locator("[data-food-search-result-card]")).toContainText("Harness Oat Bar");
});

test("back restores list scroll, while a new query starts at the top", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 480 });
  await openSearch(page);
  const input = page.getByTestId("food-search-input").locator("input");
  const scroll = page.getByTestId("food-search-scroll");
  const lastCard = page.locator("[data-food-search-result-card]").last();
  await input.fill("yogurt");
  await input.press("Enter");
  await lastCard.scrollIntoViewIfNeeded();
  const previousScroll = await scroll.evaluate((node) => node.scrollTop);
  expect(previousScroll).toBeGreaterThan(0);
  await lastCard.click();
  await page.getByRole("button", { name: "К поиску", exact: true }).click();
  await expect.poll(() => scroll.evaluate((node) => node.scrollTop)).toBe(previousScroll);
  await input.fill("salmon");
  await expect.poll(() => scroll.evaluate((node) => node.scrollTop)).toBe(0);
});
