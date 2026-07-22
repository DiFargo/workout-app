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

async function expectTapTargets(page, selectors, minSize = 40) {
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

async function expectCrispProfileModal(page, overlayTestId, dialogTestId, closeTestId) {
  const overlay = page.getByTestId(overlayTestId);
  const dialog = page.getByTestId(dialogTestId);
  const close = page.getByTestId(closeTestId);

  await expect(overlay).toHaveCSS("backdrop-filter", "none");
  await expect(dialog).toHaveAttribute("data-modal-surface", "true");
  await expect(dialog).toHaveCSS("filter", "none");
  await expect(close).toHaveAttribute("data-profile-modal-close", "true");
  await expect(close).toHaveCSS("width", "44px");
  await expect(close).toHaveCSS("height", "44px");
  await expect(close).toHaveCSS("border-radius", "50%");
  await expect(close.locator("svg")).toHaveCount(1);

  const geometry = await dialog.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return {
      left: rect.left,
      right: window.innerWidth - rect.right,
      top: rect.top,
      bottom: window.innerHeight - rect.bottom,
      radius: Number.parseFloat(window.getComputedStyle(element).borderTopLeftRadius)
    };
  });

  expect(geometry.left).toBeGreaterThanOrEqual(10);
  expect(geometry.right).toBeGreaterThanOrEqual(10);
  expect(geometry.top).toBeGreaterThanOrEqual(10);
  expect(geometry.bottom).toBeGreaterThanOrEqual(10);
  expect(geometry.radius).toBeGreaterThanOrEqual(28);

  const modalHeader = dialog.locator('[data-client-page-header="true"]');
  if (await modalHeader.count()) {
    await expect(modalHeader).toHaveAttribute("data-client-page-header-layout", "embedded");
  }
}

async function expectPrimaryChrome(page, pageTestId, mode) {
  const shell = page.getByTestId(pageTestId);
  await expect(shell).toBeVisible();
  await expect(shell).toHaveAttribute("data-css-module-scope", "profile-dashboard-shell");
  await expect(shell).not.toHaveClass(/profileDashboardPage|profileTabbedPage|clientCorePage|mainDashboardPage/);
  await expect(shell.getByTestId("profile-dashboard-content")).toBeVisible();
  const title = mode === "main"
    ? page.getByTestId("profile-main-title")
    : page.getByTestId("profile-cabinet-title");
  await expect(title).toBeVisible();
  if (mode === "main") {
    await expect(title).toHaveText("Главная");
    await expect(page.getByTestId("profile-main-next-workout")).toBeVisible();
    await expect(page.getByTestId("profile-main-last-workout")).toHaveCount(0);
    const version = page.getByTestId("profile-dashboard-version");
    await expect(version).toBeVisible();
    await expect(version).toHaveText(/^v\.?3\.0\.\d+$/);
    await expect(version).toHaveCSS("position", "static");
    await expect(version).toHaveCSS("pointer-events", "none");
  } else {
    await expect(title).toHaveText("Кабинет");
    await expect(page.getByTestId("profile-cabinet-refresh")).toBeVisible();
    await expect(page.getByTestId("profile-main-summary-grid")).toHaveCount(0);
    await expect(page.getByTestId("profile-dashboard-version")).toHaveCount(0);
  }
  await expect(page.locator(".clientPageVersionBadge")).toHaveCount(0);
  await expect(page.getByTestId("client-bottom-nav")).toBeVisible();
  await expectTapTargets(page, mode === "main"
    ? ['[data-testid="client-bottom-nav"] button', '[data-testid="profile-main-notifications"]']
    : ['[data-testid="client-bottom-nav"] button', '[data-testid="profile-cabinet-refresh"]']);
  await expectNoHorizontalOverflow(page);
}

async function expectMainDashboardContent(page) {
  await expect(page.getByTestId("profile-main-hero")).toBeVisible();
  await expect(page.getByTestId("profile-main-next-workout")).toBeVisible();
  await expect(page.getByTestId("profile-main-last-workout")).toHaveCount(0);
  await expect(page.getByTestId("profile-progress-card")).toBeVisible();
  await expect(page.getByTestId("profile-progress-gauge")).toHaveAttribute("aria-label", /90.*100/);
  await expect(page.getByTestId("profile-progress-badge")).toHaveCount(3);
  await expect(page.getByTestId("profile-measurement-snapshot")).toBeVisible();
}

async function expectMainMeasurementSnapshotLayout(page) {
  const metrics = await page.evaluate(() => {
    const rectOf = (selector) => {
      const node = document.querySelector(selector);
      const rect = node?.getBoundingClientRect();
      return rect
        ? {
            x: rect.x,
            y: rect.y,
            right: rect.right,
            bottom: rect.bottom
          }
        : null;
    };
    const overlaps = (a, b) => Boolean(a && b && a.x < b.right && a.right > b.x && a.y < b.bottom && a.bottom > b.y);

    const card = rectOf('[data-testid="profile-measurement-snapshot"]');
    const header = rectOf('[data-testid="profile-measurement-snapshot-header"] span');
    const weightLabel = rectOf('[data-testid="profile-measurement-snapshot-weight"] strong');
    const chart = rectOf('[data-testid="profile-measurement-snapshot-chart"]');

    return {
      skipped: window.innerWidth > 640,
      card,
      header,
      weightLabel,
      chart,
      headerOverlapsWeight: overlaps(header, weightLabel),
      chartEscapesCard: Boolean(card && chart && chart.bottom > card.bottom + 1)
    };
  });

  if (metrics.skipped) return;

  expect(metrics.card).not.toBeNull();
  expect(metrics.header).not.toBeNull();
  expect(metrics.weightLabel).not.toBeNull();
  expect(metrics.chart).not.toBeNull();
  expect(metrics.headerOverlapsWeight).toBe(false);
  expect(metrics.chartEscapesCard).toBe(false);
}

