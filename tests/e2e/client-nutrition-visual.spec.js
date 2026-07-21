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

async function openClientNutritionHarness(page, theme = "warm-light") {
  const themeQuery = theme === "warm-light"
    ? ""
    : `&clientHarnessTheme=${encodeURIComponent(theme)}`;
  await page.goto(`/?clientHarness=1${themeQuery}`);
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
      bottomBar: rectOf(document.querySelector('[data-testid="food-search-bottom-bar"], [data-testid="client-bottom-nav"]'))
    };
  }, floatingSelector);

  expect(metrics.floating).not.toBeNull();
  expect(metrics.bottomBar).not.toBeNull();
  expect(metrics.floating.bottom).toBeLessThanOrEqual(metrics.bottomBar.y + 1);
}

async function expectNutritionWeekStripReadable(page) {
  const metrics = await page.evaluate(() => {
    const week = document.querySelector('[data-nutrition-header-part="week"]')?.getBoundingClientRect();
    const days = [...document.querySelectorAll("[data-nutrition-header-day]")].map((day) => {
      const dayRect = day.getBoundingClientRect();
      const labelRect = day.querySelector("small")?.getBoundingClientRect();
      const markerRect = day.querySelector("span:last-child")?.getBoundingClientRect();

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
        ariaPressed: day.getAttribute("aria-pressed") || "",
        ariaCurrent: day.getAttribute("aria-current") || "",
        isToday: day.getAttribute("data-today") === "true"
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
  expect(metrics.days.filter((day) => day.ariaCurrent === "date")).toHaveLength(metrics.days.filter((day) => day.isToday).length);
  for (const day of metrics.days) {
    expect(day.dayLeft).toBeGreaterThanOrEqual(metrics.weekLeft);
    expect(day.dayRight).toBeLessThanOrEqual(metrics.weekRight);
    expect(day.dayTop).toBeGreaterThanOrEqual(metrics.weekTop);
    expect(day.dayBottom).toBeLessThanOrEqual(metrics.weekBottom);
    expect(day.dayWidth).toBeLessThanOrEqual(Math.ceil(metrics.weekWidth / 7));
    expect(day.markerTop - day.labelBottom).toBeGreaterThanOrEqual(2);
    expect(Math.abs(day.markerCenterX - day.labelCenterX)).toBeLessThanOrEqual(1);
    expect(day.markerWidth).toBeLessThanOrEqual(30);
    expect(day.markerHeight).toBeLessThanOrEqual(30);
  }
}

test("CSS V2 nutrition header stays scoped and responsive across the viewport matrix", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "One deterministic browser covers the viewport matrix.");

  const cases = [
    { width: 360, height: 800, theme: "warm-light" },
    { width: 390, height: 844, theme: "warm-light" },
    { width: 430, height: 932, theme: "warm-light" },
    { width: 768, height: 1024, theme: "warm-light" },
    { width: 1440, height: 900, theme: "warm-light" },
    { width: 390, height: 844, theme: "dark-green" }
  ];

  for (const entry of cases) {
    await page.setViewportSize({ width: entry.width, height: entry.height });
    await page.goto(`/cssV2?clientHarness=1&clientHarnessTheme=${entry.theme}`);
    await expect(page.getByTestId("client-nav-nutrition")).toBeVisible({ timeout: 40_000 });
    await page.getByTestId("client-nav-nutrition").click();

    const header = page.getByTestId("nutrition-header");
    const title = header.locator('[data-nutrition-header-part="title"]');
    const actions = header.locator("[data-nutrition-header-action]");
    const week = page.locator('[data-nutrition-header-part="week"]');
    const days = page.locator("[data-nutrition-header-day]");
    const labels = page.locator('[data-nutrition-header-part="day-label"]');
    const dots = page.locator('[data-nutrition-header-part="day-dot"]');

    await expect(header).toBeVisible();
    await expect(header).toHaveAttribute("data-css-module-scope", "nutrition-header");
    await expect(header).toHaveAttribute("data-client-page-header", "true");
    await expect(header).toHaveCSS("position", "fixed");
    await expect(title).toHaveCSS("font-size", "16px");
    await expect(actions).toHaveCount(2);
    await expect(actions.first()).toHaveCSS("width", "44px");
    await expect(actions.first()).toHaveCSS("height", "44px");
    await expect(week).toHaveCSS("height", "64px");
    await expect(days).toHaveCount(7);
    await expect(days.first()).toHaveCSS("height", "50px");
    await expect(labels.first()).toHaveCSS("font-size", "9.5px");
    await expect(dots.first()).toBeHidden();
    await expect(week.locator('[data-selected="true"][aria-pressed="true"]')).toHaveCount(1);
    await expect(page.locator(".nutritionHeroV4, .nutritionHeroTitleV4, .nutritionHeaderIconButton, .nutritionWeekV4, .nutritionDayV4, .nutritionStreakV4")).toHaveCount(0);

    const geometry = await page.evaluate(() => {
      const headerNode = document.querySelector('[data-testid="nutrition-header"]');
      const headerBarNode = headerNode.querySelector('[data-nutrition-header-part="title-row"]');
      const actionNodes = [...headerNode.querySelectorAll("[data-nutrition-header-action]")];
      const weekNode = document.querySelector('[data-nutrition-header-part="week"]');
      const headerRect = headerNode.getBoundingClientRect();
      const headerBarRect = headerBarNode.getBoundingClientRect();
      const actionRects = actionNodes.map((action) => action.getBoundingClientRect());
      const weekRect = weekNode.getBoundingClientRect();
      const dayRects = [...weekNode.querySelectorAll("[data-nutrition-header-day]")].map((day) => day.getBoundingClientRect());
      return {
        left: headerRect.left,
        right: headerRect.right,
        actionRightInset: Math.round(headerRect.right - actionRects.at(-1).right),
        actionsVerticallyCentered: actionRects.every((rect) => (
          Math.abs((rect.top + rect.height / 2) - (headerBarRect.top + headerBarRect.height / 2)) <= 1
        )),
        weekBelowHeader: weekRect.top >= headerRect.bottom,
        dayInsideWeek: dayRects.every((rect) => rect.left >= weekRect.left && rect.right <= weekRect.right)
      };
    });
    expect(geometry.left).toBeGreaterThanOrEqual(0);
    expect(geometry.right).toBeLessThanOrEqual(entry.width);
    expect(geometry.actionRightInset).toBe(entry.width <= 370 ? 16 : 20);
    expect(geometry.actionsVerticallyCentered).toBe(true);
    expect(geometry.weekBelowHeader).toBe(true);
    expect(geometry.dayInsideWeek).toBe(true);
    await expectNutritionWeekStripReadable(page);
    await expectNoHorizontalOverflow(page);

    await page.getByTestId("nutrition-header-calendar").click();
    await expect(page.getByTestId("nutrition-calendar-modal")).toBeVisible();
    await page.getByTestId("nutrition-calendar-close").click();
    await expect(page.getByTestId("nutrition-calendar-modal")).toBeHidden();
  }
});

test("CSS V2 nutrition page shell and bottom bar stay scoped across the viewport matrix", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "One deterministic browser covers the viewport matrix.");

  const cases = [
    { width: 360, height: 800, theme: "warm-light", navHeight: 76, strokeWidth: "2px" },
    { width: 390, height: 844, theme: "warm-light", navHeight: 76, strokeWidth: "2px" },
    { width: 430, height: 932, theme: "warm-light", navHeight: 76, strokeWidth: "2px" },
    { width: 768, height: 1024, theme: "warm-light", navHeight: 76, strokeWidth: "2px" },
    { width: 1440, height: 900, theme: "warm-light", navHeight: 76, strokeWidth: "2px" },
    { width: 390, height: 844, theme: "dark-green", navHeight: 80, strokeWidth: "2px" }
  ];

  for (const entry of cases) {
    await page.setViewportSize({ width: entry.width, height: entry.height });
    await page.goto(`/cssV2?clientHarness=1&clientHarnessTheme=${entry.theme}`);
    await page.getByTestId("client-nav-nutrition").click();

    const root = page.getByTestId("nutrition-page");
    const navigation = page.getByTestId("client-bottom-nav");
    const buttons = navigation.locator(":scope > button");
    const icons = navigation.locator(":scope > button svg");

    await expect(root).toBeVisible();
    await expect(root).toHaveAttribute("data-css-module-scope", "nutrition-page");
    await expect(root).not.toHaveClass(/fatSecretPage|nutritionFixedHeaderV3|clientCorePageNutrition/);
    await expect(navigation).toBeVisible();
    await expect(navigation).toHaveAttribute("data-css-module-scope", "nutrition-bottom-bar");
    await expect(navigation).not.toHaveClass(/nutritionBottomTabBar|clientBottomNav/);
    await expect(navigation.locator("..")).toHaveCSS("position", "fixed");
    await expect(navigation).toHaveCSS("height", `${entry.navHeight}px`);
    await expect(buttons).toHaveCount(4);
    await expect(icons).toHaveCount(4);
    await expect(icons.first()).toHaveCSS("stroke-width", entry.strokeWidth);
    await expect(page.getByTestId("client-nav-nutrition")).toHaveAttribute("aria-current", "page");

    const geometry = await page.evaluate(() => {
      const rootNode = document.querySelector('[data-testid="nutrition-page"]');
      const navNode = document.querySelector('[data-testid="client-bottom-nav"]');
      const rootRect = rootNode.getBoundingClientRect();
      const navRect = navNode.getBoundingClientRect();
      const buttonRects = [...navNode.querySelectorAll(":scope > button")].map((button) => button.getBoundingClientRect());
      return {
        viewport: { width: innerWidth, height: innerHeight },
        documentWidth: document.documentElement.scrollWidth,
        root: { left: rootRect.left, right: rootRect.right, width: rootRect.width },
        navigation: { left: navRect.left, right: navRect.right, top: navRect.top, bottom: navRect.bottom, width: navRect.width },
        buttonsInsideNavigation: buttonRects.every((rect) => (
          rect.left >= navRect.left && rect.right <= navRect.right
          && rect.top >= navRect.top && rect.bottom <= navRect.bottom
        )),
        buttonWidths: buttonRects.map((rect) => Math.round(rect.width * 100) / 100)
      };
    });

    expect(geometry.documentWidth).toBeLessThanOrEqual(geometry.viewport.width + 1);
    expect(geometry.root.left).toBeGreaterThanOrEqual(0);
    expect(geometry.root.right).toBeLessThanOrEqual(geometry.viewport.width);
    expect(geometry.navigation.left).toBeGreaterThanOrEqual(0);
    expect(geometry.navigation.right).toBeLessThanOrEqual(geometry.viewport.width);
    expect(geometry.navigation.top).toBeGreaterThanOrEqual(0);
    expect(geometry.navigation.bottom).toBeLessThanOrEqual(geometry.viewport.height);
    if (entry.theme === "warm-light") {
      expect(geometry.navigation.width).toBe(Math.min(382, entry.width - 20));
    } else {
      expect(geometry.navigation.width).toBeLessThanOrEqual(394);
    }
    expect(geometry.buttonsInsideNavigation).toBe(true);
    expect(Math.max(...geometry.buttonWidths) - Math.min(...geometry.buttonWidths)).toBeLessThanOrEqual(1);
    expect(geometry.root.width).toBe(Math.min(402, entry.width));
  }
});

