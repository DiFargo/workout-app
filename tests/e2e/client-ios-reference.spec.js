import { expect, test } from "@playwright/test";
import { failOnRuntimeErrors } from "./runtime-errors.js";

test.setTimeout(60_000);

async function expectRect(locator, expected) {
  await expect(locator).toBeVisible();
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  expect({
    x: Math.round(box.x),
    y: Math.round(box.y),
    width: Math.round(box.width),
    height: Math.round(box.height)
  }).toEqual(expected);
}

async function expectStickyHeaderWhileScrolling(header) {
  const metrics = await header.evaluate(async (node) => {
    const shell = node.closest('[data-css-module-scope="profile-dashboard-shell"]');
    if (!shell) return null;

    const initialY = node.getBoundingClientRect().y;
    shell.scrollTo({ top: 80 });
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    const result = {
      initialY,
      scrolledY: node.getBoundingClientRect().y,
      scrollTop: shell.scrollTop,
      scrollHeight: shell.scrollHeight,
      clientHeight: shell.clientHeight
    };
    shell.scrollTo({ top: 0 });
    return result;
  });

  expect(metrics).not.toBeNull();
  if (metrics.scrollHeight > metrics.clientHeight) {
    expect(metrics.scrollTop).toBeGreaterThan(0);
    expect(Math.round(metrics.scrolledY)).toBe(Math.round(metrics.initialY));
  }
}

async function expectCabinetLogoutReachable(page) {
  const metrics = await page.evaluate(async () => {
    const shell = document.querySelector('[data-css-module-scope="profile-dashboard-shell"]');
    const logout = document.querySelector('[data-testid="profile-cabinet-logout"]');
    const bottomNav = document.querySelector('[data-testid="client-bottom-nav"]');
    if (!shell || !logout || !bottomNav) return null;

    shell.scrollTo({ top: shell.scrollHeight });
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    const logoutRect = logout.getBoundingClientRect();
    const navRect = bottomNav.getBoundingClientRect();
    const result = {
      clientHeight: shell.clientHeight,
      logoutBottom: logoutRect.bottom,
      navTop: navRect.top,
      scrollHeight: shell.scrollHeight,
      scrollTop: shell.scrollTop
    };
    shell.scrollTo({ top: 0 });
    return result;
  });

  expect(metrics).not.toBeNull();
  expect(metrics.scrollHeight).toBeGreaterThan(metrics.clientHeight);
  expect(metrics.scrollTop).toBeGreaterThan(0);
  expect(metrics.logoutBottom).toBeLessThanOrEqual(metrics.navTop - 8);
}

async function expectAlignedLeft(...locators) {
  const leftEdges = await Promise.all(locators.map(async (locator) => {
    const box = await locator.boundingBox();
    expect(box).not.toBeNull();
    return Math.round(box.x);
  }));

  expect(new Set(leftEdges).size).toBe(1);
}

async function expectHorizontalGap(left, right, minimumGap = 0) {
  const [leftBox, rightBox] = await Promise.all([left.boundingBox(), right.boundingBox()]);
  expect(leftBox).not.toBeNull();
  expect(rightBox).not.toBeNull();
  expect(rightBox.x - (leftBox.x + leftBox.width)).toBeGreaterThanOrEqual(minimumGap);
}

async function expectVerticallyCentered(item, container) {
  const [itemBox, containerBox] = await Promise.all([item.boundingBox(), container.boundingBox()]);
  expect(itemBox).not.toBeNull();
  expect(containerBox).not.toBeNull();
  const itemCenter = itemBox.y + itemBox.height / 2;
  const containerCenter = containerBox.y + containerBox.height / 2;
  expect(Math.abs(itemCenter - containerCenter)).toBeLessThanOrEqual(1);
}