test("profile measurement snapshot keeps every data state inside its adaptive card", async ({ page }) => {
  for (const theme of ["warm-light", "dark-green"]) {
    for (const state of ["trend", "single", "empty"]) {
      await page.goto(`/?clientHarness=1&clientHarnessTheme=${theme}&clientMeasurementSnapshotState=${state}`);
      const card = page.getByTestId("profile-measurement-snapshot");
      await expect(card).toBeVisible();
      await expect(card).toHaveAttribute("data-state", state);
      await expect(page.getByTestId("profile-measurement-snapshot-weight")).toBeVisible();
      await expect(page.getByTestId("profile-measurement-snapshot-chart")).toBeVisible();

      if (state === "trend") {
        await expect(page.getByTestId("profile-measurement-snapshot-trend")).toHaveAttribute("aria-label", /Изменение веса/);
      } else {
        await expect(page.getByTestId(`profile-measurement-snapshot-${state}`)).toBeVisible();
      }

      const fit = await card.evaluate((root) => {
        const rootRect = root.getBoundingClientRect();
        const header = root.querySelector('[data-testid="profile-measurement-snapshot-header"] span')?.getBoundingClientRect();
        const chart = root.querySelector('[data-testid="profile-measurement-snapshot-chart"]')?.getBoundingClientRect();
        return {
          headerFits: Boolean(header && header.right <= rootRect.right + 1),
          chartFits: Boolean(chart && chart.right <= rootRect.right + 1 && chart.bottom <= rootRect.bottom + 1)
        };
      });

      expect(fit).toEqual({ headerFits: true, chartFits: true });
      await expectNoHorizontalOverflow(page);
    }
  }
});

async function expectClientCardTextReadable(page, mode) {
  const metrics = await page.evaluate((activeMode) => {
    const rectOf = (selector) => {
      const node = document.querySelector(selector);
      const rect = node?.getBoundingClientRect();
      return rect
        ? {
            x: rect.x,
            right: rect.right
          }
        : null;
    };
    const clippedTexts = [
      '[data-testid="profile-main-stats"] strong',
      '[data-testid="profile-main-summary-grid"] strong',
      '[data-testid="profile-progress-badge"] small'
    ].flatMap((selector) => (
      [...document.querySelectorAll(selector)].map((node) => ({
        selector,
        text: node.textContent.trim(),
        scrollWidth: Math.ceil(node.scrollWidth),
        clientWidth: Math.ceil(node.clientWidth)
      }))
    )).filter((item) => item.scrollWidth > item.clientWidth + 1);

    return {
      skipped: window.innerWidth > 640,
      avatar: rectOf(activeMode === "cabinet" ? '[data-testid="profile-cabinet-action-account-icon"]' : '[data-testid="profile-main-hero-avatar"]'),
      title: rectOf(activeMode === "cabinet" ? '[data-testid="profile-cabinet-action-account-title"]' : '[data-testid="profile-main-hero-title"]'),
      clippedTexts: activeMode === "main" ? clippedTexts : []
    };
  }, mode);

  if (metrics.skipped) return;

  expect(metrics.avatar).not.toBeNull();
  expect(metrics.title).not.toBeNull();
  expect(metrics.title.x).toBeGreaterThanOrEqual(metrics.avatar.right + 8);
  expect(metrics.clippedTexts).toEqual([]);
}

async function expectCabinetContent(page) {
  await expect(page.getByTestId("profile-main-hero")).toHaveCount(0);
  await expect(page.getByTestId("profile-cabinet-action-grid")).toBeVisible();
  await expect(page.getByTestId("profile-cabinet-action-account")).toBeVisible();
  await expect(page.getByTestId("profile-cabinet-action-account-icon")).toBeVisible();
  await expect(page.getByTestId("profile-cabinet-logout")).toBeVisible();
  await expect(page.locator('[data-testid^="profile-cabinet-action-"]:not([data-testid$="-icon"]):not([data-testid$="-title"]):not([data-testid="profile-cabinet-action-grid"])')).toHaveCount(7);
}

async function expectContentAboveBottomNav(page) {
  const initialScrollTop = await page.evaluate(() => {
    const scroller = document.querySelector('[data-css-module-scope="profile-dashboard-shell"]');
    return scroller?.scrollTop || 0;
  });

  await page.evaluate(() => {
    const scroller = document.querySelector('[data-css-module-scope="profile-dashboard-shell"]');
    scroller?.scrollTo(0, scroller.scrollHeight);
  });

  const metrics = await page.evaluate(() => {
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
      card: rectOf(document.querySelector('[data-testid="profile-dashboard-content"]')),
      bottomNav: rectOf(document.querySelector('[data-testid="client-bottom-nav"]'))
    };
  });

  await page.evaluate((scrollTop) => {
    const scroller = document.querySelector('[data-css-module-scope="profile-dashboard-shell"]');
    scroller?.scrollTo(0, scrollTop);
  }, initialScrollTop);

  expect(metrics.card).not.toBeNull();
  expect(metrics.bottomNav).not.toBeNull();
  expect(metrics.card.bottom).toBeLessThanOrEqual(metrics.bottomNav.y + 1);
}

async function clickClientCabinetNav(page) {
  await expect(page.getByTestId("client-nav-cabinet")).toBeVisible({ timeout: 40_000 });
  await page.getByTestId("client-nav-cabinet").click();
}

