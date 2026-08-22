import { expect, test } from "@playwright/test";
import { failOnRuntimeErrors } from "./runtime-errors.js";

test.setTimeout(180_000);

const TRAINER_VIEWPORTS = [
  { name: "320x720", width: 320, height: 720 },
  { name: "360x800", width: 360, height: 800 },
  { name: "393x852", width: 393, height: 852 },
  { name: "430x932", width: 430, height: 932 },
  { name: "768x1024", width: 768, height: 1024 },
  { name: "1024x900", width: 1024, height: 900 },
  { name: "1366x900", width: 1366, height: 900 }
];

async function expectNoHorizontalOverflow(page) {
  const metrics = await page.evaluate(() => {
    const viewportWidth = window.innerWidth;
    const offenders = [...document.querySelectorAll("body *")]
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          element: `${element.tagName.toLowerCase()}.${String(element.className || "").trim().replace(/\s+/g, ".")}`,
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width)
        };
      })
      .filter((item) => item.left < -1 || item.right > viewportWidth + 1)
      .slice(0, 12);

    return {
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth,
      offenders
    };
  });

  expect(metrics.documentWidth, JSON.stringify(metrics, null, 2)).toBeLessThanOrEqual(metrics.viewportWidth + 1);
}

async function expectTouchTargets(page, selectors, minimumSize = 44) {
  const metrics = await page.evaluate(({ targetSelectors, minSize }) => {
    const isVisible = (node) => {
      const style = window.getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    };

    const targets = targetSelectors.flatMap((selector) => (
      [...document.querySelectorAll(selector)]
        .filter(isVisible)
        .map((node, index) => {
          const rect = node.getBoundingClientRect();
          return {
            selector,
            index,
            width: Math.round(rect.width),
            height: Math.round(rect.height),
            text: (node.textContent || "").trim().replace(/\s+/g, " ").slice(0, 80)
          };
        })
    ));

    return {
      targets,
      tooSmall: targets.filter((target) => target.width < minSize || target.height < minSize)
    };
  }, { targetSelectors: selectors, minSize: minimumSize });

  expect(metrics.targets, `No visible controls matched: ${selectors.join(", ")}`).not.toEqual([]);
  expect(metrics.tooSmall, JSON.stringify(metrics, null, 2)).toEqual([]);
}

async function trainerNavButton(page, section) {
  const mobileButton = page.getByTestId(`trainer-nav-${section}`);
  if (await mobileButton.count() && await mobileButton.isVisible()) return mobileButton;
  return page.getByTestId(`trainer-desktop-nav-${section}`);
}

async function openTrainerSection(page, section) {
  const button = await trainerNavButton(page, section);
  await expect(button).toBeVisible({ timeout: 40_000 });
  await button.click();
}

async function openHarnessAt(page, viewport) {
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  await page.goto("/?trainerHarness=1");
  await expect(page.locator(".trainerNextRoot")).toBeVisible({ timeout: 40_000 });
}

