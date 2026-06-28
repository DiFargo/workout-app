import { expect, test } from "@playwright/test";
import { failOnRuntimeErrors } from "./runtime-errors.js";

test.setTimeout(60_000);

async function expectNoHorizontalOverflow(page) {
  const metrics = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth
  }));

  expect(metrics.documentWidth).toBeLessThanOrEqual(metrics.viewportWidth + 1);
}

async function attachScreenshot(page, testInfo, name) {
  await testInfo.attach(name, {
    body: await page.screenshot({ fullPage: true }),
    contentType: "image/png"
  });
}

async function expectTapTargets(page, selectors, minSize = 44) {
  const failures = await page.evaluate(({ targetSelectors, minimumSize }) => {
    const isVisible = (node) => {
      const style = window.getComputedStyle(node);
      const rect = node.getBoundingClientRect();

      return (
        style.visibility !== "hidden" &&
        style.display !== "none" &&
        rect.width > 0 &&
        rect.height > 0
      );
    };

    return targetSelectors.flatMap((selector) => (
      [...document.querySelectorAll(selector)]
        .filter(isVisible)
        .map((node, index) => {
          const rect = node.getBoundingClientRect();
          return {
            selector,
            index,
            width: Math.round(rect.width),
            height: Math.round(rect.height)
          };
        })
        .filter((item) => item.width < minimumSize || item.height < minimumSize)
    ));
  }, { targetSelectors: selectors, minimumSize: minSize });

  expect(failures).toEqual([]);
}

async function openClientNutritionHarness(page) {
  await page.goto("/?clientHarness=1");
  await expect(page.getByTestId("client-nav-nutrition")).toBeVisible({ timeout: 40_000 });
  await page.getByTestId("client-nav-nutrition").click();
}

async function expectAboveBottomBar(page, floatingSelector) {
  const metrics = await page.evaluate((selector) => {
    const rectOf = (node) => {
      const rect = node?.getBoundingClientRect();
      return rect
        ? {
            y: Math.round(rect.y),
            bottom: Math.round(rect.bottom)
          }
        : null;
    };

    return {
      floating: rectOf(document.querySelector(selector)),
      bottomBar: rectOf(document.querySelector(".fatSearchBottomBar, .clientBottomNav"))
    };
  }, floatingSelector);

  expect(metrics.floating).not.toBeNull();
  expect(metrics.bottomBar).not.toBeNull();
  expect(metrics.floating.bottom).toBeLessThanOrEqual(metrics.bottomBar.y + 1);
}

async function expectNutritionWeekStripReadable(page) {
  const metrics = await page.evaluate(() => {
    const week = document.querySelector(".nutritionWeekV4")?.getBoundingClientRect();
    const days = [...document.querySelectorAll(".nutritionDayV4")].map((day) => {
      const dayRect = day.getBoundingClientRect();
      const labelRect = day.querySelector("small")?.getBoundingClientRect();
      const markerRect = day.querySelector("span")?.getBoundingClientRect();

      return {
        dayLeft: Math.round(dayRect.left),
        dayRight: Math.round(dayRect.right),
        dayTop: Math.round(dayRect.top),
        dayBottom: Math.round(dayRect.bottom),
        dayWidth: Math.round(dayRect.width),
        labelCenterX: Math.round((labelRect?.left || 0) + (labelRect?.width || 0) / 2),
        labelBottom: Math.round(labelRect?.bottom || 0),
        labelText: day.querySelector("small")?.textContent?.trim() || "",
        markerCenterX: Math.round((markerRect?.left || 0) + (markerRect?.width || 0) / 2),
        markerTop: Math.round(markerRect?.top || 0),
        markerWidth: Math.round(markerRect?.width || 0),
        markerHeight: Math.round(markerRect?.height || 0),
        ariaLabel: day.getAttribute("aria-label") || "",
        ariaPressed: day.getAttribute("aria-pressed") || ""
      };
    });

    return {
      weekLeft: Math.round(week?.left || 0),
      weekRight: Math.round(week?.right || 0),
      weekWidth: Math.round(week?.width || 0),
      weekTop: Math.round(week?.top || 0),
      weekBottom: Math.round(week?.bottom || 0),
      days
    };
  });

  expect(metrics.days).toHaveLength(7);
  expect(metrics.days.map((day) => day.labelText)).toEqual(["\u041f\u041d", "\u0412\u0422", "\u0421\u0420", "\u0427\u0422", "\u041f\u0422", "\u0421\u0411", "\u0412\u0421"]);
  expect(metrics.days.every((day) => day.labelText.length >= 2)).toBe(true);
  expect(metrics.days.every((day) => day.ariaLabel.startsWith("Выбрать "))).toBe(true);
  expect(metrics.days.some((day) => day.ariaPressed === "true")).toBe(true);
  for (const day of metrics.days) {
    expect(day.dayLeft).toBeGreaterThanOrEqual(metrics.weekLeft);
    expect(day.dayRight).toBeLessThanOrEqual(metrics.weekRight);
    expect(day.dayTop).toBeGreaterThanOrEqual(metrics.weekTop);
    expect(day.dayBottom).toBeLessThanOrEqual(metrics.weekBottom);
    expect(day.dayWidth).toBeLessThanOrEqual(Math.ceil(metrics.weekWidth / 7));
    expect(day.markerTop - day.labelBottom).toBeGreaterThanOrEqual(4);
    expect(Math.abs(day.markerCenterX - day.labelCenterX)).toBeLessThanOrEqual(1);
    expect(day.markerWidth).toBeLessThanOrEqual(28);
    expect(day.markerHeight).toBeLessThanOrEqual(28);
  }
}