test("client main bottom bar stays scoped and adaptive across themes", async ({ page }, testInfo) => {
  const assertNoRuntimeErrors = failOnRuntimeErrors(page);

  for (const theme of ["warm-light", "dark-green"]) {
    for (const width of [320, 390, 1366]) {
      await page.setViewportSize({ width, height: width === 320 ? 720 : 844 });
      await page.goto(`/?clientHarness=1&clientHarnessTheme=${theme}`);

      const navigation = page.getByTestId("client-bottom-nav");
      await expect(navigation).toBeVisible({ timeout: 40_000 });
      await expect(navigation).toHaveAttribute("data-css-module-scope", "client-main-bottom-bar");
      await expect(navigation).not.toHaveClass(/mainMenuBottomBar|profileBottomTabBar|clientBottomNav/);
      await expect(navigation.locator("button")).toHaveCount(4);
      await expect(page.getByTestId("client-nav-main")).toHaveAttribute("aria-current", "page");
      await expectTapTargets(page, ['[data-testid="client-bottom-nav"] button']);
      await expectNoHorizontalOverflow(page);

      const mainMetrics = await navigation.evaluate((node) => {
        const rect = node.getBoundingClientRect();
        const buttonRect = node.querySelector("button")?.getBoundingClientRect();
        const pageRect = document.querySelector('[data-testid="client-harness-main"]')?.getBoundingClientRect();
        return {
          innerWidth: window.innerWidth,
          x: Math.round(rect.x),
          right: Math.round(rect.right),
          pageX: Math.round(pageRect?.x || 0),
          pageRight: Math.round(pageRect?.right || window.innerWidth),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          buttonHeight: Math.round(buttonRect?.height || 0),
          position: getComputedStyle(node).position,
          dockPosition: getComputedStyle(node.parentElement).position
        };
      });

      expect(mainMetrics.position).toBe("relative");
      expect(mainMetrics.dockPosition).toBe("fixed");
      expect(mainMetrics.width).toBeLessThanOrEqual(394);
      expect(mainMetrics.height).toBe(theme === "warm-light" ? 76 : 80);
      expect(mainMetrics.buttonHeight).toBe(theme === "warm-light" ? 58 : 68);
      if (theme === "warm-light" && width <= 900) {
        expect(mainMetrics.x).toBe(mainMetrics.pageX + 10);
        expect(mainMetrics.right).toBe(mainMetrics.pageRight - 10);
      }

      await page.getByTestId("client-nav-cabinet").click();
      await expect(page.getByTestId("client-nav-cabinet")).toHaveAttribute("aria-current", "page");
      const cabinetRect = await navigation.evaluate((node) => {
        const rect = node.getBoundingClientRect();
        return { x: Math.round(rect.x), width: Math.round(rect.width), height: Math.round(rect.height) };
      });
      expect(cabinetRect).toEqual({ x: mainMetrics.x, width: mainMetrics.width, height: mainMetrics.height });

      if (width === 390) {
        await testInfo.attach(`client-bottom-bar-${theme}.png`, {
          body: await navigation.screenshot(),
          contentType: "image/png"
        });
      }
    }
  }

  assertNoRuntimeErrors();
});