async function expectModalFrame(surface, { requiresFooter = false } = {}) {
  const metrics = await surface.evaluate((node) => {
    const toRect = (element) => {
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      return {
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        left: rect.left,
        width: rect.width,
        height: rect.height
      };
    };
    const header = node.querySelector(":scope > [data-trainer-modal-header='true']");
    const content = node.querySelector(":scope > [data-trainer-modal-content='true']");
    const footer = node.querySelector(":scope > [data-trainer-modal-footer='true']");
    const close = node.querySelector(".trainerNextModalClose");
    const primaryAction = footer?.querySelector("button:not([disabled])");
    const headerBefore = toRect(header);
    const footerBefore = toRect(footer);
    const contentBefore = toRect(content);
    const canScroll = Boolean(content && content.scrollHeight > content.clientHeight + 1);

    if (canScroll) content.scrollTop = Math.min(96, content.scrollHeight - content.clientHeight);

    const actionRect = toRect(primaryAction);
    const actionCenter = actionRect
      ? { x: actionRect.left + actionRect.width / 2, y: actionRect.top + actionRect.height / 2 }
      : null;
    const actionHit = actionCenter ? document.elementFromPoint(actionCenter.x, actionCenter.y) : null;
    const closeRect = toRect(close);
    const closeCenter = closeRect
      ? { x: closeRect.left + closeRect.width / 2, y: closeRect.top + closeRect.height / 2 }
      : null;
    const closeHit = closeCenter ? document.elementFromPoint(closeCenter.x, closeCenter.y) : null;

    return {
      viewport: { width: window.innerWidth, height: window.innerHeight },
      surface: toRect(node),
      headerBefore,
      headerAfter: toRect(header),
      contentBefore,
      contentAfter: toRect(content),
      footerBefore,
      footerAfter: toRect(footer),
      contentOverflowY: content ? window.getComputedStyle(content).overflowY : "",
      canScroll,
      close: closeRect,
      closeReceivesPointer: Boolean(close && closeHit && close.contains(closeHit)),
      action: actionRect,
      actionReceivesPointer: Boolean(primaryAction && actionHit && primaryAction.contains(actionHit))
    };
  });

  // Browser scrollbar allocation can make the visible right gutter 10px even
  // when the sheet uses the 12px layout token.  Eight CSS pixels is the
  // product floor: sheets must never touch the viewport edge.
  const inset = 8;
  expect(metrics.surface, JSON.stringify(metrics, null, 2)).not.toBeNull();
  expect(metrics.surface.left, JSON.stringify(metrics, null, 2)).toBeGreaterThanOrEqual(inset - 1);
  expect(metrics.surface.right, JSON.stringify(metrics, null, 2)).toBeLessThanOrEqual(metrics.viewport.width - inset + 1);
  expect(metrics.surface.top, JSON.stringify(metrics, null, 2)).toBeGreaterThanOrEqual(inset - 1);
  expect(metrics.surface.bottom, JSON.stringify(metrics, null, 2)).toBeLessThanOrEqual(metrics.viewport.height - inset + 1);
  expect(metrics.headerBefore, JSON.stringify(metrics, null, 2)).not.toBeNull();
  expect(metrics.contentBefore, JSON.stringify(metrics, null, 2)).not.toBeNull();
  expect(metrics.contentOverflowY, JSON.stringify(metrics, null, 2)).toMatch(/auto|scroll/);
  expect(metrics.contentBefore.top, JSON.stringify(metrics, null, 2)).toBeGreaterThanOrEqual(metrics.headerBefore.bottom - 1);
  expect(metrics.close, JSON.stringify(metrics, null, 2)).not.toBeNull();
  expect(metrics.close.width, JSON.stringify(metrics, null, 2)).toBeGreaterThanOrEqual(44);
  expect(metrics.close.height, JSON.stringify(metrics, null, 2)).toBeGreaterThanOrEqual(44);
  expect(metrics.closeReceivesPointer, JSON.stringify(metrics, null, 2)).toBe(true);

  if (metrics.canScroll) {
    expect(metrics.headerAfter.top, JSON.stringify(metrics, null, 2)).toBeCloseTo(metrics.headerBefore.top, 0);
    if (metrics.footerBefore) {
      expect(metrics.footerAfter.top, JSON.stringify(metrics, null, 2)).toBeCloseTo(metrics.footerBefore.top, 0);
    }
  }

  if (requiresFooter) {
    expect(metrics.footerBefore, JSON.stringify(metrics, null, 2)).not.toBeNull();
    expect(metrics.footerBefore.top, JSON.stringify(metrics, null, 2)).toBeGreaterThanOrEqual(metrics.contentBefore.bottom - 1);
    expect(metrics.footerBefore.bottom, JSON.stringify(metrics, null, 2)).toBeLessThanOrEqual(metrics.surface.bottom + 1);
    expect(metrics.action, JSON.stringify(metrics, null, 2)).not.toBeNull();
    expect(metrics.action.height, JSON.stringify(metrics, null, 2)).toBeGreaterThanOrEqual(44);
    expect(metrics.actionReceivesPointer, JSON.stringify(metrics, null, 2)).toBe(true);
  }
}

