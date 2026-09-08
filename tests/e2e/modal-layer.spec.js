import { test, expect } from "@playwright/test";
import { failOnRuntimeErrors } from "./runtime-errors.js";

test.setTimeout(60_000);

async function openNutrition(page) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?clientHarness=1&clientHarnessTheme=warm-light");
  await page.getByTestId("client-nav-nutrition").click();
  await expect(page.getByTestId("nutrition-orbit-add")).toBeVisible();
}

async function swipe(page, x, y, endY) {
  const session = await page.context().newCDPSession(page);
  await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
  for (let step = 1; step <= 8; step += 1) {
    await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: y + (endY - y) * step / 8 }] });
  }
  await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await session.detach();
}

async function assertBackgroundLocked(page, dialog) {
  await expect.poll(() => page.evaluate(() => document.body.style.position)).toBe("fixed");
  await dialog.evaluate(node => {
    window.modalBackgroundSnapshot = [...document.body.querySelectorAll("*")]
      .filter(element => element instanceof HTMLElement && !node.contains(element) && (element.scrollTop > 0 || element.style.overflow === "hidden"))
      .map(element => ({ element, x: element.scrollLeft, y: element.scrollTop }));
  });
  await page.mouse.move(4, 100);
  await page.mouse.wheel(0, 550);
  await swipe(page, 4, 300, 80);
  await expect.poll(() => page.evaluate(() => window.modalBackgroundSnapshot.every(({ element, x, y }) =>
    element.scrollLeft === x && element.scrollTop === y))).toBe(true);
}

test("nutrition sheets share a moderate scrim and block background wheel and touch scrolling", async ({ page }, testInfo) => {
  const assertNoErrors = failOnRuntimeErrors(page);
  await page.setViewportSize({ width: 375, height: 667 });
  await openNutrition(page);
  const cases = [
    { trigger: () => page.getByTestId("nutrition-orbit-calendar"), dialog: "nutrition-calendar-sheet", close: "nutrition-calendar-close" },
    { trigger: () => page.locator('[data-nutrition-summary-part="card"]'), dialog: "nutrition-plan-details", close: "nutrition-plan-close" },
    { trigger: () => page.getByRole("button", { name: "Открыть приём пищи: Завтрак", exact: true }), dialog: "nutrition-meal-modal", close: "nutrition-meal-close" },
    { trigger: () => page.getByTestId("nutrition-diary-toggle"), dialog: "nutrition-diary-modal", close: "nutrition-diary-close" },
    { trigger: () => page.getByTestId("nutrition-orbit-add"), dialog: "food-search-screen", close: null }
  ];
  for (const item of cases) {
    await item.trigger().click();
    const surface = page.getByTestId(item.dialog);
    await expect(surface).toBeVisible();
    const dialog = surface.locator('[role="dialog"]').count().then(count => count ? surface.locator('[role="dialog"]').last() : surface);
    await assertBackgroundLocked(page, await dialog);
    const scrim = page.locator('[data-modal-backdrop="true"]:visible').last();
    expect(await scrim.evaluate(node => ({ color: getComputedStyle(node).backgroundColor, filter: getComputedStyle(node).backdropFilter })))
      .toEqual({ color: "rgba(28, 28, 30, 0.28)", filter: "blur(4px)" });
    await page.screenshot({ path: testInfo.outputPath(`${item.dialog}-375.png`), scale: "css" });
    if (item.close) await page.getByTestId(item.close).click();
    else await page.locator('[data-food-search-header-action="close"]').click();
    await expect(surface).toBeHidden();
    await expect.poll(() => page.evaluate(() => document.body.style.position)).not.toBe("fixed");
    expect(await page.evaluate(() => window.modalBackgroundSnapshot.every(({ element, x, y }) =>
      !element.isConnected || (element.scrollLeft === x && element.scrollTop === y)))).toBe(true);
  }
  assertNoErrors();
});