test("client primary visual audit covers main dashboard and cabinet", async ({ page }, testInfo) => {
  const assertNoRuntimeErrors = failOnRuntimeErrors(page);

  await page.goto("/?clientHarness=1");
  await expectPrimaryChrome(page, "client-harness-main", "main");
  await expectMainDashboardContent(page);
  await expectMainMeasurementSnapshotLayout(page);
  await expectClientCardTextReadable(page, "main");
  await expectContentAboveBottomNav(page);
  await attachScreenshot(page, testInfo, "client-main-dashboard.png");
  assertNoRuntimeErrors();

  await clickClientCabinetNav(page);
  await expectPrimaryChrome(page, "client-harness-cabinet", "cabinet");
  await expectCabinetContent(page);
  await expectClientCardTextReadable(page, "cabinet");
  await expectContentAboveBottomNav(page);
  await attachScreenshot(page, testInfo, "client-cabinet.png");

  await page.getByTestId("profile-cabinet-action-workout-journal").click();
  await expect(page.getByTestId("profile-workout-journal-dialog")).toBeVisible();
  await expectCrispProfileModal(page, "profile-workout-journal-overlay", "profile-workout-journal-dialog", "profile-workout-journal-close");
  await page.getByRole("tab", { name: "История" }).click();
  await expect(page.getByTestId("profile-workout-history-toggle").first()).toHaveAttribute("aria-label", /тренировку:/);
  await expect(page.getByTestId("profile-workout-history-delete").first()).toHaveAttribute("aria-label", /Удалить тренировку:/);
  await expectTapTargets(page, [
    '[data-testid="profile-workout-journal-close"]',
    '[data-testid="profile-workout-journal-dialog"] [role="tab"]',
    '[data-testid="profile-workout-history-toggle"]',
    '[data-testid="profile-workout-history-delete"]'
  ]);
  await expectNoHorizontalOverflow(page);
  await attachScreenshot(page, testInfo, "client-cabinet-workout-history-modal.png");
  await page.getByTestId("profile-workout-journal-close").click();
  await expect(page.getByTestId("profile-workout-journal-dialog")).toBeHidden();

  await page.goto("/?clientHarness=1&clientCabinetModal=measurements");
  await clickClientCabinetNav(page);
  await expect(page.getByTestId("profile-measurements-dialog")).toBeVisible();
  await expectCrispProfileModal(page, "profile-measurements-overlay", "profile-measurements-dialog", "profile-measurements-close");
  await expect(page.getByTestId("profile-measurements-overlay")).toHaveAttribute("role", "presentation");
  await expect(page.getByTestId("profile-measurements-start")).toHaveAttribute("aria-label", "Начать новый замер тела");
  await expect(page.getByTestId("profile-measurements-cell")).toHaveCount(4);
  await expect(page.getByTestId("profile-measurements-cell").first()).toHaveAttribute("aria-label", /Вес:/);
  await expectTapTargets(page, [
    '[data-testid="profile-measurements-close"]',
    '[data-testid="profile-measurements-start"]'
  ]);
  await expectNoHorizontalOverflow(page);
  await attachScreenshot(page, testInfo, "client-cabinet-measurements-modal.png");
  await page.getByTestId("profile-measurements-close").click();
  await expect(page.getByTestId("profile-measurements-dialog")).toBeHidden();

  await page.goto("/?clientHarness=1&clientCabinetModal=measurements&clientMeasurementsState=empty");
  await clickClientCabinetNav(page);
  await expect(page.getByTestId("profile-measurements-dialog")).toBeVisible();
  await expect(page.getByTestId("profile-measurements-empty")).toBeVisible();
  await expect(page.getByTestId("profile-measurements-cell")).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
  await attachScreenshot(page, testInfo, "client-cabinet-measurements-empty.png");
  await page.getByTestId("profile-measurements-close").click();

  await page.goto("/?clientHarness=1&clientCabinetModal=measurements&clientMeasurementsTabbed=1&clientMeasurementsState=full");
  await clickClientCabinetNav(page);
  await expect(page.getByTestId("profile-measurements-dialog")).toBeVisible();
  await expect(page.getByTestId("profile-measurements-section-tabs")).toBeVisible();
  await expect(page.getByTestId("profile-measurements-section-tabs").getByRole("tab")).toHaveCount(2);
  await expect(page.getByTestId("profile-measurements-section-tabs").getByRole("tab").last()).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("profile-measurements-cell")).toHaveCount(12);
  await expectTapTargets(page, [
    '[data-testid="profile-measurements-section-tabs"] button',
    '[data-testid="profile-measurements-start"]'
  ]);
  await expectNoHorizontalOverflow(page);
  await attachScreenshot(page, testInfo, "client-cabinet-measurements-tabbed.png");
  await page.getByTestId("profile-measurements-close").click();
  await expect(page.getByTestId("profile-measurements-dialog")).toBeHidden();

  await page.goto("/?clientHarness=1&clientCabinetModal=nutrition");
  await clickClientCabinetNav(page);
  await expect(page.getByTestId("profile-nutrition-dialog")).toBeVisible();
  await expectCrispProfileModal(page, "profile-nutrition-overlay", "profile-nutrition-dialog", "profile-nutrition-close");
  await expect(page.getByTestId("profile-nutrition-goal-picker").locator("button[aria-pressed='true']")).toHaveCount(1);
  await expect(page.getByTestId("profile-nutrition-goal-picker").locator("button").first()).toHaveAttribute("aria-label", /Выбрать цель питания:/);
  await expect(page.getByTestId("profile-nutrition-day")).toHaveCount(7);
  await expect(page.locator('[data-testid="profile-nutrition-day"][aria-current="date"]')).toHaveCount(1);
  await expectTapTargets(page, [
    '[data-testid="profile-nutrition-close"]',
    '[data-testid="profile-nutrition-goal-picker"] button',
    '[data-testid="profile-nutrition-save"]',
    '[data-testid="profile-nutrition-previous-week"]',
    '[data-testid="profile-nutrition-next-week"]'
  ]);
  await expectNoHorizontalOverflow(page);
  await attachScreenshot(page, testInfo, "client-cabinet-nutrition-modal.png");
  await page.getByTestId("profile-nutrition-close").click();
  await expect(page.getByTestId("profile-nutrition-dialog")).toBeHidden();

  const originalViewport = page.viewportSize();
  await page.setViewportSize({ width: 320, height: 568 });
  for (const theme of ["warm-light", "dark-green"]) {
    await page.goto(`/?clientHarness=1&clientCabinetModal=nutrition&clientHarnessTheme=${theme}`);
    await clickClientCabinetNav(page);

    const compactContent = page.getByTestId("profile-nutrition-content");
    const compactScroll = await compactContent.evaluate((element) => ({
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
      overflowY: window.getComputedStyle(element).overflowY
    }));
    expect(compactScroll.overflowY).toBe("auto");
    expect(compactScroll.scrollHeight).toBeGreaterThan(compactScroll.clientHeight);

    const compactSave = page.getByTestId("profile-nutrition-save");
    await compactSave.scrollIntoViewIfNeeded();
    await expect(compactSave).toBeVisible();
    const compactBounds = await page.evaluate(() => {
      const content = document.querySelector('[data-testid="profile-nutrition-content"]').getBoundingClientRect();
      const save = document.querySelector('[data-testid="profile-nutrition-save"]').getBoundingClientRect();
      const overlay = document.querySelector('[data-testid="profile-nutrition-overlay"]');
      const bottomNav = document.querySelector('[data-testid="client-bottom-nav"]');
      const centerElement = document.elementFromPoint(save.left + save.width / 2, save.top + save.height / 2);
      return {
        contentTop: content.top,
        contentBottom: content.bottom,
        saveTop: save.top,
        saveBottom: save.bottom,
        overlayZ: Number.parseInt(window.getComputedStyle(overlay).zIndex, 10),
        bottomNavZ: Number.parseInt(window.getComputedStyle(bottomNav.parentElement).zIndex, 10),
        saveIsTopmost: Boolean(centerElement?.closest('[data-testid="profile-nutrition-save"]'))
      };
    });
    expect(compactBounds.saveTop).toBeGreaterThanOrEqual(compactBounds.contentTop - 1);
    expect(compactBounds.saveBottom).toBeLessThanOrEqual(compactBounds.contentBottom + 1);
    expect(compactBounds.overlayZ).toBeGreaterThan(compactBounds.bottomNavZ);
    expect(compactBounds.saveIsTopmost).toBe(true);
    await expectNoHorizontalOverflow(page);
    await page.getByTestId("profile-nutrition-close").click();
  }
  await page.setViewportSize(originalViewport);

  await page.goto("/?clientHarness=1&clientCabinetModal=calendar");
  await clickClientCabinetNav(page);
  await expect(page.getByTestId("profile-workout-journal-dialog")).toBeVisible();
  await expect(page.locator('[data-testid="profile-workout-calendar-day"][aria-pressed="true"]')).toHaveCount(1);
  await expect(page.locator('[data-testid="profile-workout-calendar-day"][aria-current="date"]')).toHaveCount(1);
  await expectTapTargets(page, [
    '[data-testid="profile-workout-journal-close"]',
    '[data-testid="profile-workout-journal-dialog"] [role="tab"]',
    '[data-testid="profile-workout-calendar-shift"]',
    '[data-testid="profile-workout-calendar-edit"]',
    '[data-testid="profile-workout-calendar-history-item"]'
  ]);
  await expectNoHorizontalOverflow(page);
  await attachScreenshot(page, testInfo, "client-cabinet-workout-calendar-modal.png");
  await page.getByTestId("profile-workout-calendar-edit").click();
  await expect(page.getByTestId("profile-workout-calendar-edit-actions")).toBeVisible();
  await expectTapTargets(page, ['[data-testid="profile-workout-calendar-edit-actions"] button']);
  await page.getByTestId("profile-workout-journal-close").click();
  await expect(page.getByTestId("profile-workout-journal-dialog")).toBeHidden();

  await page.goto("/?clientHarness=1&clientCabinetModal=photos");
  await clickClientCabinetNav(page);
  await expect(page.getByTestId("profile-progress-photos-dialog")).toBeVisible();
  await expectCrispProfileModal(page, "profile-progress-photos-overlay", "profile-progress-photos-dialog", "profile-progress-photos-close");
  await expect(page.getByTestId("profile-progress-photos-overlay")).toHaveAttribute("role", "presentation");
  await expect(page.getByTestId("profile-progress-photos-compare-content")).toBeHidden();
  await expect(page.getByTestId("profile-progress-photo-step").first().locator("input")).toHaveAttribute("aria-label", /Добавить фото:/);
  await expectTapTargets(page, [
    '[data-testid="profile-progress-photos-close"]',
    '[data-testid="profile-progress-photo-step"]',
    '[data-testid="profile-progress-photos-compare-toggle"]',
    '[data-testid="profile-progress-photos-save"]'
  ]);
  await page.getByTestId("profile-progress-photos-compare-toggle").click();
  await expect(page.getByTestId("profile-progress-photos-compare-content")).toBeVisible();
  await expect(page.getByTestId("profile-progress-photos-compare-tabs").locator("button[aria-pressed='true']")).toHaveCount(1);
  await expect(page.getByTestId("profile-progress-photos-compare-content").locator("select[aria-label]")).toHaveCount(2);
  await expect(page.getByTestId("profile-progress-photos-compare-stage")).toBeVisible();
  await expectTapTargets(page, ['[data-testid="profile-progress-photos-compare-tabs"] button'], 36);
  await expectNoHorizontalOverflow(page);
  await attachScreenshot(page, testInfo, "client-cabinet-progress-photos-modal.png");
  await page.getByTestId("profile-progress-photos-close").click();
  await expect(page.getByTestId("profile-progress-photos-dialog")).toBeHidden();

  await page.goto("/?clientHarness=1&clientCabinetModal=photos&clientPhotosState=selected");
  await clickClientCabinetNav(page);
  await expect(page.getByTestId("profile-progress-photos-dialog")).toBeVisible();
  await expect(page.locator('[data-photo-view="front"] img')).toBeVisible();
  await expect(page.getByTestId("profile-progress-photos-status")).toHaveText("Фотографии сохранены");
  await expect(page.getByTestId("profile-progress-photos-save")).toBeEnabled();
  await expectNoHorizontalOverflow(page);
  await attachScreenshot(page, testInfo, "client-cabinet-progress-photos-selected.png");
  await page.getByTestId("profile-progress-photos-close").click();

  await page.goto("/?clientHarness=1&clientCabinetModal=photos&clientPhotosTabbed=1");
  await clickClientCabinetNav(page);
  await expect(page.getByTestId("profile-progress-photos-dialog")).toBeVisible();
  await expect(page.getByTestId("profile-progress-photos-section-tabs")).toBeVisible();
  await expect(page.getByTestId("profile-progress-photos-section-tabs").getByRole("tab")).toHaveCount(2);
  await expect(page.getByTestId("profile-progress-photos-section-tabs").getByRole("tab").first()).toHaveAttribute("aria-selected", "true");
  await expectTapTargets(page, ['[data-testid="profile-progress-photos-section-tabs"] button']);
  await expectNoHorizontalOverflow(page);
  await attachScreenshot(page, testInfo, "client-cabinet-progress-photos-tabbed.png");
  await page.getByTestId("profile-progress-photos-close").click();
  await expect(page.getByTestId("profile-progress-photos-dialog")).toBeHidden();

  await page.goto("/?clientHarness=1&clientCabinetModal=settings");
  await clickClientCabinetNav(page);
  await expect(page.getByTestId("profile-settings-dialog")).toBeVisible();
  await expectCrispProfileModal(page, "profile-settings-overlay", "profile-settings-dialog", "profile-settings-close");
  await expect(page.getByTestId("profile-account-section")).toBeVisible();
  await expect(page.getByTestId("profile-account-identity")).toBeVisible();
  await expect(page.getByTestId("profile-account-quick-panel")).toBeVisible();
  await expect(page.getByTestId("profile-settings-email")).toBeVisible();
  await expect(page.getByTestId("profile-settings-theme")).toHaveAttribute("aria-pressed", /^(true|false)$/);
  await expect(page.getByTestId("profile-settings-telegram")).toHaveAttribute("aria-label", /Telegram/);
  await expect(page.getByTestId("profile-settings-logout")).toHaveCount(0);
  await expectTapTargets(page, [
    '[data-testid="profile-settings-close"]',
    '[data-testid="profile-account-avatar"]',
    '[data-testid="profile-account-password"]',
    '[data-testid="profile-settings-email"]',
    '[data-testid="profile-settings-theme"]',
    '[data-testid="profile-settings-telegram"]'
  ]);
  await expectNoHorizontalOverflow(page);
  await attachScreenshot(page, testInfo, "client-cabinet-settings-modal.png");

  await page.getByTestId("profile-account-password").click();
  await expect(page.getByTestId("profile-password-dialog")).toBeVisible();
  await expectCrispProfileModal(page, "profile-password-overlay", "profile-password-dialog", "profile-password-close");
  await expect(page.getByTestId("profile-password-currentPassword")).toBeVisible();
  await expect(page.getByTestId("profile-password-nextPassword")).toBeVisible();
  await expect(page.getByTestId("profile-password-confirmPassword")).toBeVisible();
  await expectTapTargets(page, [
    '[data-testid="profile-password-close"]',
    '[data-testid="profile-password-toggle-currentPassword"]',
    '[data-testid="profile-password-toggle-nextPassword"]',
    '[data-testid="profile-password-toggle-confirmPassword"]',
    '[data-testid="profile-password-reset"]',
    '[data-testid="profile-password-submit"]',
    '[data-testid="profile-password-dismiss"]'
  ]);
  await expectNoHorizontalOverflow(page);
  await attachScreenshot(page, testInfo, "client-password-modal.png");
  await page.getByTestId("profile-password-dismiss").click();
  await expect(page.getByTestId("profile-password-dialog")).toBeHidden();

  await page.getByTestId("profile-settings-email").click();
  await expect(page.getByTestId("profile-email-dialog")).toBeVisible();
  await expectCrispProfileModal(page, "profile-email-overlay", "profile-email-dialog", "profile-email-close");
  await expect(page.getByTestId("profile-email-address")).toBeVisible();
  await expect(page.getByTestId("profile-email-password")).toBeVisible();
  await expectTapTargets(page, [
    '[data-testid="profile-email-close"]',
    '[data-testid="profile-email-submit"]',
    '[data-testid="profile-email-dismiss"]'
  ]);
  await expectNoHorizontalOverflow(page);
  await attachScreenshot(page, testInfo, "client-email-modal.png");
  await page.getByTestId("profile-email-dismiss").click();
  await expect(page.getByTestId("profile-email-dialog")).toBeHidden();

  await page.getByTestId("profile-settings-close").click();
  await expect(page.getByTestId("profile-settings-dialog")).toBeHidden();

  await page.goto("/?clientHarness=1&clientCabinetModal=notifications");
  await clickClientCabinetNav(page);
  await expect(page.getByTestId("profile-trainer-notifications-dialog")).toBeVisible();
  await expectCrispProfileModal(page, "profile-trainer-notifications-overlay", "profile-trainer-notifications-dialog", "profile-trainer-notifications-close");
  await expect(page.getByTestId("profile-trainer-notifications-overlay")).toHaveAttribute("role", "presentation");
  await expect(page.getByTestId("profile-trainer-notification-item")).toHaveCount(2);
  await expect(page.getByTestId("profile-trainer-notification-item").first()).toHaveAttribute("aria-label", /Задача тренера:/);
  await expect(page.getByTestId("profile-trainer-notification-item").first()).toHaveAttribute("data-task-status", "overdue");
  await expectTapTargets(page, [
    '[data-testid="profile-trainer-notifications-close"]',
    '[data-testid="profile-trainer-notification-item"]'
  ]);
  await expectNoHorizontalOverflow(page);
  await attachScreenshot(page, testInfo, "client-cabinet-trainer-notifications-modal.png");
  await page.getByTestId("profile-trainer-notifications-close").click();
  await expect(page.getByTestId("profile-trainer-notifications-dialog")).toBeHidden();

  await page.goto("/?clientHarness=1&clientCabinetModal=notifications&clientNotificationState=empty");
  await clickClientCabinetNav(page);
  await expect(page.getByTestId("profile-trainer-notifications-dialog")).toBeVisible();
  await expect(page.getByTestId("profile-trainer-notifications-empty")).toBeVisible();
  await expect(page.getByTestId("profile-trainer-notification-item")).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
  await attachScreenshot(page, testInfo, "client-cabinet-trainer-notifications-empty.png");
  await page.getByTestId("profile-trainer-notifications-close").click();
  await expect(page.getByTestId("profile-trainer-notifications-dialog")).toBeHidden();

  await page.goto("/?clientHarness=1&clientCabinetModal=telegram");
  await clickClientCabinetNav(page);
  await expect(page.getByTestId("profile-telegram-dialog")).toBeVisible();
  await expectCrispProfileModal(page, "profile-telegram-overlay", "profile-telegram-dialog", "profile-telegram-close");
  await expect(page.getByTestId("profile-telegram-overlay")).toHaveAttribute("role", "presentation");
  await expect(page.getByTestId("profile-telegram-dialog")).toHaveAttribute("role", "dialog");
  await expect(page.getByTestId("profile-telegram-dialog")).toHaveAttribute("aria-modal", "true");
  await expect(page.getByTestId("profile-telegram-close")).toHaveAttribute("aria-label", /Telegram$/);
  await expect(page.getByTestId("profile-telegram-actions")).toBeVisible();
  await expectTapTargets(page, [
    '[data-testid="profile-telegram-close"]',
    '[data-testid="profile-telegram-change"]',
    '[data-testid="profile-telegram-disconnect"]',
    '[data-testid="profile-telegram-dismiss"]'
  ]);
  await expectNoHorizontalOverflow(page);
  await attachScreenshot(page, testInfo, "client-cabinet-telegram-connected-modal.png");
  await page.getByTestId("profile-telegram-dismiss").click();
  await expect(page.getByTestId("profile-telegram-dialog")).toBeHidden();

  await page.goto("/?clientHarness=1&clientCabinetModal=telegram&clientTelegramState=disconnected");
  await clickClientCabinetNav(page);
  await expect(page.getByTestId("profile-telegram-dialog")).toBeVisible();
  await expect(page.getByTestId("profile-telegram-widget-card")).toBeVisible();
  await expect(page.getByTestId("profile-telegram-widget-loading")).toBeVisible();
  await expect(page.getByTestId("profile-telegram-check")).toBeEnabled();
  await expectTapTargets(page, [
    '[data-testid="profile-telegram-close"]',
    '[data-testid="profile-telegram-check"]',
    '[data-testid="profile-telegram-dismiss"]'
  ]);
  await expectNoHorizontalOverflow(page);
  await attachScreenshot(page, testInfo, "client-cabinet-telegram-disconnected-modal.png");
  await page.getByTestId("profile-telegram-dismiss").click();
  await expect(page.getByTestId("profile-telegram-dialog")).toBeHidden();

  assertNoRuntimeErrors();
});