test("client nutrition visual audit covers dense actions and modal entry points", async ({ page }, testInfo) => {
  const assertNoRuntimeErrors = failOnRuntimeErrors(page);

  await openClientNutritionHarness(page);
  await expect(page.getByTestId("client-harness-nutrition")).toBeVisible();
  await expect(page.locator(".nutritionHeroTitleV4 .clientCorePageTitle")).toBeVisible();

  await expectNutritionWeekStripReadable(page);
  await expectNoHorizontalOverflow(page);
  await expectTapTargets(page, [
    ".nutritionHeaderIconButton",
    ".nutritionOrbitHitButton",
    ".nutritionZoukHeader",
    ".nutritionAiPlanTopCard",
    ".clientBottomNav button"
  ]);
  await attachScreenshot(page, testInfo, "client-nutrition-main.png");

  await page.locator(".nutritionHeaderIconButton").first().click();
  await expect(page.locator(".fatFoodSearchScreenPremium")).toBeVisible();
  await expect(page.locator(".fatSearchBottomBar button[aria-pressed='true']")).toHaveCount(1);
  await expect(page.locator(".fatSearchSearchAction")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".fatSearchTitleButtonPremium")).toHaveAttribute("aria-expanded", /^(true|false)$/);
  await page.locator(".fatSearchTitleButtonPremium").click();
  await expect(page.locator(".fatMealDropdown")).toBeVisible();
  await expect(page.locator(".fatMealDropdown button[aria-pressed='true']")).toHaveCount(1);
  await page.locator(".fatMealDropdownCollapse").click();
  await expect(page.locator(".fatMealDropdown")).toBeHidden();
  await expectTapTargets(page, [
    ".fatSearchClosePremium",
    ".fatSearchTitleButtonPremium",
    ".foodSearchRecentCard",
    ".foodSearchFixedPhotoAction",
    ".fatSearchBottomBar button"
  ]);
  await expectAboveBottomBar(page, ".foodSearchFixedPhotoAction");
  await expectNoHorizontalOverflow(page);
  await attachScreenshot(page, testInfo, "client-nutrition-food-search.png");

  await page.locator(".fatSearchCreateAction").click();
  await expect(page.locator(".nutritionCreateChoiceScreen")).toBeVisible();
  await expect(page.locator(".fatSearchBottomBar button[aria-pressed='true']")).toHaveCount(1);
  await expect(page.locator(".fatSearchCreateAction")).toHaveAttribute("aria-pressed", "true");
  await expectTapTargets(page, [
    ".nutritionCreateChoiceClose",
    ".nutritionCreateChoiceGrid button",
    ".fatSearchBottomBar button"
  ], 40);
  await expectNoHorizontalOverflow(page);
  await attachScreenshot(page, testInfo, "client-nutrition-create-choice.png");
  await page.locator(".nutritionCreateChoiceClose").click();
  await expect(page.locator(".nutritionCreateChoiceScreen")).toBeHidden();

  await page.locator(".fatSearchInputWrapPremium input").fill("yogurt");
  await expect(page.locator(".fatSearchResultCard")).toHaveCount(2);
  await expectTapTargets(page, [".fatSearchResultCard", ".foodSearchFixedPhotoAction", ".fatSearchBottomBar button"]);
  await expectNoHorizontalOverflow(page);
  await attachScreenshot(page, testInfo, "client-nutrition-food-results.png");

  await page.locator(".fatSearchResultCard").first().click();
  await expect(page.locator(".foodProductRenderScreen")).toBeVisible();
  await expect(page.locator(".foodProductAmountStepper")).toBeVisible();
  await expect(page.locator(".foodEditInlineMealButton")).toHaveAttribute("aria-expanded", /^(true|false)$/);
  await page.locator(".foodEditInlineMealButton").click();
  await expect(page.locator(".foodEditMealPickerDropdown")).toBeVisible();
  await expect(page.locator(".foodEditMealPickerDropdown button[aria-pressed='true']")).toHaveCount(1);
  await page.locator(".foodEditMealPickerDropdown button").nth(1).click();
  await expect(page.locator(".foodEditMealPickerDropdown")).toBeHidden();
  await expect(page.locator(".weightModeButton")).toHaveAttribute("aria-pressed", /^(true|false)$/);
  await page.locator(".foodEditPortionDropdownButton").click();
  await expect(page.locator(".foodEditPortionDropdownMenu")).toBeVisible();
  await expect(page.locator(".foodEditPortionDropdownMenu button")).toHaveAttribute("aria-pressed", /^(true|false)$/);
  await page.locator(".foodEditPortionDropdownMenu button").first().click();
  await expect(page.locator(".foodEditPortionDropdownMenu")).toBeHidden();
  await expect(page.locator(".weightModeButton")).toHaveAttribute("aria-pressed", "false");
  await page.locator(".foodEditPortionDropdownButton").click();
  await expect(page.locator(".foodEditPortionDropdownMenu")).toBeVisible();
  await expect(page.locator(".foodEditPortionDropdownMenu button[aria-pressed='true']")).toHaveCount(1);
  await page.locator(".foodEditPortionDropdownButton").click();
  await expect(page.locator(".foodEditPortionDropdownMenu")).toBeHidden();
  await expectTapTargets(page, [
    ".foodProductTopAction",
    ".foodEditInlineMealButton",
    ".foodEditRow",
    ".foodProductActionBar button"
  ], 40);
  await expectNoHorizontalOverflow(page);
  await attachScreenshot(page, testInfo, "client-nutrition-product-screen.png");

  await page.locator(".foodProductTopEdit").click();
  await expect(page.locator(".foodEditPageSheet")).toBeVisible();
  await expect(page.locator(".foodEditIconPresetRow button").first()).toHaveAttribute("aria-pressed", /^(true|false)$/);
  const firstIconPreset = await page.locator(".foodEditIconPresetRow button").first().textContent();
  await page.locator(".foodEditIconManualBox input").fill(firstIconPreset || "");
  await expect(page.locator(".foodEditIconPresetRow button[aria-pressed='true']")).toHaveCount(1);
  await expect(page.locator(".foodEditPortionUnitToggle")).toHaveAttribute("aria-pressed", /^(true|false)$/);
  await expectTapTargets(page, [
    ".foodEditPageHeaderClose",
    ".foodEditIconPresetRow button",
    ".foodEditPageActionBar button"
  ], 40);
  await expectNoHorizontalOverflow(page);
  await attachScreenshot(page, testInfo, "client-nutrition-product-edit-sheet.png");
  await page.locator(".foodEditPageHeaderClose").click();
  await expect(page.locator(".foodEditPageSheet")).toBeHidden();

  await page.locator(".foodProductActionBar button").first().click();
  await expect(page.locator(".foodProductRenderScreen")).toBeHidden();

  await page.locator(".fatSearchMyProductsAction").click();
  await expect(page.locator(".fatSearchResultCard")).toHaveCount(1);
  await expect(page.locator(".fatSearchBottomBar button[aria-pressed='true']")).toHaveCount(1);
  await expect(page.locator(".fatSearchMyProductsAction")).toHaveAttribute("aria-pressed", "true");
  await expectTapTargets(page, [".fatSearchResultCard", ".fatSearchBottomBar button"]);
  await expectNoHorizontalOverflow(page);
  await attachScreenshot(page, testInfo, "client-nutrition-my-products.png");

  await page.locator(".fatSearchClosePremium").click();
  await expect(page.locator(".fatFoodSearchScreenPremium")).toBeHidden();

  await page.locator(".nutritionHeaderIconButton").nth(1).click();
  await expect(page.locator(".nutritionCalendarOverlay")).toBeVisible();
  await expect(page.locator(".nutritionCalendarDay")).toHaveCount(42);
  await expectTapTargets(page, [".nutritionCalendarClose"], 42);
  await expectNoHorizontalOverflow(page);
  await attachScreenshot(page, testInfo, "client-nutrition-calendar.png");
  await page.locator(".nutritionCalendarClose").click();
  await expect(page.locator(".nutritionCalendarOverlay")).toBeHidden();

  await page.locator(".nutritionZoukHeader").click();
  await expect(page.locator(".nutritionZoukModalOverlay")).toBeVisible();
  await expectTapTargets(page, [".nutritionZoukModalHeader button", ".nutritionZoukAdd", ".nutritionZoukFood"]);
  await expectNoHorizontalOverflow(page);
  await attachScreenshot(page, testInfo, "client-nutrition-diary-modal.png");
  await page.locator(".nutritionZoukModalHeader button").click();
  await expect(page.locator(".nutritionZoukModalOverlay")).toBeHidden();

  await page.locator(".nutritionAiPlanTopCard").click();
  await expect(page.locator(".nutritionAiPlanModal")).toBeVisible();
  await expectTapTargets(page, [".nutritionAiPlanToggleBtn"]);
  await expectNoHorizontalOverflow(page);
  await attachScreenshot(page, testInfo, "client-nutrition-analysis-modal.png");
  await page.locator(".nutritionAiPlanToggleBtn").click();
  await expect(page.locator(".nutritionAiPlanModal")).toBeHidden();

  assertNoRuntimeErrors();
});