test("client nutrition visual audit covers dense actions and modal entry points", async ({ page }, testInfo) => {
  const assertNoRuntimeErrors = failOnRuntimeErrors(page);

  await openClientNutritionHarness(page);
  await expect(page.getByTestId("client-harness-nutrition")).toBeVisible();
  await expect(page.locator('[data-nutrition-header-part="title"]')).toBeVisible();
  await expect(page.getByLabel("Поиск еды")).toBeVisible();
  await expect(page.getByLabel("Календарь")).toBeVisible();

  await expectNutritionWeekStripReadable(page);
  await expectNoHorizontalOverflow(page);
  await expectTapTargets(page, [
    "[data-nutrition-header-action]",
    '[data-nutrition-summary-part="card"]',
    '[data-testid="client-bottom-nav"] button'
  ]);
  await expectTapTargets(page, ['[data-testid="nutrition-orbit-add"]'], 38);
  await expectTapTargets(page, ['[data-testid="nutrition-diary-toggle"]'], 35);
  await attachScreenshot(page, testInfo, "client-nutrition-main.png");

  await page.locator("[data-nutrition-header-action]").first().click();
  await expect(page.getByTestId("food-search-screen")).toBeVisible();
  await expect(page.locator('[data-testid="food-search-bottom-bar"] button[aria-pressed="true"]')).toHaveCount(1);
  await expect(page.locator('[data-food-search-action="search"]')).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("food-search-header")).toHaveAttribute("data-css-module-scope", "food-search-header");
  await expect(page.locator('[data-food-search-header-action="toggle-meal"]')).toHaveAttribute("aria-expanded", /^(true|false)$/);
  await page.locator('[data-food-search-header-action="toggle-meal"]').click();
  await expect(page.getByTestId("food-search-meal-menu")).toBeVisible();
  await expect(page.locator("[data-food-search-meal][aria-pressed='true']")).toHaveCount(1);
  await page.locator('[data-food-search-header-action="collapse-meal"]').click();
  await expect(page.getByTestId("food-search-meal-menu")).toBeHidden();
  await expectTapTargets(page, [
    '[data-food-search-header-action="close"]',
    '[data-food-search-header-action="toggle-meal"]',
    "[data-food-search-recent-card]",
    '[data-testid="food-search-photo-action"]',
    '[data-testid="food-search-bottom-bar"] button'
  ]);
  await expectAboveBottomBar(page, '[data-testid="food-search-photo-action"]');
  await expectNoHorizontalOverflow(page);
  await attachScreenshot(page, testInfo, "client-nutrition-food-search.png");

  await page.locator('[data-food-search-action="create"]').click();
  await expect(page.getByTestId("nutrition-create-choice")).toBeVisible();
  await expect(page.locator('[data-testid="food-search-bottom-bar"] button[aria-pressed="true"]')).toHaveCount(1);
  await expect(page.locator('[data-food-search-action="create"]')).toHaveAttribute("aria-pressed", "true");
  const createChoiceClosePlacement = await page.evaluate(() => {
    const close = document.querySelector('[data-testid="nutrition-create-choice-close"]')?.getBoundingClientRect();
    return close
      ? {
          width: close.width,
          height: close.height,
          rightInset: window.innerWidth - close.right,
          expectedRightInset: Math.max(16, (window.innerWidth - 402) / 2 + 16)
        }
      : null;
  });
  expect(createChoiceClosePlacement).not.toBeNull();
  expect(createChoiceClosePlacement.width).toBeCloseTo(44, 1);
  expect(createChoiceClosePlacement.height).toBeCloseTo(44, 1);
  expect(createChoiceClosePlacement.rightInset).toBeCloseTo(createChoiceClosePlacement.expectedRightInset, 1);
  await expectTapTargets(page, [
    '[data-testid="nutrition-create-choice-close"]',
    '[data-testid="nutrition-create-choice-option"]',
    '[data-testid="food-search-bottom-bar"] button'
  ], 40);
  await expectNoHorizontalOverflow(page);
  await attachScreenshot(page, testInfo, "client-nutrition-create-choice.png");
  await page.getByTestId("nutrition-create-choice-close").click();
  await expect(page.getByTestId("nutrition-create-choice")).toBeHidden();

  await page.getByTestId("food-search-input").locator("input").fill("yogurt");
  await expect(page.locator("[data-food-search-result-card]")).toHaveCount(2);
  await expectTapTargets(page, ["[data-food-search-result-card]", '[data-testid="food-search-photo-action"]', '[data-testid="food-search-bottom-bar"] button']);
  await expectNoHorizontalOverflow(page);
  await attachScreenshot(page, testInfo, "client-nutrition-food-results.png");

  await page.locator("[data-food-search-result-card]").first().click();
  await expect(page.getByTestId("food-product-page")).toBeVisible();
  await expect(page.getByTestId("food-portion-selector")).toBeVisible();
  await expect(page.locator('[data-food-product-header-action="toggle-meal"]')).toHaveAttribute("aria-expanded", /^(true|false)$/);
  await page.locator('[data-food-product-header-action="toggle-meal"]').click();
  await expect(page.getByTestId("food-product-meal-menu")).toBeVisible();
  await expect(page.locator("[data-food-product-meal][aria-pressed='true']")).toHaveCount(1);
  await page.locator("[data-food-product-meal]").nth(1).click();
  await expect(page.getByTestId("food-product-meal-menu")).toBeHidden();
  await expect(page.locator('[data-food-portion-action="grams"]')).toHaveAttribute("aria-pressed", /^(true|false)$/);
  await page.locator('[data-food-portion-action="toggle-menu"]').click();
  await expect(page.getByTestId("food-portion-menu")).toBeVisible();
  await expect(page.locator("[data-food-portion-unit]")).toHaveAttribute("aria-pressed", /^(true|false)$/);
  await page.locator("[data-food-portion-unit]").first().click();
  await expect(page.getByTestId("food-portion-menu")).toBeHidden();
  await expect(page.locator('[data-food-portion-action="grams"]')).toHaveAttribute("aria-pressed", "false");
  await page.locator('[data-food-portion-action="toggle-menu"]').click();
  await expect(page.getByTestId("food-portion-menu")).toBeVisible();
  await expect(page.locator("[data-food-portion-unit][aria-pressed='true']")).toHaveCount(1);
  await page.locator('[data-food-portion-action="toggle-menu"]').click();
  await expect(page.getByTestId("food-portion-menu")).toBeHidden();
  await expectTapTargets(page, [
    "[data-food-product-top-action]",
    '[data-testid="food-product-action-bar"] button'
  ], 40);
  await expectNoHorizontalOverflow(page);
  await attachScreenshot(page, testInfo, "client-nutrition-product-screen.png");

  await page.locator('[data-food-product-top-action="edit"]').click();
  await expect(page.getByTestId("food-edit-page")).toBeVisible();
  const editActionBarMetrics = await page.evaluate(() => {
    const sheet = document.querySelector('[data-testid="food-edit-page"]')?.getBoundingClientRect();
    const actionBarNode = document.querySelector('[data-food-edit-page-part="actions"]');
    const actionBar = actionBarNode?.getBoundingClientRect();
    const actionBarStyle = actionBarNode ? window.getComputedStyle(actionBarNode) : null;

    return {
      position: actionBarStyle?.position || "",
      centerDelta: sheet && actionBar
        ? Math.round(Math.abs((actionBar.left + actionBar.right - sheet.left - sheet.right) / 2))
        : null,
      leftInset: sheet && actionBar ? Math.round(actionBar.left - sheet.left) : null,
      rightInset: sheet && actionBar ? Math.round(sheet.right - actionBar.right) : null,
      bottomInset: sheet && actionBar ? Math.round(sheet.bottom - actionBar.bottom) : null,
      actionBarWidth: actionBar ? Math.round(actionBar.width) : null,
      actionBarHeight: actionBar ? Math.round(actionBar.height) : null,
      bottomOffset: actionBar ? Math.round(window.innerHeight - actionBar.bottom) : null,
      sheetWidth: sheet ? Math.round(sheet.width) : null,
      buttonRects: [...document.querySelectorAll('[data-food-edit-page-part="actions"] button')]
        .map((button) => {
          const rect = button.getBoundingClientRect();
          return { left: rect.left, right: rect.right, height: Math.round(rect.height) };
        }),
      buttonOverflow: [...document.querySelectorAll('[data-food-edit-page-part="actions"] button')]
        .map((button) => button.getBoundingClientRect())
        .some((button) => actionBar && (button.left < actionBar.left - 1 || button.right > actionBar.right + 1)),
      viewportHeight: window.innerHeight
    };
  });
  expect(editActionBarMetrics.position).toBe("fixed");
  expect(editActionBarMetrics.centerDelta).toBeLessThanOrEqual(1);
  expect(editActionBarMetrics.leftInset).toBeGreaterThanOrEqual(8);
  expect(editActionBarMetrics.rightInset).toBeGreaterThanOrEqual(8);
  expect(editActionBarMetrics.bottomInset).toBeGreaterThanOrEqual(8);
  expect(editActionBarMetrics.actionBarWidth).toBeLessThan(editActionBarMetrics.sheetWidth);
  expect(editActionBarMetrics.actionBarHeight).toBe(76);
  expect(editActionBarMetrics.bottomOffset)
    .toBe(Math.max(0, editActionBarMetrics.viewportHeight - 874) + 14);
  expect(editActionBarMetrics.buttonRects.every((button) => button.height === 58)).toBe(true);
  expect(editActionBarMetrics.buttonOverflow).toBe(false);
  await expect(page.getByTestId("food-edit-basic-presets").locator("button").first()).toHaveAttribute("aria-pressed", /^(true|false)$/);
  const firstIconPreset = await page.getByTestId("food-edit-basic-presets").locator("button").first().textContent();
  await page.getByTestId("food-edit-basic-icon").locator("input").fill(firstIconPreset || "");
  await expect(page.getByTestId("food-edit-basic-presets").locator("button[aria-pressed='true']")).toHaveCount(1);
  await expect(page.locator('[data-food-edit-basic-action="toggle-unit"]')).toHaveAttribute("aria-pressed", /^(true|false)$/);
  await expectTapTargets(page, [
    '[data-food-edit-page-action="close"]',
    '[data-testid="food-edit-basic-presets"] button',
    '[data-food-edit-page-part="actions"] button'
  ], 40);
  await expectNoHorizontalOverflow(page);
  await attachScreenshot(page, testInfo, "client-nutrition-product-edit-sheet.png");
  await page.locator('[data-food-edit-page-action="close"]').click();
  await expect(page.getByTestId("food-edit-page")).toBeHidden();

  await page.locator('[data-food-product-action="back"]').click();
  await expect(page.getByTestId("food-product-page")).toBeHidden();

  await page.locator('[data-food-search-action="my-products"]').click();
  await expect(page.locator("[data-food-search-result-card]")).toHaveCount(1);
  await expect(page.locator('[data-testid="food-search-bottom-bar"] button[aria-pressed="true"]')).toHaveCount(1);
  await expect(page.locator('[data-food-search-action="my-products"]')).toHaveAttribute("aria-pressed", "true");
  await expectTapTargets(page, ["[data-food-search-result-card]", '[data-testid="food-search-bottom-bar"] button']);
  await expectNoHorizontalOverflow(page);
  await attachScreenshot(page, testInfo, "client-nutrition-my-products.png");

  await page.locator('[data-food-search-header-action="close"]').click();
  await expect(page.getByTestId("food-search-screen")).toBeHidden();

  await page.locator("[data-nutrition-header-action]").nth(1).click();
  await expect(page.getByTestId("nutrition-calendar-modal")).toBeVisible();
  await expect(page.locator("[data-nutrition-calendar-day]")).toHaveCount(42);
  await expect(page.locator("[data-nutrition-calendar-day][aria-pressed='true']")).toHaveCount(1);
  await expect(page.locator("[data-nutrition-calendar-day][aria-current='date']")).toHaveCount(1);
  await expectTapTargets(page, ['[data-testid="nutrition-calendar-close"]'], 42);
  await expectNoHorizontalOverflow(page);
  await attachScreenshot(page, testInfo, "client-nutrition-calendar.png");
  await page.getByTestId("nutrition-calendar-close").click();
  await expect(page.getByTestId("nutrition-calendar-modal")).toBeHidden();

  await page.getByTestId("nutrition-diary-toggle").click();
  await expect(page.getByTestId("nutrition-diary-modal")).toBeVisible();
  await expectTapTargets(page, [
    '[data-testid="nutrition-diary-close"]',
    '[data-testid="nutrition-diary-add"]',
    '[data-testid="nutrition-diary-food"]'
  ]);
  await expectNoHorizontalOverflow(page);
  await attachScreenshot(page, testInfo, "client-nutrition-diary-modal.png");
  await page.getByTestId("nutrition-diary-close").click();
  await expect(page.getByTestId("nutrition-diary-modal")).toBeHidden();

  await page.locator('[data-nutrition-summary-part="card"]').click();
  await expect(page.getByTestId("nutrition-plan-details")).toBeVisible();
  await expectTapTargets(page, ["[data-testid='nutrition-plan-close']"]);
  await expectNoHorizontalOverflow(page);
  await attachScreenshot(page, testInfo, "client-nutrition-analysis-modal.png");
  await page.getByTestId("nutrition-plan-close").click();
  await expect(page.getByTestId("nutrition-plan-details")).toBeHidden();

  assertNoRuntimeErrors();
});

test("client nutrition visual audit covers AI photo not-found modal", async ({ page }, testInfo) => {
  const assertNoRuntimeErrors = failOnRuntimeErrors(page);

  await page.goto("/?clientHarness=1&clientNutritionPhotoNotFound=1");
  await expect(page.getByTestId("client-harness-nutrition")).toBeVisible();
  await expect(page.getByTestId("food-search-screen")).toBeVisible();
  await expect(page.getByTestId("nutrition-photo-not-found-modal")).toBeVisible();

  await expectTapTargets(page, [
    '[data-testid="nutrition-photo-not-found-close"]',
    '[data-testid="nutrition-photo-not-found-modal"] button'
  ], 40);
  await expectNoHorizontalOverflow(page);
  await attachScreenshot(page, testInfo, "client-nutrition-photo-not-found.png");

  await page.getByTestId("nutrition-photo-not-found-close").click();
  await expect(page.getByTestId("nutrition-photo-not-found-modal")).toBeHidden();

  assertNoRuntimeErrors();
});

test("client nutrition photo analysis process keeps its scoped loading state", async ({ page }, testInfo) => {
  const assertNoRuntimeErrors = failOnRuntimeErrors(page);

  await page.goto("/cssV2?clientHarness=1&clientNutritionPhotoAnalyzing=1");
  await expect(page.getByTestId("client-harness-nutrition")).toBeVisible();
  const process = page.getByTestId("food-photo-ai-search-process");
  await expect(process).toBeVisible();
  await expect(process).toContainText("ИИ ищет продукт по фото");
  await expectNoHorizontalOverflow(page);
  await attachScreenshot(page, testInfo, "client-nutrition-photo-analysis-process.png");

  assertNoRuntimeErrors();
});

test("CSS V2 nutrition barcode placeholder stays fullscreen at target heights", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "One deterministic browser covers the viewport matrix.");

  const assertNoRuntimeErrors = failOnRuntimeErrors(page);
  const viewports = [
    { width: 360, height: 640 },
    { width: 390, height: 844 },
    { width: 1440, height: 900 }
  ];

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto("/cssV2?clientHarness=1&clientNutritionBarcode=1");
    const overlay = page.getByTestId("nutrition-barcode-overlay");
    await expect(overlay).toBeVisible();
    await expect(page.getByTestId("nutrition-barcode-placeholder")).toBeVisible();
    await expect(overlay).toContainText("Поиск по штрихкоду появится позже");
    await expectNoHorizontalOverflow(page);
  }

  assertNoRuntimeErrors();
});

test("client nutrition delete confirmation keeps its scoped modal contract", async ({ page }, testInfo) => {
  const assertNoRuntimeErrors = failOnRuntimeErrors(page);

  await page.goto("/cssV2?clientHarness=1&clientHarnessPage=nutritionDeleteConfirm");
  await expect(page.getByTestId("client-harness-nutrition-delete-confirm")).toBeVisible();
  await expect(page.getByTestId("nutrition-delete-confirm-modal")).toBeVisible();
  await expectTapTargets(page, [
    '[data-testid="nutrition-delete-confirm-close"]',
    '[data-testid="nutrition-delete-confirm-modal"] button:not([data-testid="nutrition-delete-confirm-backdrop"])'
  ]);
  await expectNoHorizontalOverflow(page);
  await attachScreenshot(page, testInfo, "client-nutrition-delete-confirm.png");

  await page.getByTestId("nutrition-delete-confirm-close").click();
  await expect(page.getByTestId("nutrition-delete-confirm-modal")).toBeHidden();

  assertNoRuntimeErrors();
});

test("client nutrition undo toast stays above navigation and restores cleanly", async ({ page }, testInfo) => {
  const assertNoRuntimeErrors = failOnRuntimeErrors(page);

  await page.goto("/cssV2?clientHarness=1&clientHarnessPage=nutritionUndoToast");
  await expect(page.getByTestId("client-harness-nutrition-undo-toast")).toBeVisible();
  await expect(page.getByTestId("nutrition-undo-toast")).toBeVisible();
  await expectAboveBottomBar(page, '[data-testid="nutrition-undo-toast"]');
  await expectTapTargets(page, ['[data-testid="nutrition-undo-restore"]'], 36);
  await expectNoHorizontalOverflow(page);
  await attachScreenshot(page, testInfo, "client-nutrition-undo-toast.png");

  await page.getByTestId("nutrition-undo-restore").click();
  await expect(page.getByTestId("nutrition-undo-toast")).toBeHidden();

  assertNoRuntimeErrors();
});