test("client measurement summary and fullscreen wizard stay adaptive", async ({ page }, testInfo) => {
  const assertNoRuntimeErrors = failOnRuntimeErrors(page);
  const isCompactMobile = testInfo.project.name === "mobile-chromium";

  if (isCompactMobile) {
    await page.setViewportSize({ width: 320, height: 568 });
  }

  await page.goto("/?clientHarness=1&clientHarnessPage=measurementPanel");
  await expect(page.getByTestId("profile-measurement-panel")).toBeVisible();
  await expect(page.getByTestId("profile-measurement-dashboard")).toBeVisible();
  await expect(page.getByTestId("profile-measurement-last-value")).toHaveCount(6);
  await expect(page.getByTestId("profile-measurement-start")).toBeVisible();
  await expectTapTargets(page, ['[data-testid="profile-measurement-start"]']);
  await expectNoHorizontalOverflow(page);
  if (isCompactMobile) {
    const panelFit = await page.getByTestId("profile-measurement-panel").evaluate((panel) => {
      const start = panel.querySelector('[data-testid="profile-measurement-start"]');
      const panelRect = panel.getBoundingClientRect();
      const startRect = start?.getBoundingClientRect();
      return {
        panelBottom: panelRect.bottom,
        startBottom: startRect?.bottom ?? Number.POSITIVE_INFINITY,
        viewportHeight: window.innerHeight
      };
    });
    expect(panelFit.startBottom).toBeLessThanOrEqual(panelFit.panelBottom + 1);
    expect(panelFit.startBottom).toBeLessThanOrEqual(panelFit.viewportHeight + 1);
  }
  await attachScreenshot(page, testInfo, "client-measurement-summary.png");

  await page.goto("/?clientHarness=1&clientHarnessPage=measurementWizard&clientMeasurementStep=intro");
  await expect(page.getByTestId("measurement-wizard-page")).toBeVisible();
  await expect(page.getByTestId("measurement-wizard-intro")).toBeVisible();
  await expectTapTargets(page, [
    '[data-testid="measurement-wizard-page"] button[aria-label="Закрыть без сохранения"]',
    '[data-testid="measurement-wizard-navigation"] button'
  ]);
  await expectNoHorizontalOverflow(page);
  if (isCompactMobile) {
    const introHeight = await page.getByTestId("measurement-wizard-intro").evaluate((intro) => (
      intro.getBoundingClientRect().height
    ));
    expect(introHeight).toBeGreaterThanOrEqual(170);
  }
  await attachScreenshot(page, testInfo, "client-measurement-wizard-intro.png");

  await page.getByTestId("measurement-wizard-navigation").getByRole("button", { name: "Вперёд →" }).click();
  await expect(page.getByTestId("measurement-wizard-measurement")).toBeVisible();
  await expect(page.getByTestId("measurement-wizard-measurement").locator("input[data-css-module-control]")).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await attachScreenshot(page, testInfo, "client-measurement-wizard-step.png");

  await page.goto("/?clientHarness=1&clientHarnessPage=measurementWizard&clientMeasurementStep=review");
  await expect(page.getByTestId("measurement-wizard-review")).toBeVisible();
  await expect(page.getByTestId("measurement-wizard-review-cell")).toHaveCount(12);
  await expect(page.getByTestId("measurement-wizard-review").locator("textarea[data-css-module-control]")).toBeVisible();
  await expectTapTargets(page, ['[data-testid="measurement-wizard-navigation"] button']);
  await expectNoHorizontalOverflow(page);
  if (isCompactMobile) {
    const reviewGridHeight = await page.getByTestId("measurement-wizard-review").evaluate((review) => (
      review.getBoundingClientRect().height
    ));
    expect(reviewGridHeight).toBeGreaterThanOrEqual(180);
  }
  await attachScreenshot(page, testInfo, "client-measurement-wizard-review.png");

  await page.goto("/?clientHarness=1&clientHarnessPage=measurementWizard&clientMeasurementStep=measurement&clientHarnessTheme=dark-green");
  await expect(page.getByTestId("measurement-wizard-measurement")).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-app-theme", "dark-green");
  await expectNoHorizontalOverflow(page);
  await attachScreenshot(page, testInfo, "client-measurement-wizard-dark.png");

  assertNoRuntimeErrors();
});