test("long sheets still scroll by touch and return background scrolling after nested close", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await openNutrition(page);
  // Exercise the shared manager against a separately scrolling shell at a nonzero position.
  await page.evaluate(() => {
    const shell = document.createElement("div");
    shell.id = "scroll-guard-fixture";
    shell.style.cssText = "position:fixed;inset:0;z-index:2147483640;overflow-y:auto;background:white";
    const content = document.createElement("div");
    content.style.height = "1600px";
    shell.append(content);
    document.body.append(shell);
    shell.scrollTop = 170;
    const open = (id, parent) => {
      const overlay = document.createElement("div");
      overlay.id = id;
      overlay.style.cssText = "position:fixed;inset:0;z-index:2147483641;display:grid;place-items:center";
      overlay.dataset.modalBackdrop = "true";
      const dialog = document.createElement("section");
      dialog.setAttribute("role", "dialog");
      dialog.setAttribute("aria-modal", "true");
      dialog.style.cssText = "height:300px;width:280px;overflow-y:auto;background:white";
      const tall = document.createElement("div");
      tall.style.height = "1100px";
      const close = document.createElement("button");
      close.textContent = "Закрыть";
      close.onclick = () => overlay.remove();
      dialog.append(close, tall);
      overlay.append(dialog);
      parent.append(overlay);
    };
    window.openScrollGuardDialog = open;
    open("outer-scroll-dialog", document.body);
  });
  const outer = page.locator('#outer-scroll-dialog [role="dialog"]');
  await assertBackgroundLocked(page, outer);
  await swipe(page, 180, 430, 250);
  await expect.poll(() => outer.evaluate(node => node.scrollTop)).toBeGreaterThan(0);
  await outer.evaluate(node => { node.scrollTop = 130; window.openScrollGuardDialog("inner-scroll-dialog", document.body); });
  const inner = page.locator('#inner-scroll-dialog [role="dialog"]');
  await assertBackgroundLocked(page, inner);
  expect(await page.locator("#outer-scroll-dialog").evaluate(node => getComputedStyle(node).backdropFilter)).toBe("none");
  expect(await page.locator("#inner-scroll-dialog").evaluate(node => getComputedStyle(node).backdropFilter)).toBe("blur(4px)");
  await inner.getByRole("button", { name: "Закрыть" }).click();
  await expect(inner).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => document.body.style.position)).toBe("fixed");
  expect(await outer.evaluate(node => node.scrollTop)).toBe(130);
  expect(await page.locator("#outer-scroll-dialog").evaluate(node => getComputedStyle(node).backdropFilter)).toBe("blur(4px)");
  expect(await page.locator("#scroll-guard-fixture").evaluate(node => node.scrollTop)).toBe(170);
  await outer.getByRole("button", { name: "Закрыть" }).click();
  await expect.poll(() => page.evaluate(() => document.body.style.position)).not.toBe("fixed");
  const shell = page.locator("#scroll-guard-fixture");
  expect(await shell.evaluate(node => node.scrollTop)).toBe(170);
  expect(await shell.evaluate(node => node.style.overflowY)).toBe("auto");
  await page.mouse.move(180, 400);
  await page.mouse.wheel(0, 200);
  await expect.poll(() => shell.evaluate(node => node.scrollTop)).toBeGreaterThan(170);
});

test("workout mode has floating corners, one close action and the shared backdrop", async ({ page }, testInfo) => {
  for (const viewport of [{ width: 375, height: 667 }, { width: 320, height: 568 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(viewport);
    await page.goto("/?clientHarness=1&clientHarnessPage=workoutSheets&sheet=mode&clientHarnessTheme=warm-light");
    const dialog = page.getByTestId("workout-mode-dialog");
    await expect(dialog).toBeVisible();
    const box = await dialog.boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(12);
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width - 12);
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height - 12);
    expect(await dialog.evaluate(node => parseFloat(getComputedStyle(node).borderBottomLeftRadius))).toBeGreaterThanOrEqual(20);
    await expect(dialog.getByRole("button", { name: "Закрыть выбор режима" })).toHaveCount(1);
    expect(await page.getByTestId("workout-mode-dialog-header").evaluate(node => getComputedStyle(node).borderBottomWidth)).toBe("0px");
    await page.screenshot({ path: testInfo.outputPath(`mode-${viewport.width}.png`), scale: "css" });
    await page.getByTestId("workout-mode-dialog-dismiss").click();
    await expect(dialog).toHaveCount(0);
  }
});