test("food edit page keeps its scoped responsive geometry", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "One deterministic browser covers the viewport matrix.");

  const cases = [
    {
      name: "warm-360",
      viewport: { width: 360, height: 800 },
      theme: "warm-light",
      expected: { sheetWidth: 360, sheetHeight: 800, contentWidth: 328, contentHeight: 586, actionWidth: 340, actionHeight: 76, closeSize: 44 }
    },
    {
      name: "warm-390",
      viewport: { width: 390, height: 844 },
      theme: "warm-light",
      expected: { sheetWidth: 390, sheetHeight: 844, contentWidth: 358, contentHeight: 630, actionWidth: 370, actionHeight: 76, closeSize: 44 }
    },
    {
      name: "warm-430",
      viewport: { width: 430, height: 932 },
      theme: "warm-light",
      expected: { sheetWidth: 402, sheetHeight: 932, contentWidth: 370, contentHeight: 718, actionWidth: 382, actionHeight: 76, closeSize: 44 }
    },
    {
      name: "warm-768",
      viewport: { width: 768, height: 1024 },
      theme: "warm-light",
      expected: { sheetWidth: 402, sheetHeight: 1024, contentWidth: 370, contentHeight: 810, actionWidth: 382, actionHeight: 76, closeSize: 44 }
    },
    {
      name: "warm-1440",
      viewport: { width: 1440, height: 900 },
      theme: "warm-light",
      expected: { sheetWidth: 402, sheetHeight: 900, contentWidth: 370, contentHeight: 686, actionWidth: 382, actionHeight: 76, closeSize: 44 }
    },
    {
      name: "dark-390",
      viewport: { width: 390, height: 844 },
      theme: "dark-green",
      expected: { sheetWidth: 374, sheetHeight: 844, contentWidth: 348, contentHeight: 662, actionWidth: 368, actionHeight: 80, closeSize: 44 }
    }
  ];

  for (const testCase of cases) {
    await page.setViewportSize(testCase.viewport);
    await openClientNutritionHarness(page, testCase.theme);
    await page.locator("[data-nutrition-header-action]").first().click();
    await expect(page.getByTestId("food-search-screen")).toBeVisible();
    await page.getByTestId("food-search-input").locator("input").fill("yogurt");
    await page.locator("[data-food-search-result-card]").first().click();
    await page.locator('[data-food-product-top-action="edit"]').click();
    await expect(page.getByTestId("food-edit-page")).toBeVisible();

    const editHeader = page.getByTestId("food-edit-header");
    const editClose = page.locator('[data-food-edit-page-action="close"]');
    await expect(editHeader).toHaveAttribute("data-client-page-header-controls", "workout");
    if (testCase.theme === "warm-light") {
      await expect(editClose).toHaveCSS("width", "44px");
      await expect(editClose).toHaveCSS("height", "44px");
      await expect(editClose).toHaveCSS("border-radius", "50%");
      await expect(editClose).toHaveCSS("background-color", "rgba(123, 118, 130, 0.1)");
      await expect(editClose).toHaveCSS("color", "rgb(40, 38, 46)");
      const editHeaderBox = await editHeader.boundingBox();
      const editCloseBox = await editClose.boundingBox();
      expect(editHeaderBox).not.toBeNull();
      expect(editCloseBox).not.toBeNull();
      const expectedRightInset = Math.max(16, (testCase.viewport.width - 402) / 2 + 16);
      expect(
        Math.abs(testCase.viewport.width - editCloseBox.x - editCloseBox.width - expectedRightInset),
        testCase.name
      ).toBeLessThanOrEqual(1);
    }

    const metrics = await page.evaluate(() => {
      const rect = (selector) => {
        const bounds = document.querySelector(selector)?.getBoundingClientRect();
        return bounds
          ? { width: bounds.width, height: bounds.height, left: bounds.left, right: bounds.right }
          : null;
      };

      return {
        scopeCount: document.querySelectorAll('[data-css-module-scope="food-edit-page"]').length,
        oldClassCount: document.querySelectorAll('[class*="foodEditPage"]').length,
        sheet: rect('[data-testid="food-edit-page"]'),
        content: rect('[data-food-edit-page-part="content"]'),
        action: rect('[data-food-edit-page-part="actions"]'),
        close: rect('[data-food-edit-page-action="close"]'),
        documentWidth: document.documentElement.scrollWidth,
        viewportWidth: window.innerWidth
      };
    });

    const closeTo = (actual, expected) => {
      expect(Math.abs(actual - expected), testCase.name).toBeLessThanOrEqual(1);
    };

    expect(metrics.scopeCount, testCase.name).toBe(1);
    expect(metrics.oldClassCount, testCase.name).toBe(0);
    expect(metrics.sheet, testCase.name).not.toBeNull();
    expect(metrics.content, testCase.name).not.toBeNull();
    expect(metrics.action, testCase.name).not.toBeNull();
    expect(metrics.close, testCase.name).not.toBeNull();
    closeTo(metrics.sheet.width, testCase.expected.sheetWidth);
    closeTo(metrics.sheet.height, testCase.expected.sheetHeight);
    closeTo(metrics.content.width, testCase.expected.contentWidth);
    closeTo(metrics.content.height, testCase.expected.contentHeight);
    closeTo(metrics.action.width, testCase.expected.actionWidth);
    closeTo(metrics.action.height, testCase.expected.actionHeight);
    closeTo(metrics.close.width, testCase.expected.closeSize);
    closeTo(metrics.close.height, testCase.expected.closeSize);
    expect(metrics.documentWidth, testCase.name).toBeLessThanOrEqual(metrics.viewportWidth + 1);

    if (testCase.name === "warm-390") {
      const nameInput = page.getByTestId("food-edit-basic-name").locator("input");
      const confirm = page.locator('[data-food-edit-page-action="confirm"]');
      await nameInput.fill("");
      await expect(confirm).toBeDisabled();
      await nameInput.fill("Harness Greek Yogurt");
      await expect(confirm).toBeEnabled();
    }
  }
});

test("client nutrition visual audit covers custom dish ingredient picker", async ({ page }, testInfo) => {
  const assertNoRuntimeErrors = failOnRuntimeErrors(page);

  await openClientNutritionHarness(page);
  await expect(page.getByTestId("client-harness-nutrition")).toBeVisible();

  await page.locator("[data-nutrition-header-action]").first().click();
  await expect(page.getByTestId("food-search-screen")).toBeVisible();
  await page.locator('[data-food-search-action="create"]').click();
  await expect(page.getByTestId("nutrition-create-choice")).toBeVisible();
  await page.getByTestId("nutrition-create-choice-option").nth(1).click();

  await expect(page.getByTestId("food-edit-page")).toBeVisible();
  await expect(page.getByTestId("dish-edit-ingredients")).toBeVisible();
  await expectTapTargets(page, ['[data-dish-ingredients-action="add"]', '[data-food-edit-page-part="actions"] button'], 40);
  await expectNoHorizontalOverflow(page);
  await attachScreenshot(page, testInfo, "client-nutrition-custom-dish-editor.png");

  await page.locator('[data-dish-ingredients-action="add"]').click();
  await expect(page.getByTestId("dish-ingredient-picker-sheet")).toBeVisible();
  await expect(page.locator("[data-dish-ingredient-result]")).not.toHaveCount(0);
  await expectTapTargets(page, ['[data-dish-ingredient-action="close"]', "[data-dish-ingredient-result]"], 40);
  await expectNoHorizontalOverflow(page);
  await attachScreenshot(page, testInfo, "client-nutrition-dish-ingredient-picker.png");

  await page.locator("[data-dish-ingredient-result]").first().click();
  await expect(page.getByTestId("dish-ingredient-confirm-card")).toBeVisible();
  await expectTapTargets(page, ['[data-testid="dish-ingredient-confirm-actions"] button'], 40);
  await expectNoHorizontalOverflow(page);
  await attachScreenshot(page, testInfo, "client-nutrition-dish-ingredient-confirm.png");

  await page.locator('[data-dish-ingredient-action="add"]').click();
  await expect(page.locator('[data-dish-ingredients-action="remove"]')).toHaveCount(1);

  assertNoRuntimeErrors();
});

test("CSS V2 food search header keeps stable scoped search and my-products layouts", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "One deterministic browser covers the viewport matrix.");

  const assertNoRuntimeErrors = failOnRuntimeErrors(page);
  const viewports = [
    { width: 360, height: 800 },
    { width: 390, height: 844 },
    { width: 430, height: 932 },
    { width: 768, height: 1024 },
    { width: 1440, height: 900 }
  ];

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto("/cssV2?clientHarness=1");
    await expect(page.getByTestId("client-nav-nutrition")).toBeVisible({ timeout: 40_000 });
    await page.getByTestId("client-nav-nutrition").click();
    await page.locator("[data-nutrition-header-action]").first().click();

    const header = page.getByTestId("food-search-header");
    const title = header.locator("h1");
    const mealSelector = page.getByTestId("food-search-meal-selector");
    const mealButton = page.locator('[data-food-search-header-action="toggle-meal"]');
    const closeButton = page.locator('[data-food-search-header-action="close"]');
    await expect(header).toBeVisible();
    await expect(header).toHaveAttribute("data-css-module-scope", "food-search-header");
    await expect(header).toHaveAttribute("data-food-search-header-variant", "search");
    await expect(header).toHaveAttribute("data-client-page-header", "true");
    await expect(header).toHaveCSS("position", "fixed");
    await expect(header).toHaveCSS("height", "132px");
    await expect(header).toHaveCSS("margin-top", "0px");
    await expect(title).toHaveCSS("font-size", "16px");
    await expect(mealSelector).toHaveCSS("height", "60px");
    await expect(mealButton).toHaveCSS("height", "60px");
    await expect(closeButton).toHaveCSS("width", "44px");
    await expect(closeButton).toHaveCSS("height", "44px");
    await expect(page.locator(".fatSearchTopPremium, .foodSearchHeaderExactMainAlign, .foodFlowTitleGroup, .fatSearchTitleWrap, .fatSearchTitleButtonPremium, .fatMealDropdown, .fatSearchClosePremium")).toHaveCount(0);

    await mealButton.click();
    const mealMenu = page.getByTestId("food-search-meal-menu");
    const mealOptions = page.locator("[data-food-search-meal]");
    const collapseButton = page.locator('[data-food-search-header-action="collapse-meal"]');
    await expect(mealMenu).toBeVisible();
    await expect(mealMenu).toHaveCSS("position", "fixed");
    await expect(mealMenu).toHaveCSS("width", `${Math.min(370, viewport.width - 32)}px`);
    await expect(mealOptions).toHaveCount(4);
    await expect(mealOptions.first()).toHaveCSS("height", "52px");
    await expect(collapseButton).toHaveCSS("height", "44px");
    await collapseButton.click();
    await expect(mealMenu).toBeHidden();

    await page.locator('[data-food-search-action="my-products"]').click();
    await expect(header).toHaveAttribute("data-food-search-header-variant", "my-products");
    await expect(header).toHaveCSS("height", "132px");
    await expect(header).toHaveCSS("margin-top", "0px");
    await expect(header.locator("h1")).toHaveCSS("font-size", "16px");
    await expect(page.getByTestId("food-search-meal-selector")).toBeVisible();
    await expect(page.locator('[data-food-search-header-action="toggle-meal"]')).toHaveCSS("height", "60px");
    await expect(page.locator('[data-food-search-header-action="close"]')).toHaveCSS("width", "44px");
    await expectNoHorizontalOverflow(page);

    if (viewport.width === 390 || viewport.width === 1440) {
      await attachScreenshot(page, testInfo, `client-food-search-header-${viewport.width}.png`);
    }
  }

  assertNoRuntimeErrors();
});

test("CSS V2 food search page keeps stable scoped recent and photo-action layouts", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "One deterministic browser covers the viewport matrix.");

  const assertNoRuntimeErrors = failOnRuntimeErrors(page);
  const viewports = [
    { width: 360, height: 800 },
    { width: 390, height: 844 },
    { width: 430, height: 932 },
    { width: 768, height: 1024 },
    { width: 1440, height: 900 }
  ];

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto("/cssV2?clientHarness=1");
    await expect(page.getByTestId("client-nav-nutrition")).toBeVisible({ timeout: 40_000 });
    await page.getByTestId("client-nav-nutrition").click();
    await page.locator("[data-nutrition-header-action]").first().click();

    const landing = page.getByTestId("food-search-modern-landing");
    const grid = page.getByTestId("food-search-recent-grid");
    const recentItems = page.locator("[data-food-search-recent-card]");
    const recentItem = recentItems.first();
    const photoAction = page.getByTestId("food-search-photo-action");
    const expectedCardHeight = viewport.width <= 380 ? "82px" : "88px";
    const expectedPhotoWidth = `${Math.min(370, viewport.width - 32)}px`;

    await expect(landing).toBeVisible();
    await expect(landing).toHaveAttribute("data-css-module-scope", "food-search-page");
    await expect(landing).toHaveCSS("display", "flex");
    await expect(grid).toHaveCSS("display", "grid");
    await expect(grid).toHaveCSS("gap", "8px");
    await expect(recentItems).toHaveCount(6);
    await expect(recentItem).toHaveCSS("height", expectedCardHeight);
    await expect(recentItem).toHaveCSS("border-radius", "18px");
    await expect(recentItem).toHaveCSS("border-color", "rgb(235, 230, 239)");
    await expect(recentItem.locator("strong")).toHaveCSS("font-size", "11px");

    await expect(photoAction).toBeVisible();
    await expect(photoAction).toHaveAttribute("data-css-module-scope", "food-search-page");
    await expect(photoAction).toHaveCSS("position", "fixed");
    await expect(photoAction).toHaveCSS("width", expectedPhotoWidth);
    await expect(photoAction).toHaveCSS("height", "72px");
    await expect(photoAction).toHaveCSS("bottom", "104px");
    await expect(photoAction).toHaveCSS("grid-template-columns", viewport.width <= 360 ? "44px 218px 18px" : viewport.width <= 390 ? "44px 248px 18px" : "44px 260px 18px");
    await expect(photoAction.locator("strong")).toHaveCSS("color", "rgb(40, 38, 46)");
    await expect(photoAction.locator("small")).toHaveCSS("color", "rgb(123, 118, 130)");
    await expect(photoAction.locator("em")).toHaveCSS("color", "rgb(169, 174, 178)");
    await expect(page.getByTestId("food-search-photo-input")).toBeHidden();
    await expect(page.locator(".foodSearchModernLanding, .foodSearchModernSectionHeader, .foodSearchRecentGrid, .foodSearchRecentCard, .foodSearchFixedPhotoAction, .foodSearchModernActionIcon, .fatPhotoAiInput")).toHaveCount(0);
    await expectTapTargets(page, ["[data-food-search-recent-card]", '[data-testid="food-search-photo-action"]']);
    await expectAboveBottomBar(page, '[data-testid="food-search-photo-action"]');
    await expectNoHorizontalOverflow(page);

    const searchInputBox = await page.getByTestId("food-search-input").boundingBox();
    const landingBox = await landing.boundingBox();
    expect(searchInputBox).not.toBeNull();
    expect(landingBox).not.toBeNull();
    expect(Math.abs(landingBox.y - searchInputBox.y - searchInputBox.height - 16)).toBeLessThanOrEqual(0.5);

    if (viewport.width === 390 || viewport.width === 1440) {
      await attachScreenshot(page, testInfo, `client-food-search-page-${viewport.width}.png`);
    }
  }

  assertNoRuntimeErrors();
});