test("client profile role actions stay scoped and adaptive", async ({ page }, testInfo) => {
  const assertNoRuntimeErrors = failOnRuntimeErrors(page);

  await page.goto("/?clientHarness=1&clientHarnessPage=profileRoleActions");
  await expect(page.getByTestId("profile-main-role-actions")).toBeVisible();
  await expect(page.getByTestId("profile-main-role-trainer")).toBeVisible();
  await expect(page.getByTestId("profile-main-role-admin")).toBeVisible();
  await expectTapTargets(page, [
    '[data-testid="profile-main-role-trainer"]',
    '[data-testid="profile-main-role-admin"]'
  ]);
  await expectNoHorizontalOverflow(page);

  const lightMetrics = await page.getByTestId("profile-main-role-actions").evaluate((root) => ({
    rootWidth: root.getBoundingClientRect().width,
    buttons: [...root.querySelectorAll("button")].map((button) => {
      const rect = button.getBoundingClientRect();
      return { width: rect.width, height: rect.height };
    })
  }));
  expect(lightMetrics.buttons).toHaveLength(2);
  expect(lightMetrics.buttons.every(({ height }) => height >= 48)).toBe(true);
  expect(lightMetrics.buttons.every(({ width }) => width >= ((lightMetrics.rootWidth - 8) / 2) - 1)).toBe(true);
  await attachScreenshot(page, testInfo, "client-profile-role-actions.png");

  await page.goto("/?clientHarness=1&clientHarnessPage=profileRoleActions&clientHarnessTheme=dark-green");
  await expect(page.locator("html")).toHaveAttribute("data-app-theme", "dark-green");
  await expect(page.getByTestId("profile-main-role-actions")).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await attachScreenshot(page, testInfo, "client-profile-role-actions-dark.png");

  assertNoRuntimeErrors();
});