test("release navigation keeps client tabs usable after closing a modal", async ({ page }) => {
  const assertNoErrors = failOnRuntimeErrors(page);
  await openNutrition(page);
  await page.getByTestId("client-nav-workouts").click();
  await expect(page.getByTestId("client-harness-workouts")).toBeVisible();
  await page.getByTestId("client-nav-cabinet").click();
  await page.getByTestId("profile-cabinet-action-workout-mode").click();
  await expect(page.getByTestId("workout-mode-dialog")).toBeVisible();
  await page.getByTestId("workout-mode-dialog-dismiss").click();
  await expect(page.getByTestId("workout-mode-dialog")).toBeHidden();
  await page.getByTestId("client-nav-nutrition").click();
  await expect(page.getByTestId("nutrition-orbit-add")).toBeVisible();
  assertNoErrors();
});

test("release navigation keeps trainer client dialogs and tabs usable", async ({ page }) => {
  const assertNoErrors = failOnRuntimeErrors(page);
  await page.goto("/?trainerHarness=1");
  await page.getByTestId("trainer-nav-clients").click();
  await page.locator(".trainerNextClientTable > button").first().click();
  await expect(page.getByRole("heading", { name: "Germes", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Открыть абонемент клиента", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Календарь тренировок", exact: true });
  await expect(dialog).toBeVisible();
  await assertBackgroundLocked(page, dialog);
  const backdrop = page.locator('[data-trainer-modal-backdrop="true"]:visible').last();
  expect(await backdrop.evaluate(node => getComputedStyle(node).backdropFilter)).toBe("blur(4px)");
  await dialog.getByRole("button", { name: "Закрыть: Календарь тренировок", exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect.poll(() => page.evaluate(() => document.body.style.position)).not.toBe("fixed");
  await page.locator(".trainerNextClientMobileNav").getByRole("button", { name: "Тренировки", exact: true }).click();
  await page.locator(".trainerNextClientMobileNav").getByRole("button", { name: "Питание", exact: true }).click();
  const nutritionEditor = page.getByRole("dialog", { name: "Изменить план", exact: true });
  await expect(nutritionEditor).toBeVisible();
  await assertBackgroundLocked(page, nutritionEditor);
  await nutritionEditor.locator(".trainerNextModalClose").click();
  await expect(nutritionEditor).toBeHidden();
  await expect.poll(() => page.evaluate(() => document.body.style.position)).not.toBe("fixed");
  assertNoErrors();
});

test("release navigation keeps admin sections and denied access intact", async ({ page }) => {
  const assertNoErrors = failOnRuntimeErrors(page);
  await page.goto("/?adminHarness=1");
  await expect(page.getByTestId("admin-panel-hub")).toBeVisible();
  const sections = page.getByRole("region", { name: "Разделы админки" });
  await expect(sections.getByRole("button")).toHaveCount(3);
  await sections.getByRole("button", { name: /Пользователи и роли/ }).click();
  await expect(page.getByTestId("admin-harness-action")).toHaveText("page:adminUsers");
  await sections.getByRole("button", { name: /Базовые программы/ }).click();
  await expect(page.getByTestId("admin-harness-action")).toHaveText("programs");
  await page.goto("/?adminHarness=1&adminAccess=denied");
  await expect(page.getByRole("heading", { name: "Доступ закрыт" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Разделы админки" })).toHaveCount(0);
  assertNoErrors();
});