test("my-products food list keeps a dedicated vertical scroll surface", async ({ page }) => {
  const assertNoRuntimeErrors = failOnRuntimeErrors(page);

  await page.setViewportSize({ width: 390, height: 420 });
  await page.goto("/cssV2?clientHarness=1");
  await expect(page.getByTestId("client-nav-nutrition")).toBeVisible({ timeout: 40_000 });
  await page.getByTestId("client-nav-nutrition").click();
  await page.locator("[data-nutrition-header-action]").first().click();
  await page.locator('[data-food-search-action="my-products"]').click();

  const screen = page.getByTestId("food-search-screen");
  await expect(screen).toHaveAttribute("data-food-search-header-layout", "my-products");
  await expect(screen).toHaveCSS("overflow-y", "auto");
  await expect(screen).toHaveCSS("touch-action", "pan-y");

  const scrollMetrics = await screen.evaluate((node) => {
    const before = node.scrollTop;
    node.scrollTop = node.scrollHeight;
    return {
      before,
      after: node.scrollTop,
      clientHeight: node.clientHeight,
      scrollHeight: node.scrollHeight
    };
  });

  expect(scrollMetrics.scrollHeight).toBeGreaterThan(scrollMetrics.clientHeight);
  expect(scrollMetrics.after).toBeGreaterThan(scrollMetrics.before);
  assertNoRuntimeErrors();
});

test("CSS V2 food search results keep stable scoped search and my-products cards", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "One deterministic browser covers the viewport matrix.");

  const assertNoRuntimeErrors = failOnRuntimeErrors(page);
  const viewports = [
    { width: 360, height: 800 },
    { width: 390, height: 844 },
    { width: 430, height: 932 },
    { width: 768, height: 1024 },
    { width: 1440, height: 900 }
  ];

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto("/cssV2?clientHarness=1");
    await expect(page.getByTestId("client-nav-nutrition")).toBeVisible({ timeout: 40_000 });
    await page.getByTestId("client-nav-nutrition").click();
    await page.locator("[data-nutrition-header-action]").first().click();
    await page.getByTestId("food-search-input").locator("input").fill("yogurt");

    const list = page.getByTestId("food-search-results");
    const items = page.locator("[data-food-search-result-card]");
    const item = items.first();
    const icon = item.locator(":scope > span:first-child");
    const title = item.locator(":scope > div > strong");
    const meta = item.locator(":scope > div > span");
    const portion = item.locator("em");
    const details = item.locator("small");
    const action = item.locator("[data-food-search-result-action]");
    const expectedColumns = viewport.width === 360
      ? "44px 210px 32px"
      : viewport.width === 390
        ? "44px 240px 32px"
        : "44px 252px 32px";

    await expect(list).toBeVisible();
    await expect(list).toHaveAttribute("data-css-module-scope", "food-search-results");
    await expect(list).toHaveCSS("display", "grid");
    await expect(list).toHaveCSS("gap", "8px");
    await expect(list).toHaveCSS("padding-bottom", "188px");
    await expect(items).toHaveCount(2);
    await expect(item).toHaveCSS("height", "70px");
    await expect(item).toHaveCSS("min-height", "70px");
    await expect(item).toHaveCSS("grid-template-columns", expectedColumns);
    await expect(item).toHaveCSS("gap", "10px");
    await expect(item).toHaveCSS("padding", "9px 10px");
    await expect(item).toHaveCSS("border-radius", "18px");
    await expect(item).toHaveCSS("border-color", "rgb(235, 230, 239)");
    await expect(item).toHaveCSS("background-color", "rgb(255, 255, 255)");
    await expect(icon).toHaveCSS("width", "44px");
    await expect(icon).toHaveCSS("height", "44px");
    await expect(icon).toHaveCSS("border-radius", "14px");
    await expect(icon).toHaveCSS("background-color", "rgb(237, 241, 243)");
    await expect(title).toHaveCSS("font-size", "15px");
    await expect(title).toHaveCSS("font-weight", "650");
    await expect(meta).toHaveCSS("gap", "10px");
    await expect(portion).toHaveCSS("font-size", "12px");
    await expect(details).toHaveCSS("font-size", viewport.width <= 390 ? "10.5px" : "11px");
    await expect(action).toHaveCSS("width", "32px");
    await expect(action).toHaveCSS("height", "32px");
    await expect(action).toHaveCSS("border-radius", "50%");
    await expect(page.locator(".fatSearchListPremium, .fatSearchResultCard, .fatSearchResultIcon, .fatSearchResultInfo, .fatSearchResultCheck")).toHaveCount(0);
    await expectTapTargets(page, ["[data-food-search-result-card]"]);
    await expectNoHorizontalOverflow(page);

    if (viewport.width === 390 || viewport.width === 1440) {
      await attachScreenshot(page, testInfo, `client-food-search-results-${viewport.width}.png`);
    }

    await page.locator('[data-food-search-action="my-products"]').click();
    await expect(items).toHaveCount(1);
    await expect(list).toHaveAttribute("data-css-module-scope", "food-search-results");
    await expect(list).toHaveCSS("padding-bottom", "188px");
    await expect(item).toHaveCSS("height", "70px");
    await expect(item).toHaveCSS("grid-template-columns", /44px .+ 32px/);
    await expectTapTargets(page, ["[data-food-search-result-card]"]);
    await expectNoHorizontalOverflow(page);
  }

  await page.evaluate(() => {
    document.documentElement.dataset.appTheme = "dark-green";
  });
  const darkItem = page.locator("[data-food-search-result-card]").first();
  await expect(darkItem).toHaveCSS("background-color", "rgb(23, 26, 23)");
  await expect(darkItem).toHaveCSS("border-color", "rgb(43, 48, 43)");
  await expect(darkItem.locator(":scope > div > strong")).toHaveCSS("color", "rgb(244, 246, 242)");
  await expect(darkItem.locator(":scope > span:first-child")).toHaveCSS("background-color", "rgb(34, 39, 34)");
  await expectNoHorizontalOverflow(page);

  assertNoRuntimeErrors();
});

test("CSS V2 food search input keeps stable scoped geometry", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "One deterministic browser covers the viewport matrix.");

  const assertNoRuntimeErrors = failOnRuntimeErrors(page);
  const viewports = [
    { width: 360, height: 800 },
    { width: 390, height: 844 },
    { width: 430, height: 932 },
    { width: 768, height: 1024 },
    { width: 1440, height: 900 }
  ];

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto("/cssV2?clientHarness=1");
    await expect(page.getByTestId("client-nav-nutrition")).toBeVisible({ timeout: 40_000 });
    await page.getByTestId("client-nav-nutrition").click();
    await page.locator("[data-nutrition-header-action]").first().click();

    const searchInput = page.getByTestId("food-search-input");
    const input = searchInput.locator("input");
    await expect(searchInput).toBeVisible();
    await expect(searchInput).toHaveAttribute("data-css-module-scope", "food-search-input");
    await expect(page.locator(".fatSearchInputWrapPremium")).toHaveCount(0);
    await expect(searchInput).toHaveCSS("display", "grid");
    await expect(searchInput).toHaveCSS("min-height", "50px");
    await expect(searchInput).toHaveCSS("border-radius", "16px");
    await expect(input).toHaveCSS("min-height", "48px");
    await expect(input).toHaveCSS("color", "rgb(40, 38, 46)");

    const searchBox = await searchInput.boundingBox();
    expect(searchBox).not.toBeNull();
    expect(searchBox.height).toBeCloseTo(50, 1);
    expect(searchBox.x).toBeGreaterThanOrEqual(0);
    expect(searchBox.x + searchBox.width).toBeLessThanOrEqual(viewport.width + 1);

    await input.fill("yogurt");
    const clearButton = page.getByLabel("Сбросить поиск");
    await expect(clearButton).toBeVisible();
    const clearBox = await clearButton.boundingBox();
    expect(clearBox).not.toBeNull();
    expect(clearBox.width).toBeCloseTo(32, 1);
    expect(clearBox.height).toBeCloseTo(32, 1);
    await clearButton.click();
    await expect(input).toHaveValue("");

    await page.locator('[data-food-search-action="my-products"]').click();
    await expect(searchInput).toHaveCSS("display", "grid");
    await expect(searchInput).toHaveCSS("min-height", "50px");
    await expect(searchInput).toHaveCSS("border-radius", "16px");
    await expect(input).toHaveCSS("min-height", "48px");
    await expect(input).toHaveCSS("color", "rgb(40, 38, 46)");

    const myProductsBox = await searchInput.boundingBox();
    expect(myProductsBox).not.toBeNull();
    expect(myProductsBox.height).toBeCloseTo(50, 1);
    expect(myProductsBox.x).toBeGreaterThanOrEqual(0);
    expect(myProductsBox.x + myProductsBox.width).toBeLessThanOrEqual(viewport.width + 1);
    await expectNoHorizontalOverflow(page);

    if (viewport.width === 390 || viewport.width === 1440) {
      await attachScreenshot(page, testInfo, `client-food-search-input-${viewport.width}.png`);
    }
  }

  assertNoRuntimeErrors();
});

test("CSS V2 food search bottom bar keeps stable scoped navigation", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "One deterministic browser covers the viewport matrix.");

  const assertNoRuntimeErrors = failOnRuntimeErrors(page);
  const viewports = [
    { width: 360, height: 800 },
    { width: 390, height: 844 },
    { width: 430, height: 932 },
    { width: 768, height: 1024 },
    { width: 1440, height: 900 }
  ];

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto("/cssV2?clientHarness=1");
    await expect(page.getByTestId("client-nav-nutrition")).toBeVisible({ timeout: 40_000 });
    await page.getByTestId("client-nav-nutrition").click();
    await page.locator("[data-nutrition-header-action]").first().click();

    const bottomBar = page.getByTestId("food-search-bottom-bar");
    const buttons = bottomBar.locator("button");
    await expect(bottomBar).toBeVisible();
    await expect(bottomBar).toHaveAttribute("data-css-module-scope", "food-search-bottom-bar");
    await expect(page.locator(".fatSearchBottomBar, .fatSearchBackAction, .fatSearchSearchAction, .fatSearchCreateAction, .fatSearchMyProductsAction")).toHaveCount(0);
    await expect(bottomBar).toHaveCSS("position", "fixed");
    await expect(bottomBar).toHaveCSS("height", "76px");
    await expect(bottomBar).toHaveCSS("padding", "6px");
    await expect(bottomBar).toHaveCSS("border-radius", "28px");
    await expect(buttons).toHaveCount(4);
    await expect(bottomBar.locator('button[aria-pressed="true"]')).toHaveCount(1);
    await expect(page.locator('[data-food-search-action="search"]')).toHaveAttribute("aria-pressed", "true");

    for (const button of await buttons.all()) {
      await expect(button).toHaveCSS("display", "grid");
      await expect(button).toHaveCSS("height", "58px");
      await expect(button).toHaveCSS("grid-template-rows", "28px 14px");
      await expect(button.locator("svg")).toHaveCount(1);
      await expect(button.locator("svg")).toHaveCSS("width", "24px");
      await expect(button.locator("svg")).toHaveCSS("height", "24px");
      await expect(button.locator("svg")).toHaveCSS("stroke-width", "2px");
      await expect(button.locator("strong")).toHaveCSS("text-transform", "none");
      const buttonBox = await button.boundingBox();
      expect(buttonBox).not.toBeNull();
      expect(buttonBox.height).toBeCloseTo(58, 1);
    }

    const bottomBarBox = await bottomBar.boundingBox();
    expect(bottomBarBox).not.toBeNull();
    expect(bottomBarBox.x).toBeGreaterThanOrEqual(0);
    expect(bottomBarBox.x + bottomBarBox.width).toBeLessThanOrEqual(viewport.width + 1);
    expect(bottomBarBox.width).toBeCloseTo(Math.min(382, viewport.width - 20), 1);
    expect(viewport.height - bottomBarBox.y - bottomBarBox.height)
      .toBeCloseTo(Math.max(0, viewport.height - 874) + 14, 1);
    await expectNoHorizontalOverflow(page);

    if (viewport.width === 390 || viewport.width === 1440) {
      await attachScreenshot(page, testInfo, `client-food-search-bottom-bar-${viewport.width}.png`);
    }

    await page.locator('[data-food-search-action="my-products"]').click();
    await expect(page.locator('[data-food-search-action="my-products"]')).toHaveAttribute("aria-pressed", "true");
    await expect(bottomBar.locator('button[aria-pressed="true"]')).toHaveCount(1);

    await page.locator('[data-food-search-action="create"]').click();
    await expect(page.locator('[data-food-search-action="create"]')).toHaveAttribute("aria-pressed", "true");
    await expect(bottomBar.locator('button[aria-pressed="true"]')).toHaveCount(1);
    await expect(page.getByTestId("nutrition-create-choice")).toBeVisible();

    const createChoiceBar = page.getByTestId("nutrition-create-choice").locator('[role="dialog"]');
    await expect(createChoiceBar).toHaveCSS("height", "76px");
    await expect(createChoiceBar).toHaveCSS("padding", "6px");
    await expect(createChoiceBar).toHaveCSS("border-radius", "28px");
    await expect(createChoiceBar).toHaveCSS("background-color", "rgba(255, 255, 255, 0.96)");
    const createChoiceButtons = createChoiceBar.locator("button");
    await expect(createChoiceButtons).toHaveCount(2);
    for (const button of await createChoiceButtons.all()) {
      await expect(button).toHaveCSS("height", "58px");
      await expect(button).toHaveCSS("border-radius", "20px");
    }

    const createChoiceBox = await createChoiceBar.boundingBox();
    expect(createChoiceBox).not.toBeNull();
    expect(createChoiceBox.x).toBeCloseTo(bottomBarBox.x, 1);
    expect(createChoiceBox.y).toBeCloseTo(bottomBarBox.y, 1);
    expect(createChoiceBox.width).toBeCloseTo(bottomBarBox.width, 1);
    expect(createChoiceBox.height).toBeCloseTo(bottomBarBox.height, 1);
  }

  assertNoRuntimeErrors();
});