test("client profile settings title stays scoped and adaptive", async ({ page }, testInfo) => {
  const assertNoRuntimeErrors = failOnRuntimeErrors(page);

  if (testInfo.project.name === "mobile-chromium") {
    await page.setViewportSize({ width: 320, height: 568 });
  }

  await page.goto("/?clientHarness=1&clientHarnessPage=profileSettingsTab");
  await expect(page.getByTestId("profile-settings-tab-title")).toBeVisible();
  await expectNoHorizontalOverflow(page);

  const lightTitle = await page.getByTestId("profile-settings-tab-title").evaluate((title) => {
    const style = getComputedStyle(title);
    const rect = title.getBoundingClientRect();
    return {
      height: rect.height,
      marginBottom: style.marginBottom,
      fontSize: style.fontSize,
      lineHeight: style.lineHeight,
      color: style.color,
      textAlign: style.textAlign,
      textTransform: style.textTransform
    };
  });
  expect(lightTitle).toEqual({
    height: 15.75,
    marginBottom: "32px",
    fontSize: "15px",
    lineHeight: "15.75px",
    color: "rgb(40, 38, 46)",
    textAlign: "center",
    textTransform: "uppercase"
  });
  await attachScreenshot(page, testInfo, "client-profile-settings-tab.png");

  await page.goto("/?clientHarness=1&clientHarnessPage=profileSettingsTab&clientHarnessTheme=dark-green");
  await expect(page.locator("html")).toHaveAttribute("data-app-theme", "dark-green");
  await expect(page.getByTestId("profile-settings-tab-title")).toHaveCSS("color", "rgb(169, 209, 63)");
  await expectNoHorizontalOverflow(page);
  await attachScreenshot(page, testInfo, "client-profile-settings-tab-dark.png");

  assertNoRuntimeErrors();
});