test("calm iOS client screens match the 402 by 874 reference geometry", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium", "The reference uses one deterministic mobile browser.");
  const assertNoRuntimeErrors = failOnRuntimeErrors(page);

  await page.setViewportSize({ width: 402, height: 874 });
  await page.goto("/?clientHarness=1&clientHarnessTheme=warm-light");

  const mainHeader = page.getByTestId("profile-main-header");
  await expect(mainHeader).toHaveCSS("position", "fixed");
  await expect(mainHeader).toHaveCSS("background-color", "rgb(247, 246, 248)");
  await expect(mainHeader).toHaveCSS("backdrop-filter", "none");
  expect(await mainHeader.evaluate((node) => getComputedStyle(node, "::after").content)).toBe("none");
  await expect(page.locator("html")).toHaveCSS("overscroll-behavior-y", "none");
  await expect(page.locator("body")).toHaveCSS("overscroll-behavior-y", "none");
  await expectRect(page.getByTestId("profile-main-title"), { x: 20, y: 16, width: 79, height: 28 });
  await expect(page.getByTestId("profile-main-title")).toHaveCSS("font-size", "20px");
  await expectRect(page.getByTestId("profile-main-notifications"), { x: 338, y: 8, width: 44, height: 44 });
  await expectRect(page.getByTestId("profile-main-hero"), { x: 16, y: 72, width: 370, height: 142 });
  await expectRect(page.getByTestId("profile-main-next-workout"), { x: 16, y: 228, width: 370, height: 142 });
  await expectRect(page.getByTestId("profile-progress-card"), { x: 16, y: 384, width: 370, height: 142 });
  await expectRect(page.getByTestId("profile-measurement-snapshot"), { x: 16, y: 540, width: 370, height: 148 });
  await expect(page.getByTestId("profile-main-last-workout")).toHaveCount(0);
  await expectRect(page.getByTestId("client-bottom-nav"), { x: 10, y: 784, width: 382, height: 76 });
  await expectAlignedLeft(
    page.getByTestId("profile-main-hero-greeting"),
    page.getByTestId("profile-main-hero-title")
  );
  await expect(page.getByTestId("profile-main-hero-greeting")).not.toContainText(",");
  await expect(page.getByTestId("profile-main-hero-goal")).toHaveCount(0);
  await expectAlignedLeft(
    page.getByTestId("profile-main-next-eyebrow"),
    page.getByTestId("profile-main-next-title"),
    page.getByTestId("profile-main-next-meta")
  );
  await expectHorizontalGap(
    page.getByTestId("profile-main-next-meta-text"),
    page.getByTestId("profile-main-next-open"),
    14
  );
  await expect(page.getByTestId("profile-main-next-open")).toHaveCSS("width", "120px");
  await expect(page.getByTestId("profile-main-next-open")).toHaveCSS("height", "54px");
  await expect(page.getByTestId("profile-main-next-open")).toHaveCSS("white-space", "normal");
  await expect(page.getByTestId("profile-main-next-workout").locator("h2")).toHaveCSS("font-size", "21px");
  await expectVerticallyCentered(
    page.getByTestId("profile-main-next-workout").locator("h2"),
    page.getByTestId("profile-main-next-workout")
  );
  await expectVerticallyCentered(
    page.getByTestId("profile-main-next-open"),
    page.getByTestId("profile-main-next-workout")
  );
  await expect(page.getByTestId("profile-progress-more")).toHaveCount(0);
  await expectStickyHeaderWhileScrolling(mainHeader);

  await page.getByTestId("client-nav-cabinet").click();
  await expect(page.getByTestId("profile-cabinet-title")).toHaveText("Кабинет");
  await expect(page.getByTestId("profile-cabinet-title")).toHaveCSS("font-size", "20px");
  await expectRect(page.getByTestId("profile-cabinet-title-row"), { x: 20, y: 8, width: 362, height: 44 });
  await expectRect(page.getByTestId("profile-cabinet-action-account"), { x: 16, y: 96, width: 370, height: 70 });
  await expectRect(page.getByTestId("profile-cabinet-action-body-control"), { x: 17, y: 217, width: 368, height: 70 });
  await expectRect(page.getByTestId("profile-cabinet-action-workout-journal"), { x: 17, y: 357, width: 368, height: 70 });
  await expectRect(page.getByTestId("profile-cabinet-action-questionnaire"), { x: 17, y: 427, width: 368, height: 70 });
  await expectRect(page.getByTestId("profile-cabinet-action-feedback"), { x: 17, y: 619, width: 368, height: 70 });
  await expectRect(page.getByTestId("client-bottom-nav"), { x: 10, y: 784, width: 382, height: 76 });
  await expectStickyHeaderWhileScrolling(page.locator('[data-css-module-scope="profile-cabinet-title-row"]'));
  await expectCabinetLogoutReachable(page);

  await page.getByTestId("client-nav-nutrition").click();
  await expect(page.locator('[data-nutrition-header-part="title"]')).toHaveText("Питание");
  await expect(page.locator('[data-nutrition-header-part="title"]')).toHaveCSS("font-size", "20px");
  await expectRect(page.locator('[data-nutrition-header-part="title-row"]'), { x: 20, y: 8, width: 362, height: 44 });
  await expectRect(page.getByTestId("nutrition-header-search"), { x: 286, y: 8, width: 44, height: 44 });
  await expectRect(page.getByTestId("nutrition-header-calendar"), { x: 338, y: 8, width: 44, height: 44 });
  await expectRect(page.locator('[data-nutrition-header-part="week"]'), { x: 16, y: 64, width: 370, height: 64 });
  await expectRect(page.getByTestId("nutrition-orbit"), { x: 16, y: 140, width: 370, height: 270 });
  await expectRect(page.locator('[data-css-module-scope="nutrition-diary"]'), { x: 16, y: 422, width: 370, height: 35 });
  await expectRect(page.getByTestId("nutrition-diary-list"), { x: 16, y: 457, width: 370, height: 150 });
  await expectRect(page.getByTestId("nutrition-summary"), { x: 16, y: 623, width: 370, height: 72 });
  await expectRect(page.getByTestId("client-bottom-nav"), { x: 10, y: 784, width: 382, height: 76 });

  await page.getByTestId("client-nav-workouts").click();
  await expect(page.getByTestId("workout-list-title")).toHaveCSS("font-size", "20px");

  await page.goto("/cssV2?clientHarness=1&clientHarnessPage=workoutRunStage&clientWorkoutRunStage=exercise&clientHarnessTheme=warm-light");
  await expectRect(page.getByRole("button", { name: "Вернуться к предыдущему экрану" }), { x: 16, y: 8, width: 44, height: 44 });
  await expectRect(page.getByRole("button", { name: "Выйти из тренировки" }), { x: 342, y: 8, width: 44, height: 44 });
  await expectRect(page.locator('[data-css-module-scope="workout-stage-heading"]'), { x: 0, y: 8, width: 402, height: 44 });
  await expectRect(page.getByTestId("workout-exercise-progress"), { x: 160, y: 60, width: 82, height: 25 });
  await expectRect(page.getByTestId("workout-exercise-video-frame"), { x: 16, y: 93, width: 370, height: 280 });
  await expectRect(page.getByTestId("workout-exercise-video-frame").locator("video"), { x: 28, y: 106, width: 346, height: 250 });
  await expectRect(page.getByTestId("workout-plan-section"), { x: 16, y: 386, width: 370, height: 295 });
  await expectRect(page.getByTestId("workout-plan-card"), { x: 16, y: 423, width: 370, height: 258 });
  await expectRect(page.getByTestId("workout-rest-timer"), { x: 16, y: 694, width: 370, height: 54 });
  await expectRect(page.locator('[data-css-module-scope="workout-stage-action-panel"]'), { x: 0, y: 797, width: 402, height: 77 });

  assertNoRuntimeErrors();
});

test("cabinet scroll keeps logout reachable above the iOS dock", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium", "The cabinet interaction is mobile-specific.");

  await page.setViewportSize({ width: 402, height: 874 });
  await page.goto("/?clientHarness=1&clientHarnessTheme=warm-light");
  await page.getByTestId("client-nav-cabinet").click();

  await expect(page.getByTestId("profile-cabinet-logout")).toBeVisible();
  await expectCabinetLogoutReachable(page);
});