test("CSS V2 food product action bar keeps stable scoped actions", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "One deterministic browser covers the viewport matrix.");

  const assertNoRuntimeErrors = failOnRuntimeErrors(page);
  const viewports = [
    { width: 360, height: 800 },
    { width: 390, height: 844 },
    { width: 430, height: 932 },
    { width: 768, height: 1024 },
    { width: 1440, height: 900 }
  ];

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto("/cssV2?clientHarness=1");
    await expect(page.getByTestId("client-nav-nutrition")).toBeVisible({ timeout: 40_000 });
    await page.getByTestId("client-nav-nutrition").click();
    await page.locator("[data-nutrition-header-action]").first().click();
    await page.getByTestId("food-search-input").locator("input").fill("yogurt");
    await page.locator("[data-food-search-result-card]").first().click();

    const productHeader = page.getByTestId("food-product-flow-header");
    const productTitle = page.locator("[data-food-product-header-title]");
    const mealSelector = page.getByTestId("food-product-meal-selector");
    const mealButton = page.locator('[data-food-product-header-action="toggle-meal"]');
    const productHero = page.getByTestId("food-product-hero");
    const topActions = page.getByTestId("food-product-top-actions");
    const topActionButtons = page.locator("[data-food-product-top-action]");
    const closeAction = page.locator('[data-food-product-top-action="close"]');
    const editAction = page.locator('[data-food-product-top-action="edit"]');
    const portionSelector = page.getByTestId("food-portion-selector");
    const gramsButton = page.locator('[data-food-portion-action="grams"]');
    const portionMenuButton = page.locator('[data-food-portion-action="toggle-menu"]');
    const amountCard = page.getByTestId("food-product-amount");
    const amountInput = page.locator("[data-food-amount-input]");
    const macros = page.getByTestId("food-product-macros");
    const macroCards = macros.locator(":scope > div");
    const noteCard = page.getByTestId("food-product-note-card");
    const noteIcon = page.locator('[data-food-product-note-part="icon"]');
    const noteLabel = page.locator('[data-food-product-note-part="label"]');
    const actionBar = page.getByTestId("food-product-action-bar");
    const buttons = actionBar.locator("button");
    const backButton = page.locator('[data-food-product-action="back"]');
    const addButton = page.locator('[data-food-product-action="add"]');
    await expect(productHeader).toBeVisible();
    await expect(productHeader).toHaveAttribute("data-css-module-scope", "food-product-header");
    await expect(productHeader).toHaveAttribute("data-client-page-header", "true");
    await expect(productHeader).toHaveAttribute("data-client-page-header-controls", "workout");
    await expect(productHeader).toHaveCSS("position", "fixed");
    await expect(productHeader).toHaveCSS("height", "132px");
    await expect(productHeader).toHaveCSS("display", "block");
    await expect(productTitle).toHaveCSS("font-size", "16px");
    await expect(mealSelector).toBeVisible();
    await expect(mealSelector).toHaveCSS("height", "60px");
    await expect(mealButton).toHaveCSS("height", "33px");
    await expect(mealButton).toHaveAttribute("aria-expanded", "false");
    await expect(productHero).toBeVisible();
    await expect(productHero).toHaveAttribute("data-css-module-scope", "food-product-header");
    await expect(productHero).toHaveCSS("height", "116px");
    await expect(productHero).toHaveCSS("padding", "14px");
    await expect(productHero.locator('[data-food-product-hero-part="icon-stack"]')).toHaveCSS("width", "72px");
    await expect(productHero.locator('[data-food-product-hero-part="icon"]')).toHaveCSS("width", "46px");
    await expect(productHero.locator("strong")).toHaveCSS("font-size", "20px");
    await expect(page.locator(".foodProductFlowHeader, .foodProductFlowTitle, .foodEditInlineMealHeader, .foodEditInlineMealButton, .foodEditMealPickerDropdown, .foodEditHeroRender, .foodEditIconSourceStack, .foodEditIconRender")).toHaveCount(0);
    await expect(topActions).toBeVisible();
    await expect(topActions).toHaveAttribute("data-css-module-scope", "food-product-top-actions");
    await expect(topActions).toHaveCSS("position", "static");
    await expect(topActions).toHaveCSS("width", "96px");
    await expect(topActions).toHaveCSS("height", "44px");
    await expect(topActionButtons).toHaveCount(2);
    await expect(topActionButtons.nth(0)).toHaveAttribute("data-food-product-top-action", "edit");
    await expect(topActionButtons.nth(1)).toHaveAttribute("data-food-product-top-action", "close");
    await expect(editAction.locator("svg")).toHaveCount(1);
    await expect(closeAction.locator("svg")).toHaveCount(1);
    await expect(closeAction).toHaveCSS("width", "44px");
    await expect(closeAction).toHaveCSS("height", "44px");
    await expect(editAction).toHaveCSS("width", "44px");
    await expect(editAction).toHaveCSS("height", "44px");
    await expect(editAction).toHaveCSS("border-radius", "50%");
    await expect(editAction).toHaveCSS("background-color", "rgba(123, 118, 130, 0.1)");
    await expect(editAction).toHaveCSS("color", "rgb(40, 38, 46)");
    await expect(closeAction).toHaveCSS("border-radius", "50%");
    await expect(closeAction).toHaveCSS("background-color", "rgba(123, 118, 130, 0.1)");
    await expect(closeAction).toHaveCSS("color", "rgb(40, 38, 46)");
    await expect(closeAction).toBeEnabled();
    await expect(editAction).toBeEnabled();
    await expect(page.locator(".foodProductTopActions, .foodProductTopAction, .foodProductTopDelete, .foodProductTopEdit")).toHaveCount(0);

    const headerBox = await productHeader.boundingBox();
    const topActionsBox = await topActions.boundingBox();
    const closeActionBox = await closeAction.boundingBox();
    const mealSelectorBox = await mealSelector.boundingBox();
    expect(headerBox).not.toBeNull();
    expect(topActionsBox).not.toBeNull();
    expect(closeActionBox).not.toBeNull();
    expect(mealSelectorBox).not.toBeNull();
    expect(Math.abs(headerBox.x + headerBox.width - topActionsBox.x - topActionsBox.width - 16)).toBeLessThanOrEqual(1);
    expect(Math.abs(headerBox.x + headerBox.width - closeActionBox.x - closeActionBox.width - 16)).toBeLessThanOrEqual(1);
    expect(viewport.width - closeActionBox.x - closeActionBox.width)
      .toBeCloseTo(Math.max(16, (viewport.width - 402) / 2 + 16), 1);
    const productTitleBox = await productTitle.boundingBox();
    expect(productTitleBox).not.toBeNull();
    expect(Math.abs(
      closeActionBox.y + closeActionBox.height / 2 -
      (productTitleBox.y + productTitleBox.height / 2)
    )).toBeLessThanOrEqual(1);
    expect(mealSelectorBox.width).toBeCloseTo(headerBox.width - 32, 0);

    await mealButton.click();
    const mealMenu = page.getByTestId("food-product-meal-menu");
    await expect(mealMenu).toBeVisible();
    await expect(mealMenu.locator("button")).toHaveCount(4);
    await expect(page.locator('[data-food-product-meal="breakfast"]')).toHaveAttribute("aria-pressed", "true");
    await page.locator('[data-food-product-meal="lunch"]').click();
    await expect(mealMenu).toBeHidden();
    await expect(mealButton).toHaveAttribute("aria-expanded", "false");
    await expectNoHorizontalOverflow(page);

    await expect(portionSelector).toBeVisible();
    await expect(portionSelector).toHaveAttribute("data-css-module-scope", "food-portion-selector");
    await expect(page.locator(".foodEditSegmentRow, .weightModeButton, .foodEditPortionDropdown, .foodEditPortionDropdownButton, .foodEditPortionDropdownMenu")).toHaveCount(0);
    await expect(portionSelector).toHaveCSS("display", "grid");
    await expect(portionSelector).toHaveCSS("grid-template-columns", /.+ .+/);
    await expect(gramsButton).toHaveCSS("height", "44px");
    await expect(portionMenuButton).toHaveCSS("height", "44px");
    await expect(gramsButton).toHaveAttribute("aria-pressed", "true");
    await expect(portionMenuButton).toHaveAttribute("aria-pressed", "false");
    await expect(gramsButton).toHaveCSS("background-color", "rgb(255, 255, 255)");
    await expect(portionMenuButton).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    await expect(amountCard).toBeVisible();
    await expect(amountCard).toHaveAttribute("data-css-module-scope", "food-product-nutrition");
    await expect(amountCard).toHaveAttribute("data-amount-mode", "weight");
    await expect(page.locator(".foodEditAmountCard, .foodProductAmountControls, .foodProductAmountStep, .foodProductAmountInputWrap, .foodEditMacrosCards, .foodEditRowsCard, .foodEditRow")).toHaveCount(0);
    await expect(amountCard).toHaveCSS("min-height", "76px");
    await expect(amountCard).toHaveCSS("padding", "12px 14px");
    await expect(amountInput).toHaveCSS("font-size", "22px");
    await expect(macros).toHaveCSS("display", "grid");
    await expect(macros).toHaveCSS("grid-template-columns", /.+ .+ .+ .+/);
    await expect(macroCards).toHaveCount(4);
    await expect(macroCards.first()).toHaveCSS("min-height", "74px");
    await expect(noteCard).toHaveCSS("height", "70px");
    await expect(noteCard.locator("button")).toHaveCSS("height", "70px");
    await expect(noteIcon).toHaveCSS("width", "34px");
    const noteIconBox = await noteIcon.boundingBox();
    const noteLabelBox = await noteLabel.boundingBox();
    expect(noteIconBox).not.toBeNull();
    expect(noteLabelBox).not.toBeNull();
    expect(noteLabelBox.x - noteIconBox.x - noteIconBox.width).toBeGreaterThanOrEqual(8);
    await expect(actionBar).toBeVisible();
    await expect(actionBar).toHaveAttribute("data-css-module-scope", "food-product-action-bar");
    await expect(actionBar).toHaveCSS("position", "fixed");
    await expect(actionBar).toHaveCSS("height", "76px");
    await expect(actionBar).toHaveCSS("padding", "6px");
    await expect(actionBar).toHaveCSS("border-radius", "28px");
    await expect(buttons).toHaveCount(2);
    await expect(backButton).toHaveCSS("height", "58px");
    await expect(backButton).toHaveCSS("color", "rgb(123, 118, 130)");
    await expect(addButton).toHaveCSS("height", "58px");
    await expect(addButton).toHaveCSS("background-color", "rgb(143, 122, 200)");
    await expect(addButton).toHaveCSS("color", "rgb(255, 255, 255)");

    const backBox = await backButton.boundingBox();
    const addBox = await addButton.boundingBox();
    const actionBarBox = await actionBar.boundingBox();
    expect(backBox).not.toBeNull();
    expect(addBox).not.toBeNull();
    expect(actionBarBox).not.toBeNull();
    expect(addBox.width / backBox.width).toBeCloseTo(2, 1);
    expect(actionBarBox.x).toBeGreaterThanOrEqual(0);
    expect(actionBarBox.x + actionBarBox.width).toBeLessThanOrEqual(viewport.width + 1);
    expect(actionBarBox.width).toBeCloseTo(Math.min(382, viewport.width - 20), 1);
    expect(viewport.height - actionBarBox.y - actionBarBox.height)
      .toBeCloseTo(Math.max(0, viewport.height - 874) + 14, 1);
    await expectNoHorizontalOverflow(page);

    await portionMenuButton.click();
    const portionMenu = page.getByTestId("food-portion-menu");
    await expect(portionMenu).toBeVisible();
    await expect(portionMenu.locator("button")).toHaveCount(1);
    await expectNoHorizontalOverflow(page);
    await portionMenu.locator("button").click();
    await expect(portionMenu).toBeHidden();
    await expect(amountCard).toHaveAttribute("data-amount-mode", "portion");
    await expect(gramsButton).toHaveAttribute("aria-pressed", "false");
    await expect(portionMenuButton).toHaveAttribute("aria-pressed", "true");
    await expect(gramsButton).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    await expect(portionMenuButton).toHaveCSS("background-color", "rgb(255, 255, 255)");
    const stepButtons = page.locator("[data-food-amount-action]");
    await expect(stepButtons).toHaveCount(2);
    const amountBeforeIncrease = Number(await amountInput.inputValue());
    await page.locator('[data-food-amount-action="increase"]').click();
    expect(Number(await amountInput.inputValue())).toBeGreaterThan(amountBeforeIncrease);
    await page.locator('[data-food-amount-action="decrease"]').click();
    await expectNoHorizontalOverflow(page);

    if (viewport.width === 390 || viewport.width === 1440) {
      await attachScreenshot(page, testInfo, `client-food-product-action-bar-${viewport.width}.png`);
    }

    await closeAction.click();
    await expect(page.getByTestId("food-product-page")).toBeHidden();
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/cssV2?clientHarness=1&clientHarnessTheme=dark-green");
  await expect(page.getByTestId("client-nav-nutrition")).toBeVisible({ timeout: 40_000 });
  await page.getByTestId("client-nav-nutrition").click();
  await page.locator("[data-nutrition-header-action]").first().click();
  await page.getByTestId("food-search-input").locator("input").fill("yogurt");
  await page.locator("[data-food-search-result-card]").first().click();
  const darkTopActions = page.getByTestId("food-product-top-actions");
  await expect(darkTopActions).toHaveAttribute("data-css-module-scope", "food-product-top-actions");
  await expect(darkTopActions).toHaveCSS("position", "static");
  await expect(darkTopActions).toHaveCSS("height", "30px");
  await expect(page.locator('[data-food-product-top-action="close"]')).toHaveCSS("height", "30px");
  await expect(page.locator('[data-food-product-top-action="edit"]')).toHaveCSS("height", "30px");
  await expectNoHorizontalOverflow(page);

  assertNoRuntimeErrors();
});

test("CSS V2 nutrition search history keeps stable scoped rows", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "One deterministic browser covers the viewport matrix.");

  const assertNoRuntimeErrors = failOnRuntimeErrors(page);
  const viewports = [
    { width: 360, height: 800 },
    { width: 390, height: 844 },
    { width: 430, height: 932 },
    { width: 768, height: 1024 },
    { width: 1440, height: 900 }
  ];

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto("/cssV2?clientHarness=1&clientHarnessPage=nutritionSearchHistory");

    const history = page.getByTestId("food-search-history-names");
    const title = history.locator("div").first();
    const rows = history.locator("button");
    await expect(history).toBeVisible();
    await expect(history).toHaveAttribute("data-css-module-scope", "food-search-history-names");
    await expect(page.locator(".fatSearchHistoryNames, .fatSearchHistoryNameButton")).toHaveCount(0);
    await expect(history).toHaveCSS("padding", "14px");
    await expect(history).toHaveCSS("border-radius", "20px");
    await expect(history).toHaveCSS("background-color", "rgb(255, 255, 255)");
    await expect(title).toHaveCSS("font-size", "15px");
    await expect(rows).toHaveCount(3);

    for (const [index, row] of (await rows.all()).entries()) {
      await expect(row).toHaveCSS("display", "flex");
      await expect(row).toHaveCSS("min-height", "48px");
      await expect(row).toHaveCSS("border-radius", index === 0 ? "12px" : "0px");
      const rowBox = await row.boundingBox();
      expect(rowBox).not.toBeNull();
      expect(rowBox.height).toBeCloseTo(48, 1);
      expect(rowBox.x).toBeGreaterThanOrEqual(0);
      expect(rowBox.x + rowBox.width).toBeLessThanOrEqual(viewport.width + 1);
    }

    await rows.first().click();
    await expect(page.getByTestId("food-search-history-selection")).toHaveText("Harness Greek Yogurt");
    await expectNoHorizontalOverflow(page);

    if (viewport.width === 390 || viewport.width === 1440) {
      await attachScreenshot(page, testInfo, `client-food-search-history-${viewport.width}.png`);
    }
  }

  assertNoRuntimeErrors();
});