test("client avatar crop editor stays visually contained", async ({ page }, testInfo) => {
  const assertNoRuntimeErrors = failOnRuntimeErrors(page);

  await page.goto("/?clientHarness=1&clientHarnessPage=avatarCrop");
  await expect(page.getByTestId("client-harness-avatar-crop")).toBeAttached();
  await expect(page.getByTestId("profile-avatar-crop-dialog")).toBeVisible();
  await expectCrispProfileModal(page, "profile-avatar-crop-overlay", "profile-avatar-crop-dialog", "profile-avatar-crop-close");
  await expect(page.getByTestId("profile-avatar-crop-viewport")).toBeVisible();
  await expect(page.getByTestId("profile-avatar-crop-zoom").locator("input")).toHaveAttribute("aria-label", "Масштаб аватара");
  await expectTapTargets(page, [
    '[data-testid="profile-avatar-crop-cancel"]',
    '[data-testid="profile-avatar-crop-apply"]'
  ]);
  await expectTapTargets(page, ['[data-testid="profile-avatar-crop-close"]'], 36);
  const cropBounds = await page.getByTestId("profile-avatar-crop-dialog").evaluate((dialog) => {
    const rect = dialog.getBoundingClientRect();
    return {
      top: rect.top,
      bottom: rect.bottom,
      viewportHeight: window.innerHeight,
      scrollHeight: dialog.scrollHeight,
      clientHeight: dialog.clientHeight
    };
  });
  expect(cropBounds.top).toBeGreaterThanOrEqual(13);
  expect(cropBounds.bottom).toBeLessThanOrEqual(cropBounds.viewportHeight - 13);
  expect(cropBounds.clientHeight).toBeLessThanOrEqual(cropBounds.viewportHeight - 28);
  await expectNoHorizontalOverflow(page);
  await attachScreenshot(page, testInfo, "client-profile-avatar-crop-modal.png");
  await page.getByTestId("profile-avatar-crop-apply").click();
  await expect(page.getByTestId("profile-avatar-crop-dialog")).toBeHidden();

  assertNoRuntimeErrors();
});

test("client first setup visual audit covers selected choices", async ({ page }, testInfo) => {
  const assertNoRuntimeErrors = failOnRuntimeErrors(page);

  await page.goto("/?clientHarness=1&clientHarnessPage=firstSetup&clientFirstSetupStep=1");
  await expect(page.getByTestId("client-harness-first-setup")).toBeAttached();
  await expect(page.locator(".firstSetupOverlay")).toBeVisible();
  await expect(page.locator(".firstSetupSexGrid button[aria-pressed='true']")).toHaveCount(1);
  await expectTapTargets(page, [".firstSetupSexGrid button", ".firstSetupPrimary", ".firstSetupSecondary"]);
  await expectNoHorizontalOverflow(page);
  await attachScreenshot(page, testInfo, "client-first-setup-sex.png");

  await page.goto("/?clientHarness=1&clientHarnessPage=firstSetup&clientFirstSetupStep=6");
  await expect(page.getByTestId("client-harness-first-setup")).toBeAttached();
  await expect(page.locator(".firstSetupOverlay")).toBeVisible();
  await expect(page.locator(".firstSetupActivityList button[aria-pressed='true']")).toHaveCount(1);
  await expectTapTargets(page, [".firstSetupActivityList button", ".firstSetupPrimary", ".firstSetupSecondary"]);
  await expectNoHorizontalOverflow(page);

  await page.goto("/?clientHarness=1&clientHarnessPage=firstSetup&clientFirstSetupStep=7");
  await expect(page.getByTestId("client-harness-first-setup")).toBeAttached();
  await expect(page.locator(".firstSetupOverlay")).toBeVisible();
  await expect(page.locator(".firstSetupGoalGrid button[aria-pressed='true']")).toHaveCount(1);
  await expectTapTargets(page, [".firstSetupGoalGrid button", ".firstSetupPrimary", ".firstSetupSecondary"]);
  await expectNoHorizontalOverflow(page);

  await page.locator(".firstSetupGoalGrid button").first().click();
  await expect(page.locator(".firstSetupGoalGrid button[aria-pressed='true']")).toHaveCount(1);
  await expect(page.locator(".firstSetupGoalGrid button").first()).toHaveAttribute("aria-pressed", "true");
  assertNoRuntimeErrors();
});