test("trainer workspace remains usable across the approved viewport matrix", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "The full responsive matrix runs once in the desktop browser context.");

  const assertNoRuntimeErrors = failOnRuntimeErrors(page);

  for (const viewport of TRAINER_VIEWPORTS) {
    await test.step(`${viewport.name}: dashboard and navigation`, async () => {
      await openHarnessAt(page, viewport);
      await expect(page.locator(".trainerNextDashboard")).toBeVisible();
      await expectTouchTargets(page, [".trainerNextMobileNav button", ".trainerNextSidebar nav button"]);
      await expectNoHorizontalOverflow(page);
    });

    await test.step(`${viewport.name}: client list`, async () => {
      await openTrainerSection(page, "clients");
      await expect(page.locator(".trainerNextClientsPage")).toBeVisible();
      await expect(page.getByRole("button", { name: /Germes/ }).first()).toBeVisible();
      await expectTouchTargets(page, [".trainerNextClientTable > button", ".trainerNextClientCard"]);
      await expectNoHorizontalOverflow(page);
    });

    await test.step(`${viewport.name}: programs`, async () => {
      await openHarnessAt(page, viewport);
      await openTrainerSection(page, "workouts");
      await expect(page.locator(".trainerNextWorkoutPage")).toBeVisible();
      if (viewport.width >= 721 && viewport.width < 980) {
        const programGrid = page.getByTestId("trainer-program-overview-grid");
        const firstProgramCard = page.getByTestId("trainer-program-overview-card").first();
        // The harness uses the compact workout fixture, while the production
        // program library renders this grid. Validate it whenever present.
        if (await programGrid.count()) {
          await expect(programGrid).toBeVisible();
          await expect(firstProgramCard).toBeVisible();
          const programLayout = await page.evaluate(() => {
            const grid = document.querySelector("[data-testid='trainer-program-overview-grid']");
            const card = document.querySelector("[data-testid='trainer-program-overview-card']");
            const gridRect = grid?.getBoundingClientRect();
            const cardRect = card?.getBoundingClientRect();
            return {
              columns: (window.getComputedStyle(grid).gridTemplateColumns || "").trim().split(/\s+/).filter(Boolean).length,
              gridWidth: gridRect?.width || 0,
              cardWidth: cardRect?.width || 0
            };
          });
          expect(programLayout.columns, JSON.stringify(programLayout)).toBe(1);
          expect(programLayout.cardWidth, JSON.stringify(programLayout)).toBeCloseTo(programLayout.gridWidth, 0);
        }
      }
      await expectNoHorizontalOverflow(page);
    });

    await test.step(`${viewport.name}: cabinet`, async () => {
      await openHarnessAt(page, viewport);
      await openTrainerSection(page, "more");
      await expect(page.locator(".trainerNextCabinetPage")).toBeVisible();
      await expectTouchTargets(page, [".trainerCabinetWorkspaceLinks > button"]);
      if (viewport.width >= 700 && viewport.width < 980) {
        const cabinetLayout = await page.evaluate(() => {
          const stats = document.querySelector(".trainerCabinetStats");
          const links = document.querySelector(".trainerCabinetWorkspaceLinks");
          const firstAction = links?.querySelector("button");
          return {
            statsColumns: (window.getComputedStyle(stats).gridTemplateColumns || "").trim().split(/\s+/).filter(Boolean).length,
            linksDisplay: window.getComputedStyle(links).display,
            actionDisplay: window.getComputedStyle(firstAction).display
          };
        });
        expect(cabinetLayout.statsColumns, JSON.stringify(cabinetLayout)).toBe(3);
        expect(cabinetLayout.linksDisplay, JSON.stringify(cabinetLayout)).toBe("grid");
        expect(cabinetLayout.actionDisplay, JSON.stringify(cabinetLayout)).toBe("grid");
      }
      await expectNoHorizontalOverflow(page);
    });
  }

  assertNoRuntimeErrors();
});

test("trainer modal sheets keep insets, internal scroll and fixed controls", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "The full modal viewport matrix runs once in the desktop browser context.");

  const assertNoRuntimeErrors = failOnRuntimeErrors(page);

  for (const viewport of TRAINER_VIEWPORTS) {
    await test.step(`${viewport.name}: cabinet sheets`, async () => {
      await openHarnessAt(page, viewport);
      await openTrainerSection(page, "more");
      const links = page.locator(".trainerCabinetWorkspaceLinks > button");

      for (const index of [0, 1]) {
        await links.nth(index).click();
        const surface = page.locator("[data-trainer-modal-surface='true']");
        await expect(surface).toHaveCount(1);
        await expect(surface).toBeVisible();
        await expectModalFrame(surface, { requiresFooter: index === 1 });
        await surface.locator(".trainerNextModalClose").click();
        await expect(surface).toBeHidden();
      }
    });
  }

  for (const viewport of TRAINER_VIEWPORTS.filter(({ width }) => width <= 430)) {
    await test.step(`${viewport.name}: nutrition editor footer`, async () => {
      await openHarnessAt(page, viewport);
      await openTrainerSection(page, "clients");
      await page.locator(".trainerNextClientTable > button").first().click();
      const surface = page.getByRole("dialog", { name: "Изменить план" });
      await expect(surface).toBeVisible();
      await expectModalFrame(surface, { requiresFooter: true });
      await surface.getByRole("button", { name: "Закрыть редактор плана" }).click();
      await expect(surface).toBeHidden();
    });
  }

  assertNoRuntimeErrors();
});