test("CSS V2 dish ingredients stay scoped and responsive", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "One deterministic browser covers the viewport matrix.");

  const assertNoRuntimeErrors = failOnRuntimeErrors(page);
  const viewports = [
    { width: 360, height: 800 },
    { width: 390, height: 844 },
    { width: 430, height: 932 },
    { width: 768, height: 1024 },
    { width: 1440, height: 900 }
  ];

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto("/cssV2?clientHarness=1&clientHarnessPage=nutritionDishIngredients");

    const ingredients = page.getByTestId("dish-edit-ingredients");
    const addButton = page.locator('[data-dish-ingredients-action="add"]');
    const removeButtons = page.locator('[data-dish-ingredients-action="remove"]');
    await expect(ingredients).toBeVisible();
    await expect(ingredients).toHaveAttribute("data-css-module-scope", "dish-edit-ingredients");
    await expect(page.locator(".dishEditIngredientsBox, .dishEditIngredientsHeader, .dishEditIngredientsList, .dishEditIngredientRow")).toHaveCount(0);
    await expect(ingredients).toHaveCSS("padding", "12px");
    await expect(ingredients).toHaveCSS("border-radius", "20px");
    await expect(ingredients).toHaveCSS("background-color", "rgb(255, 255, 255)");
    await expect(addButton).toHaveCSS("min-height", "44px");
    await expect(removeButtons).toHaveCount(2);

    const ingredientBox = await ingredients.boundingBox();
    expect(ingredientBox).not.toBeNull();
    expect(ingredientBox.x).toBeGreaterThanOrEqual(0);
    expect(ingredientBox.x + ingredientBox.width).toBeLessThanOrEqual(viewport.width + 1);
    await expectNoHorizontalOverflow(page);

    if (viewport.width === 390 || viewport.width === 1440) {
      await attachScreenshot(page, testInfo, `client-dish-edit-ingredients-${viewport.width}.png`);
    }

    await page.getByRole("button", { name: "Удалить Куриная грудка" }).click();
    await page.getByRole("button", { name: "Удалить Рис басмати" }).click();
    await expect(page.getByTestId("dish-edit-ingredients-empty")).toBeVisible();
    await addButton.click();
    await expect(page.getByRole("button", { name: "Удалить Авокадо" })).toBeVisible();
  }

  assertNoRuntimeErrors();
});

test("CSS V2 food edit basic fields stay scoped and match the responsive reference", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "One deterministic browser covers the viewport matrix.");

  const assertNoRuntimeErrors = failOnRuntimeErrors(page);
  const cases = [
    { name: "warm-360", width: 360, height: 800, theme: "warm-light", fieldWidth: 328, fieldHeight: 70.2, iconHeight: 92.2, gridHeight: 92.2, macroWidth: 76.75, portionHeight: 89.2, presetDisplay: "none", toggleHeight: 50 },
    { name: "warm-390", width: 390, height: 844, theme: "warm-light", fieldWidth: 358, fieldHeight: 70.2, iconHeight: 92.2, gridHeight: 92.2, macroWidth: 84.25, portionHeight: 89.2, presetDisplay: "none", toggleHeight: 50 },
    { name: "warm-430", width: 430, height: 932, theme: "warm-light", fieldWidth: 370, fieldHeight: 70.2, iconHeight: 92.2, gridHeight: 92.2, macroWidth: 87.25, portionHeight: 89.2, presetDisplay: "none", toggleHeight: 50 },
    { name: "warm-768", width: 768, height: 1024, theme: "warm-light", fieldWidth: 370, fieldHeight: 70.2, iconHeight: 92.2, gridHeight: 191.4, macroWidth: 181.5, portionHeight: 89.2, presetDisplay: "none", toggleHeight: 50 },
    { name: "warm-1440", width: 1440, height: 900, theme: "warm-light", fieldWidth: 370, fieldHeight: 70.2, iconHeight: 92.2, gridHeight: 191.4, macroWidth: 181.5, portionHeight: 89.2, presetDisplay: "none", toggleHeight: 50 },
    { name: "dark-390", width: 390, height: 844, theme: "dark-green", fieldWidth: 316, fieldHeight: 70.39, iconHeight: 96.39, gridHeight: 70.39, macroWidth: 71.5, portionHeight: 80.39, presetDisplay: "flex", toggleHeight: 46 }
  ];

  for (const testCase of cases) {
    await page.setViewportSize({ width: testCase.width, height: testCase.height });
    const themeQuery = testCase.theme === "warm-light"
      ? ""
      : `&clientHarnessTheme=${encodeURIComponent(testCase.theme)}`;
    await page.goto(`/cssV2?clientHarness=1${themeQuery}`);
    await expect(page.getByTestId("client-nav-nutrition")).toBeVisible({ timeout: 40_000 });
    await page.getByTestId("client-nav-nutrition").click();
    await page.locator("[data-nutrition-header-action]").first().click();
    await page.getByTestId("food-search-input").locator("input").fill("Harness");
    await page.locator("[data-food-search-result-card]").first().click();
    await page.locator('[data-food-product-top-action="edit"]').click();

    const root = page.getByTestId("food-edit-basic-fields");
    const name = page.getByTestId("food-edit-basic-name");
    const icon = page.getByTestId("food-edit-basic-icon");
    const presets = page.getByTestId("food-edit-basic-presets");
    const macros = page.getByTestId("food-edit-basic-macros");
    const firstMacro = macros.locator("label").first();
    const portion = page.getByTestId("food-edit-basic-portion");
    const toggle = page.locator('[data-food-edit-basic-action="toggle-unit"]');

    await expect(root).toHaveAttribute("data-css-module-scope", "food-edit-basic-fields");
    await expect(page.locator(".foodEditIconManualBox, .foodEditIconPresetRow, .foodEditPageGrid, .foodEditPortionUnitRow, .foodEditPortionUnitToggle")).toHaveCount(0);
    await expect(presets).toHaveCSS("display", testCase.presetDisplay);

    const nameBox = await name.boundingBox();
    const iconBox = await icon.boundingBox();
    const gridBox = await macros.boundingBox();
    const macroBox = await firstMacro.boundingBox();
    const portionBox = await portion.boundingBox();
    const toggleBox = await toggle.boundingBox();
    expect(nameBox).not.toBeNull();
    expect(iconBox).not.toBeNull();
    expect(gridBox).not.toBeNull();
    expect(macroBox).not.toBeNull();
    expect(portionBox).not.toBeNull();
    expect(toggleBox).not.toBeNull();
    expect(nameBox.width).toBeCloseTo(testCase.fieldWidth, 1);
    expect(nameBox.height).toBeCloseTo(testCase.fieldHeight, 1);
    expect(iconBox.width).toBeCloseTo(testCase.fieldWidth, 1);
    expect(iconBox.height).toBeCloseTo(testCase.iconHeight, 1);
    expect(gridBox.width).toBeCloseTo(testCase.fieldWidth, 1);
    expect(gridBox.height).toBeCloseTo(testCase.gridHeight, 1);
    expect(macroBox.width).toBeCloseTo(testCase.macroWidth, 1);
    expect(portionBox.width).toBeCloseTo(testCase.fieldWidth, 1);
    expect(portionBox.height).toBeCloseTo(testCase.portionHeight, 1);
    expect(toggleBox.height).toBeCloseTo(testCase.toggleHeight, 1);

    const initialUnitState = await toggle.getAttribute("aria-pressed");
    await toggle.click();
    await expect(toggle).not.toHaveAttribute("aria-pressed", initialUnitState);

    await expectNoHorizontalOverflow(page);

    if (testCase.name === "warm-390" || testCase.name === "warm-1440" || testCase.name === "dark-390") {
      await attachScreenshot(page, testInfo, `client-food-edit-basic-fields-${testCase.name}.png`);
    }
  }

  assertNoRuntimeErrors();
});

test("CSS V2 dish ingredient picker stays scoped and matches the responsive reference", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "One deterministic browser covers the viewport matrix.");

  const assertNoRuntimeErrors = failOnRuntimeErrors(page);
  const cases = [
    { name: "warm-360", width: 360, height: 800, theme: "warm-light", sheetWidth: 328, sheetHeight: 720, confirmWidth: 328, confirmHeight: 234.39 },
    { name: "warm-390", width: 390, height: 844, theme: "warm-light", sheetWidth: 358, sheetHeight: 720, confirmWidth: 358, confirmHeight: 234.39 },
    { name: "warm-430", width: 430, height: 932, theme: "warm-light", sheetWidth: 370, sheetHeight: 720, confirmWidth: 370, confirmHeight: 239 },
    { name: "warm-768", width: 768, height: 1024, theme: "warm-light", sheetWidth: 370, sheetHeight: 720, confirmWidth: 370, confirmHeight: 249 },
    { name: "warm-1440", width: 1440, height: 900, theme: "warm-light", sheetWidth: 370, sheetHeight: 720, confirmWidth: 370, confirmHeight: 249 },
    { name: "dark-390", width: 390, height: 844, theme: "dark-green", sheetWidth: 347, sheetHeight: 816, confirmWidth: 339, confirmHeight: 232.39 }
  ];

  for (const testCase of cases) {
    await page.setViewportSize({ width: testCase.width, height: testCase.height });
    const themeQuery = testCase.theme === "warm-light"
      ? ""
      : `&clientHarnessTheme=${encodeURIComponent(testCase.theme)}`;
    await page.goto(`/cssV2?clientHarness=1${themeQuery}`);
    await expect(page.getByTestId("client-nav-nutrition")).toBeVisible({ timeout: 40_000 });
    await page.getByTestId("client-nav-nutrition").click();
    await page.locator("[data-nutrition-header-action]").first().click();
    await page.locator('[data-food-search-action="create"]').click();
    await page.getByTestId("nutrition-create-choice-option").nth(1).click();
    await page.locator('[data-dish-ingredients-action="add"]').click();

    const picker = page.getByTestId("dish-ingredient-picker");
    const pickerSheet = page.getByTestId("dish-ingredient-picker-sheet");
    const searchInput = page.locator('[data-testid="dish-ingredient-search"] input');
    const results = page.locator("[data-dish-ingredient-result]");
    await expect(picker).toHaveAttribute("data-css-module-scope", "dish-ingredient-picker");
    await expect(picker).toHaveCSS("position", "fixed");
    await expect(pickerSheet).toBeVisible();
    await expect(results).not.toHaveCount(0);
    await expect(page.locator(".dishIngredientPickerOverlay, .dishIngredientPickerSheet, .dishIngredientResultCard")).toHaveCount(0);

    const pickerBox = await pickerSheet.boundingBox();
    const resultBox = await results.first().boundingBox();
    expect(pickerBox).not.toBeNull();
    expect(resultBox).not.toBeNull();
    expect(pickerBox.width).toBeCloseTo(testCase.sheetWidth, 1);
    expect(pickerBox.height).toBeCloseTo(testCase.sheetHeight, 1);
    expect(resultBox.height).toBeCloseTo(testCase.theme === "warm-light" ? 64 : 72, 1);
    await expectTapTargets(page, ['[data-dish-ingredient-action="close"]', "[data-dish-ingredient-result]"], 40);
    await expectNoHorizontalOverflow(page);

    await searchInput.fill("zzzzzz");
    const manualResult = page.locator('[data-dish-ingredient-result-kind="manual"]');
    await expect(manualResult).toBeVisible();
    expect((await manualResult.boundingBox()).height).toBeCloseTo(160, 1);

    await searchInput.fill("~");
    const emptyResult = page.getByTestId("dish-ingredient-empty");
    await expect(emptyResult).toBeVisible();
    expect((await emptyResult.boundingBox()).height).toBeCloseTo(160, 1);

    await searchInput.fill("");
    await expect(results.first()).toBeVisible();
    await results.first().click();

    const confirm = page.getByTestId("dish-ingredient-confirm");
    const confirmCard = page.getByTestId("dish-ingredient-confirm-card");
    const confirmInput = page.locator('[data-testid="dish-ingredient-confirm-input"] input');
    const confirmActions = page.getByTestId("dish-ingredient-confirm-actions");
    await expect(confirm).toHaveAttribute("data-css-module-scope", "dish-ingredient-picker");
    await expect(confirmCard).toBeVisible();
    await expect(page.locator(".dishIngredientConfirmOverlay, .dishIngredientConfirmCard, .dishIngredientConfirmActions")).toHaveCount(0);

    const confirmBox = await confirmCard.boundingBox();
    const confirmInputBox = await confirmInput.boundingBox();
    const confirmActionsBox = await confirmActions.boundingBox();
    expect(confirmBox).not.toBeNull();
    expect(confirmInputBox).not.toBeNull();
    expect(confirmActionsBox).not.toBeNull();
    expect(confirmBox.width).toBeCloseTo(testCase.confirmWidth, 1);
    expect(confirmBox.height).toBeCloseTo(testCase.confirmHeight, 1);
    expect(confirmInputBox.height).toBeCloseTo(testCase.width >= 760 ? 62 : 52, 1);
    expect(confirmActionsBox.height).toBeCloseTo(testCase.theme === "warm-light" ? 50 : 48, 1);
    await expectTapTargets(page, ['[data-testid="dish-ingredient-confirm-actions"] button'], 40);
    await expectNoHorizontalOverflow(page);

    if (testCase.name === "warm-390" || testCase.name === "warm-1440" || testCase.name === "dark-390") {
      await attachScreenshot(page, testInfo, `client-dish-ingredient-picker-${testCase.name}.png`);
    }

    await page.locator('[data-dish-ingredient-action="add"]').click();
    await expect(confirm).toBeHidden();
    await expect(page.locator('[data-dish-ingredients-action="remove"]')).toHaveCount(1);
  }

  assertNoRuntimeErrors();
});