test("client nutrition visual audit covers AI photo not-found modal", async ({ page }, testInfo) => {
  const assertNoRuntimeErrors = failOnRuntimeErrors(page);

  await page.goto("/?clientHarness=1&clientNutritionPhotoNotFound=1");
  await expect(page.getByTestId("client-harness-nutrition")).toBeVisible();
  await expect(page.locator(".fatFoodSearchScreenPremium")).toBeVisible();
  await expect(page.locator(".nutritionPhotoNotFoundModal")).toBeVisible();

  await expectTapTargets(page, [
    ".nutritionPhotoNotFoundClose",
    ".nutritionPhotoNotFoundActions button"
  ], 40);
  await expectNoHorizontalOverflow(page);
  await attachScreenshot(page, testInfo, "client-nutrition-photo-not-found.png");

  await page.locator(".nutritionPhotoNotFoundClose").click();
  await expect(page.locator(".nutritionPhotoNotFoundModal")).toBeHidden();

  assertNoRuntimeErrors();
});

test("client nutrition visual audit covers custom dish ingredient picker", async ({ page }, testInfo) => {
  const assertNoRuntimeErrors = failOnRuntimeErrors(page);

  await openClientNutritionHarness(page);
  await expect(page.getByTestId("client-harness-nutrition")).toBeVisible();

  await page.locator(".nutritionHeaderIconButton").first().click();
  await expect(page.locator(".fatFoodSearchScreenPremium")).toBeVisible();
  await page.locator(".fatSearchCreateAction").click();
  await expect(page.locator(".nutritionCreateChoiceScreen")).toBeVisible();
  await page.locator(".nutritionCreateChoiceGrid button").nth(1).click();

  await expect(page.locator(".foodEditPageSheet")).toBeVisible();
  await expect(page.locator(".dishEditIngredientsBox")).toBeVisible();
  await expectTapTargets(page, [".dishEditIngredientsHeader button", ".foodEditPageActionBar button"], 40);
  await expectNoHorizontalOverflow(page);
  await attachScreenshot(page, testInfo, "client-nutrition-custom-dish-editor.png");

  await page.locator(".dishEditIngredientsHeader button").click();
  await expect(page.locator(".dishIngredientPickerSheet")).toBeVisible();
  await expect(page.locator(".dishIngredientResultCard")).not.toHaveCount(0);
  await expectTapTargets(page, [".dishIngredientPickerHeader button", ".dishIngredientResultCard"], 40);
  await expectNoHorizontalOverflow(page);
  await attachScreenshot(page, testInfo, "client-nutrition-dish-ingredient-picker.png");

  await page.locator(".dishIngredientResultCard").first().click();
  await expect(page.locator(".dishIngredientConfirmCard")).toBeVisible();
  await expectTapTargets(page, [".dishIngredientConfirmActions button"], 40);
  await expectNoHorizontalOverflow(page);
  await attachScreenshot(page, testInfo, "client-nutrition-dish-ingredient-confirm.png");

  await page.locator(".dishIngredientConfirmAdd").click();
  await expect(page.locator(".dishEditIngredientRow")).toHaveCount(1);

  assertNoRuntimeErrors();
});