test("CSS V2 photo AI preview keeps result and analysis states scoped", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "One deterministic browser covers the viewport matrix.");

  const assertNoRuntimeErrors = failOnRuntimeErrors(page);
  const viewports = [
    { width: 360, height: 800 },
    { width: 390, height: 844 },
    { width: 430, height: 932 },
    { width: 768, height: 1024 },
    { width: 1440, height: 900 }
  ];

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto("/cssV2?clientHarness=1&clientHarnessPage=nutritionPhotoPreview");

    const preview = page.getByTestId("nutrition-photo-ai-preview");
    const previewImage = preview.locator("img");
    const candidates = page.locator("[data-photo-ai-candidate]");
    const resetButton = page.locator('[data-photo-ai-action="reset"]');

    await expect(preview).toBeVisible();
    await expect(preview).toHaveAttribute("data-css-module-scope", "nutrition-photo-ai-preview");
    await expect(preview).toHaveAttribute("data-state", "result");
    await expect(page.locator(".fatPhotoAiFloatingPreview, .fatPhotoAiPreviewImage, .fatPhotoAiCandidates")).toHaveCount(0);
    await expect(preview).toHaveCSS("padding", "10px");
    await expect(preview).toHaveCSS("border-radius", "18px");
    await expect(preview).toHaveCSS("background-color", "rgb(255, 255, 255)");
    await expect(previewImage).toHaveCSS("width", "52px");
    await expect(previewImage).toHaveCSS("height", "52px");
    await expect(candidates).toHaveCount(3);
    await expect(resetButton).toHaveCSS("width", "32px");
    await expect(resetButton).toHaveCSS("height", "32px");

    const previewBox = await preview.boundingBox();
    expect(previewBox).not.toBeNull();
    expect(previewBox.x).toBeGreaterThanOrEqual(0);
    expect(previewBox.x + previewBox.width).toBeLessThanOrEqual(viewport.width + 1);
    await expectNoHorizontalOverflow(page);

    await candidates.first().click();
    await expect(page.getByTestId("nutrition-photo-candidate-selection")).toHaveText("harness_chicken");

    if (viewport.width === 390 || viewport.width === 1440) {
      await attachScreenshot(page, testInfo, `client-nutrition-photo-preview-${viewport.width}.png`);
    }
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/cssV2?clientHarness=1&clientHarnessPage=nutritionPhotoPreview&clientPhotoPreviewState=analyzing&clientHarnessTheme=dark-green");

  const analyzingPreview = page.getByTestId("nutrition-photo-ai-preview");
  await expect(analyzingPreview).toHaveAttribute("data-state", "analyzing");
  await expect(page.getByTestId("nutrition-photo-ai-candidates")).toHaveCount(0);
  await expect(page.getByTestId("nutrition-photo-ai-dots").locator("i")).toHaveCount(3);
  await expect(analyzingPreview).toHaveCSS("border-radius", "18px");
  await expectNoHorizontalOverflow(page);
  await attachScreenshot(page, testInfo, "client-nutrition-photo-preview-analyzing-dark.png");

  await page.locator('[data-photo-ai-action="reset"]').click();
  await expect(analyzingPreview).toBeHidden();
  assertNoRuntimeErrors();
});

test("CSS V2 nutrition diary stays usable at target viewports", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "One deterministic browser covers the viewport matrix.");

  const assertNoRuntimeErrors = failOnRuntimeErrors(page);
  const viewports = [
    { width: 360, height: 800 },
    { width: 390, height: 844 },
    { width: 430, height: 932 },
    { width: 768, height: 1024 },
    { width: 1440, height: 900 }
  ];

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto("/cssV2?clientHarness=1");
    await expect(page.getByTestId("client-nav-nutrition")).toBeVisible({ timeout: 40_000 });
    await page.getByTestId("client-nav-nutrition").click();

    const diaryToggle = page.getByTestId("nutrition-diary-toggle");
    await expect(page.locator('[data-css-module-scope="nutrition-diary"]')).toBeVisible();
    await diaryToggle.scrollIntoViewIfNeeded();
    const toggleBox = await diaryToggle.boundingBox();
    expect(toggleBox).not.toBeNull();
    expect(toggleBox.x).toBeGreaterThanOrEqual(0);
    expect(toggleBox.x + toggleBox.width).toBeLessThanOrEqual(viewport.width + 1);
    await expectNoHorizontalOverflow(page);

    await diaryToggle.click();
    await expect(page.getByTestId("nutrition-diary-modal")).toBeVisible();
    await expectTapTargets(page, [
      '[data-testid="nutrition-diary-close"]',
      '[data-testid="nutrition-diary-add"]',
      '[data-testid="nutrition-diary-food"]'
    ]);
    await expectNoHorizontalOverflow(page);
    await page.getByTestId("nutrition-diary-close").click();
  }

  assertNoRuntimeErrors();
});

test("CSS V2 nutrition calendar keeps scoped responsive geometry and theme states", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "One deterministic browser covers the viewport matrix.");

  const assertNoRuntimeErrors = failOnRuntimeErrors(page);
  const viewports = [
    { width: 360, height: 800, sheetWidth: 328, sheetHeight: 503, dayHeight: 44, radius: "26px" },
    { width: 390, height: 844, sheetWidth: 358, sheetHeight: 501, dayHeight: 47, radius: "26px" },
    { width: 430, height: 932, sheetWidth: 370, sheetHeight: 501, dayHeight: 47, radius: "26px" },
    { width: 768, height: 1024, sheetWidth: 370, sheetHeight: 501, dayHeight: 47, radius: "26px" },
    { width: 1440, height: 900, sheetWidth: 370, sheetHeight: 501, dayHeight: 47, radius: "26px" }
  ];

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto("/cssV2?clientHarness=1");
    await expect(page.getByTestId("client-nav-nutrition")).toBeVisible({ timeout: 40_000 });
    await page.getByTestId("client-nav-nutrition").click();
    await page.locator("[data-nutrition-header-action]").nth(1).click();

    const modal = page.getByTestId("nutrition-calendar-modal");
    const sheet = page.getByTestId("nutrition-calendar-sheet");
    const days = page.locator("[data-nutrition-calendar-day]");
    const selectedDay = page.locator('[data-nutrition-calendar-day][aria-pressed="true"]');
    const today = page.locator('[data-nutrition-calendar-day][aria-current="date"]');
    const regularDay = page.locator('[data-nutrition-calendar-day][data-current-month="true"][data-has-food="false"][aria-pressed="false"]').first();
    const previousMonth = page.locator('[data-nutrition-calendar-action="previous-month"]');
    const nextMonth = page.locator('[data-nutrition-calendar-action="next-month"]');
    const swipeRegion = page.getByTestId("nutrition-calendar-swipe-region");
    const monthLabel = page.getByTestId("nutrition-calendar-header").locator("strong");

    await expect(modal).toBeVisible();
    await expect(modal).toHaveAttribute("data-css-module-scope", "nutrition-calendar-modal");
    await expect(days).toHaveCount(42);
    await expect(selectedDay).toHaveCount(1);
    await expect(today).toHaveCount(1);
    await expect(page.locator('[data-nutrition-calendar-action="done"]')).toHaveCount(0);
    await expect(page.locator('[data-nutrition-calendar-action="today"]')).toHaveCount(1);
    await expect(swipeRegion).toHaveCSS("touch-action", "pan-y");
    await expect(page.locator(".nutritionCalendarOverlay, .nutritionCalendarSheet, .nutritionCalendarDay, .nutritionCalendarClose")).toHaveCount(0);
    await expect(sheet).toHaveCSS("border-radius", viewport.radius);
    await expect(sheet).toHaveCSS("opacity", "1");

    const sheetBox = await sheet.boundingBox();
    const dayBox = await regularDay.boundingBox();
    expect(sheetBox).not.toBeNull();
    expect(dayBox).not.toBeNull();
    expect(sheetBox.width).toBeCloseTo(viewport.sheetWidth, 0);
    expect(sheetBox.height).toBeCloseTo(viewport.sheetHeight, 0);
    expect(dayBox.height).toBeCloseTo(viewport.dayHeight, 0);
    expect(sheetBox.x).toBeGreaterThanOrEqual(0);
    expect(sheetBox.x + sheetBox.width).toBeLessThanOrEqual(viewport.width + 1);
    await expectTapTargets(page, [
      '[data-testid="nutrition-calendar-close"]',
      '[data-testid="nutrition-calendar-footer"] button'
    ]);
    await expectNoHorizontalOverflow(page);

    const initialMonth = await monthLabel.textContent();
    await previousMonth.click();
    await expect(monthLabel).not.toHaveText(initialMonth || "");
    await nextMonth.click();
    await expect(monthLabel).toHaveText(initialMonth || "");

    await swipeRegion.dispatchEvent("pointerdown", {
      pointerId: 1,
      pointerType: "touch",
      clientX: 280,
      clientY: 300
    });
    await swipeRegion.dispatchEvent("pointermove", {
      pointerId: 1,
      pointerType: "touch",
      clientX: 190,
      clientY: 304
    });
    await swipeRegion.dispatchEvent("pointerup", {
      pointerId: 1,
      pointerType: "touch",
      clientX: 120,
      clientY: 304
    });
    await expect(monthLabel).not.toHaveText(initialMonth || "");

    await swipeRegion.dispatchEvent("pointerdown", {
      pointerId: 2,
      pointerType: "touch",
      clientX: 120,
      clientY: 300
    });
    await swipeRegion.dispatchEvent("pointermove", {
      pointerId: 2,
      pointerType: "touch",
      clientX: 210,
      clientY: 304
    });
    await swipeRegion.dispatchEvent("pointerup", {
      pointerId: 2,
      pointerType: "touch",
      clientX: 280,
      clientY: 304
    });
    await expect(monthLabel).toHaveText(initialMonth || "");

    if (viewport.width === 390 || viewport.width === 1440) {
      await attachScreenshot(page, testInfo, `client-nutrition-calendar-scoped-${viewport.width}.png`);
    }

    await page.getByTestId("nutrition-calendar-close").click();
    await expect(modal).toBeHidden();
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/cssV2?clientHarness=1&clientHarnessTheme=dark-green");
  await expect(page.getByTestId("client-nav-nutrition")).toBeVisible({ timeout: 40_000 });
  await page.getByTestId("client-nav-nutrition").click();
  await page.locator("[data-nutrition-header-action]").nth(1).click();

  const darkSheet = page.getByTestId("nutrition-calendar-sheet");
  const darkSelectedDay = page.locator('[data-nutrition-calendar-day][aria-pressed="true"]');
  const darkTodayAction = page.locator('[data-nutrition-calendar-action="today"]');
  await expect(darkSheet).toHaveCSS("border-color", "rgba(255, 255, 255, 0.09)");
  await expect(darkSheet).toHaveCSS("background-image", /linear-gradient/);
  await expect(darkSelectedDay).toHaveCSS("background-image", /linear-gradient/);
  await expect(darkTodayAction).toHaveCSS("background-color", "rgba(255, 255, 255, 0.04)");
  await expectNoHorizontalOverflow(page);
  await attachScreenshot(page, testInfo, "client-nutrition-calendar-scoped-dark.png");

  assertNoRuntimeErrors();
});

test("CSS V2 nutrition orbit keeps scoped reference geometry, motion and add flow", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "One deterministic browser covers the viewport matrix.");

  const assertNoRuntimeErrors = failOnRuntimeErrors(page);
  const viewports = [
    { name: "360", width: 360, height: 800, cardWidth: 328 },
    { name: "390", width: 390, height: 844, cardWidth: 358 },
    { name: "430", width: 430, height: 932, cardWidth: 370 },
    { name: "768", width: 768, height: 1024, cardWidth: 370 },
    { name: "768-short", width: 768, height: 800, cardWidth: 370 },
    { name: "1440", width: 1440, height: 900, cardWidth: 370 }
  ];

  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto("/cssV2?clientHarness=1");
    await expect(page.getByTestId("client-nav-nutrition")).toBeVisible({ timeout: 40_000 });
    await page.getByTestId("client-nav-nutrition").click();

    const orbit = page.getByTestId("nutrition-orbit");
    const card = page.locator('[data-nutrition-orbit-part="card"]');
    const scene = page.locator('[data-nutrition-orbit-part="scene"]');
    const addButton = page.getByTestId("nutrition-orbit-add");
    const progressPaths = page.locator("[data-nutrition-orbit-progress]");
    const halo = page.locator('[data-nutrition-orbit-halo="outer"]');

    await expect(orbit).toBeVisible();
    await expect(orbit).toHaveAttribute("data-css-module-scope", "nutrition-orbit");
    await expect(progressPaths).toHaveCount(4);
    await expect(page.locator(".nutritionOrbitPreview, .nutritionOrbitPreviewCard, .nutritionOrbitHitButton, .nutritionOrbitSvgTitle")).toHaveCount(0);
    await expect(card).toHaveCSS("border-radius", "24px");
    await expect(card).toHaveCSS("border-color", "rgb(235, 230, 239)");
    await expect(card).toHaveCSS("background-color", "rgb(255, 255, 255)");
    await expect(orbit).toHaveCSS("margin-top", "12px");

    const cardBox = await card.boundingBox();
    const sceneBox = await scene.boundingBox();
    const hitBox = await addButton.boundingBox();
    expect(cardBox).not.toBeNull();
    expect(sceneBox).not.toBeNull();
    expect(hitBox).not.toBeNull();
    expect(cardBox.width).toBeCloseTo(viewport.cardWidth, 0);
    expect(cardBox.height).toBeCloseTo(270, 0);
    expect(sceneBox.width).toBeCloseTo(160, 0);
    expect(sceneBox.height).toBeCloseTo(160, 0);
    expect(hitBox.width).toBeGreaterThanOrEqual(100);
    expect(hitBox.height).toBeCloseTo(38, 0);
    expect(cardBox.x).toBeGreaterThanOrEqual(0);
    expect(cardBox.x + cardBox.width).toBeLessThanOrEqual(viewport.width + 1);

    await expect(halo).not.toHaveCSS("animation-name", "none");
    await expectNoHorizontalOverflow(page);

    if (viewport.name === "390" || viewport.name === "1440") {
      await attachScreenshot(page, testInfo, `client-nutrition-orbit-scoped-${viewport.name}.png`);
    }
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/cssV2?clientHarness=1&clientHarnessTheme=dark-green");
  await expect(page.getByTestId("client-nav-nutrition")).toBeVisible({ timeout: 40_000 });
  await page.getByTestId("client-nav-nutrition").click();

  const darkCard = page.locator('[data-nutrition-orbit-part="card"]');
  const darkTitle = page.locator('[data-nutrition-orbit-text="title"]');
  await expect(darkCard).toHaveCSS("width", "358px");
  await expect(darkCard).toHaveCSS("height", "270px");
  await expect(darkCard).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await expect(darkTitle).toHaveCSS("color", "rgb(255, 255, 255)");
  await expectNoHorizontalOverflow(page);
  await attachScreenshot(page, testInfo, "client-nutrition-orbit-scoped-dark.png");

  await page.getByTestId("nutrition-orbit-add").click();
  await expect(page.getByRole("dialog", { name: "Поиск еды" })).toBeVisible();
  assertNoRuntimeErrors();
});

test("CSS V2 nutrition meal modal keeps scoped reference geometry, themes and actions", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "One deterministic browser covers the viewport matrix.");

  const assertNoRuntimeErrors = failOnRuntimeErrors(page);
  const viewports = [
    { name: "360", width: 360, height: 800, sheetWidth: 328, sheetHeight: 266, rowWidth: 298, rowHeight: 79 },
    { name: "390", width: 390, height: 844, sheetWidth: 358, sheetHeight: 266, rowWidth: 328, rowHeight: 79 },
    { name: "430", width: 430, height: 932, sheetWidth: 370, sheetHeight: 266, rowWidth: 340, rowHeight: 79 },
    { name: "768", width: 768, height: 1024, sheetWidth: 370, sheetHeight: 266, rowWidth: 340, rowHeight: 79 },
    { name: "1440", width: 1440, height: 900, sheetWidth: 370, sheetHeight: 266, rowWidth: 340, rowHeight: 79 }
  ];

  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto("/cssV2?clientHarness=1&clientHarnessPage=nutritionMealModal");

    const modal = page.getByTestId("nutrition-meal-modal");
    const sheet = page.locator('[data-nutrition-meal-part="sheet"]');
    const row = page.getByTestId("nutrition-meal-food");
    const addButton = page.getByTestId("nutrition-meal-add");

    await expect(modal).toBeVisible({ timeout: 40_000 });
    await expect(modal).toHaveAttribute("data-css-module-scope", "nutrition-meal-modal");
    await expect(page.locator(".nutritionMealModalOverlay, .nutritionMealModalSheet, .productRowExact, .productInfoExact")).toHaveCount(0);
    await expect(modal).toHaveCSS("position", "fixed");
    await expect(modal).toHaveCSS("z-index", "9997");
    await expect(sheet).toHaveCSS("border-radius", "26px");
    await expect(sheet).toHaveCSS("background-color", "rgb(247, 246, 248)");
    await expect(page.locator('[data-nutrition-meal-part="header"] h2')).toHaveCSS("color", "rgb(40, 38, 46)");
    await expect(row).toHaveCSS("transition-property", "transform, opacity, background");

    const sheetBox = await sheet.boundingBox();
    const rowBox = await row.boundingBox();
    const addBox = await addButton.boundingBox();
    expect(sheetBox).not.toBeNull();
    expect(rowBox).not.toBeNull();
    expect(addBox).not.toBeNull();
    expect(sheetBox.width).toBeCloseTo(viewport.sheetWidth, 0);
    expect(sheetBox.height).toBeCloseTo(viewport.sheetHeight, 0);
    expect(rowBox.width).toBeCloseTo(viewport.rowWidth, 0);
    expect(rowBox.height).toBeCloseTo(viewport.rowHeight, 0);
    expect(addBox.width).toBeCloseTo(viewport.rowWidth, 0);
    expect(addBox.height).toBeCloseTo(54, 0);
    expect(sheetBox.x).toBeGreaterThanOrEqual(0);
    expect(sheetBox.x + sheetBox.width).toBeLessThanOrEqual(viewport.width + 1);
    expect(sheetBox.y).toBeGreaterThanOrEqual(0);
    expect(sheetBox.y + sheetBox.height).toBeLessThanOrEqual(viewport.height + 1);
    await expectNoHorizontalOverflow(page);

    if (viewport.name === "390" || viewport.name === "1440") {
      await attachScreenshot(page, testInfo, `client-nutrition-meal-modal-scoped-${viewport.name}.png`);
    }
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/cssV2?clientHarness=1&clientHarnessPage=nutritionMealModal&clientHarnessTheme=dark-green");
  const darkSheet = page.locator('[data-nutrition-meal-part="sheet"]');
  await expect(darkSheet).toBeVisible({ timeout: 40_000 });
  await expect(darkSheet).toHaveCSS("border-color", "rgba(255, 255, 255, 0.09)");
  await expect(darkSheet).toHaveCSS("background-image", /linear-gradient/);
  await expect(page.locator('[data-nutrition-meal-part="header"] h2')).toHaveCSS("color", "rgb(245, 247, 243)");
  await expectNoHorizontalOverflow(page);
  await attachScreenshot(page, testInfo, "client-nutrition-meal-modal-scoped-dark.png");

  await page.goto("/cssV2?clientHarness=1&clientHarnessPage=nutritionMealModal");
  await page.getByTestId("nutrition-meal-close").click();
  await expect(page.getByTestId("nutrition-meal-modal")).toBeHidden();

  await page.goto("/cssV2?clientHarness=1&clientHarnessPage=nutritionMealModal");
  await page.getByTestId("nutrition-meal-food").click();
  await expect(page.getByTestId("food-product-hero")).toBeVisible();
  await expect(page.getByTestId("nutrition-meal-modal")).toBeHidden();

  await page.goto("/cssV2?clientHarness=1&clientHarnessPage=nutritionMealModal");
  await page.getByTestId("nutrition-meal-add").click();
  await expect(page.getByTestId("food-search-header")).toBeVisible();
  await expect(page.getByTestId("nutrition-meal-modal")).toBeHidden();
  assertNoRuntimeErrors();
});

test("CSS V2 nutrition summary keeps scoped reference geometry, themes and actions", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "One deterministic browser covers the viewport matrix.");

  const assertNoRuntimeErrors = failOnRuntimeErrors(page);
  const viewports = [
    { name: "360", width: 360, height: 800, widthExpected: 328 },
    { name: "390", width: 390, height: 844, widthExpected: 358 },
    { name: "430", width: 430, height: 932, widthExpected: 370 },
    { name: "768", width: 768, height: 1024, widthExpected: 370 },
    { name: "1440", width: 1440, height: 900, widthExpected: 370 }
  ];

  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto("/cssV2?clientHarness=1&clientHarnessTheme=warm-light");
    await expect(page.getByTestId("client-nav-nutrition")).toBeVisible({ timeout: 40_000 });
    await page.getByTestId("client-nav-nutrition").click();

    const summary = page.getByTestId("nutrition-summary");
    const card = page.locator('[data-nutrition-summary-part="card"]');
    const arrow = page.locator('[data-nutrition-summary-part="arrow"] svg');
    const title = summary.locator("strong");

    await expect(summary).toBeVisible({ timeout: 40_000 });
    await expect(summary).toHaveAttribute("data-css-module-scope", "nutrition-summary");
    await expect(summary).toHaveAttribute("data-state", "within-limit");
    await expect(page.locator(".nutritionAiPlanTopInline, .nutritionAiPlanTopCard, .nutritionAiPlanTopTitle")).toHaveCount(0);
    await expect(card).toHaveCSS("height", "72px");
    await expect(card).toHaveCSS("background-color", "rgb(255, 255, 255)");
    await expect(arrow).toHaveCSS("width", "20px");
    await expect(arrow).toHaveCSS("height", "20px");
    await expect(arrow).toHaveCSS("border-top-width", "0px");
    await expect(title).toHaveCSS("font-size", "14px");

    const summaryBox = await summary.boundingBox();
    const cardBox = await card.boundingBox();
    expect(summaryBox).not.toBeNull();
    expect(cardBox).not.toBeNull();
    expect(summaryBox.width).toBeCloseTo(viewport.widthExpected, 0);
    expect(summaryBox.height).toBeCloseTo(72, 0);
    expect(cardBox.width).toBeCloseTo(viewport.widthExpected, 0);
    expect(cardBox.height).toBeCloseTo(72, 0);
    expect(summaryBox.x).toBeGreaterThanOrEqual(0);
    expect(summaryBox.x + summaryBox.width).toBeLessThanOrEqual(viewport.width + 1);
    await expectNoHorizontalOverflow(page);

    if (viewport.name === "390" || viewport.name === "1440") {
      await attachScreenshot(page, testInfo, `client-nutrition-summary-scoped-${viewport.name}.png`);
    }
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/cssV2?clientHarness=1&clientHarnessTheme=dark-green");
  await expect(page.getByTestId("client-nav-nutrition")).toBeVisible({ timeout: 40_000 });
  await page.getByTestId("client-nav-nutrition").click();

  const darkSummary = page.getByTestId("nutrition-summary");
  const darkCard = page.locator('[data-nutrition-summary-part="card"]');
  const darkArrow = page.locator('[data-nutrition-summary-part="arrow"] svg');
  await expect(darkSummary).toBeVisible({ timeout: 40_000 });
  await expect(darkCard).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await expect(darkArrow).toHaveCSS("width", "20px");
  await expect(darkArrow).toHaveCSS("height", "20px");
  await expect(darkArrow).toHaveCSS("border-top-width", "0px");
  const darkSummaryBox = await darkSummary.boundingBox();
  const darkCardBox = await darkCard.boundingBox();
  expect(darkSummaryBox).not.toBeNull();
  expect(darkCardBox).not.toBeNull();
  expect(darkSummaryBox.width).toBeCloseTo(358, 0);
  expect(darkSummaryBox.height).toBeCloseTo(72, 0);
  expect(darkCardBox.width).toBeCloseTo(358, 0);
  expect(darkCardBox.height).toBeCloseTo(72, 0);
  await expectNoHorizontalOverflow(page);
  await attachScreenshot(page, testInfo, "client-nutrition-summary-scoped-dark.png");

  await darkCard.click();
  await expect(page.getByTestId("nutrition-plan-details")).toBeVisible();
  await page.getByTestId("nutrition-plan-close").click();
  await expect(page.getByTestId("nutrition-plan-details")).toBeHidden();
  assertNoRuntimeErrors();
});

test("CSS V2 nutrition plan details keeps scoped reference geometry, themes and actions", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "One deterministic browser covers the viewport matrix.");

  const assertNoRuntimeErrors = failOnRuntimeErrors(page);
  const viewports = [
    { name: "360", width: 360, height: 800, rootWidth: 328, scoreSize: 118 },
    { name: "390", width: 390, height: 844, rootWidth: 358, scoreSize: 118 },
    { name: "430", width: 430, height: 932, rootWidth: 370, scoreSize: 124 },
    { name: "768", width: 768, height: 1024, rootWidth: 370, scoreSize: 124 },
    { name: "1440", width: 1440, height: 900, rootWidth: 370, scoreSize: 124 }
  ];

  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto("/cssV2?clientHarness=1&clientHarnessTheme=warm-light");
    await expect(page.getByTestId("client-nav-nutrition")).toBeVisible({ timeout: 40_000 });
    await page.getByTestId("client-nav-nutrition").click();
    await page.locator('[data-nutrition-summary-part="card"]').click();

    const modal = page.getByTestId("nutrition-plan-details");
    const dialog = page.getByRole("dialog", { name: "План питания" });
    const backdrop = page.getByTestId("nutrition-plan-backdrop");
    const close = page.getByTestId("nutrition-plan-close");
    const caloriePanel = page.locator('[data-nutrition-plan-part="calorie-progress"]');
    const score = page.getByRole("img", { name: /Оценка питания:/ });

    await expect(modal).toBeVisible({ timeout: 40_000 });
    await expect(backdrop).toBeVisible();
    await expect(modal).toHaveAttribute("data-css-module-scope", "nutrition-plan-details");
    await expect(modal).toHaveAttribute("data-state", "within-limit");
    await expect(dialog).toHaveAttribute("aria-modal", "true");
    await expect(page.locator(".nutritionAiPlanDashboard, .nutritionAiPlanModal, .nutritionAiPlanToggleBtn")).toHaveCount(0);
    await expect(modal).toHaveCSS("position", "fixed");
    await expect(modal).toHaveCSS("background-color", "rgb(255, 255, 255)");
    await expect(modal).toHaveCSS("border-top-color", "rgb(235, 230, 239)");
    await expect(modal).toHaveCSS("border-radius", "26px");
    await expect(close).toHaveCSS("width", "44px");
    await expect(close).toHaveCSS("height", "44px");

    const modalBox = await modal.boundingBox();
    const panelBox = await caloriePanel.boundingBox();
    const scoreBox = await score.boundingBox();
    expect(modalBox).not.toBeNull();
    expect(panelBox).not.toBeNull();
    expect(scoreBox).not.toBeNull();
    expect(modalBox.width).toBeCloseTo(viewport.rootWidth, 0);
    expect(modalBox.height).toBeGreaterThan(600);
    expect(modalBox.height).toBeLessThanOrEqual(viewport.height - 32 + 0.5);
    expect(panelBox.height).toBeGreaterThanOrEqual(78);
    expect(panelBox.height).toBeLessThanOrEqual(112);
    expect(scoreBox.width).toBeCloseTo(viewport.scoreSize, 0);
    expect(scoreBox.height).toBeCloseTo(viewport.scoreSize, 0);
    expect(modalBox.x).toBeGreaterThanOrEqual(0);
    expect(modalBox.x + modalBox.width).toBeLessThanOrEqual(viewport.width + 1);
    expect(modalBox.y).toBeGreaterThanOrEqual(0);
    expect(modalBox.y + modalBox.height).toBeLessThanOrEqual(viewport.height + 1);
    await expectNoHorizontalOverflow(page);

    if (viewport.name === "390") {
      const firstActivePixel = page.locator('[data-nutrition-plan-pixel="active"]').first();
      await expect(firstActivePixel).toHaveCSS("background-color", "rgb(143, 122, 200)");
      await modal.evaluate((node) => {
        node.dataset.state = "over-limit";
      });
      await expect(firstActivePixel).toHaveCSS("background-color", "rgb(179, 110, 114)");
    }

    if (viewport.name === "390" || viewport.name === "1440") {
      await attachScreenshot(page, testInfo, `client-nutrition-plan-details-scoped-${viewport.name}.png`);
    }
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/cssV2?clientHarness=1&clientHarnessTheme=dark-green");
  await expect(page.getByTestId("client-nav-nutrition")).toBeVisible({ timeout: 40_000 });
  await page.getByTestId("client-nav-nutrition").click();
  await page.locator('[data-nutrition-summary-part="card"]').click();

  const darkModal = page.getByTestId("nutrition-plan-details");
  const darkClose = page.getByTestId("nutrition-plan-close");
  await expect(darkModal).toBeVisible({ timeout: 40_000 });
  await expect(darkModal).toHaveCSS("background-color", "rgba(255, 255, 255, 0.027)");
  await expect(darkModal).toHaveCSS("border-top-color", "rgba(255, 255, 255, 0.07)");
  await expect(darkClose).toHaveCSS("width", "44px");
  await expect(darkClose).toHaveCSS("height", "44px");
  const darkBox = await darkModal.boundingBox();
  expect(darkBox).not.toBeNull();
  expect(darkBox.width).toBeCloseTo(358, 0);
  expect(darkBox.height).toBeCloseTo(711, 0);
  await expectNoHorizontalOverflow(page);
  await attachScreenshot(page, testInfo, "client-nutrition-plan-details-scoped-dark.png");

  await page.getByTestId("nutrition-plan-backdrop").click({ position: { x: 2, y: 2 } });
  await expect(page.getByTestId("nutrition-plan-details")).toBeHidden();
  await page.locator('[data-nutrition-summary-part="card"]').click();
  await expect(page.getByTestId("nutrition-plan-details")).toBeVisible();
  await page.getByTestId("nutrition-plan-close").click();
  await expect(page.getByTestId("nutrition-plan-details")).toBeHidden();
  assertNoRuntimeErrors();
});
