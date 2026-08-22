import { expect, test } from "@playwright/test";
import { failOnRuntimeErrors } from "./runtime-errors.js";

const COLD_LOAD_TIMEOUT = 40_000;

// The first mobile navigation compiles several lazy admin modules in the Vite
// test server. Keep the test budget above the explicit cold-load allowance so
// the suite can report a genuine readiness failure instead of timing out first.
test.describe.configure({ timeout: 60_000 });

async function openAdminHarness(page, url, readyLocator) {
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("admin-harness-root")).toBeVisible({ timeout: COLD_LOAD_TIMEOUT });
  await expect(readyLocator).toBeVisible({ timeout: COLD_LOAD_TIMEOUT });
}

async function expectNoHorizontalOverflow(page) {
  const metrics = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
    overflowElements: [...document.querySelectorAll("body *")]
      .map((node) => {
        const rect = node.getBoundingClientRect();
        const style = window.getComputedStyle(node);
        const parents = [];
        let parent = node.parentElement;
        while (parent && parents.length < 4) {
          const parentRect = parent.getBoundingClientRect();
          parents.push({
            tag: parent.tagName.toLowerCase(),
            className: typeof parent.className === "string" ? parent.className : "",
            width: Math.round(parentRect.width),
            left: Math.round(parentRect.left),
            right: Math.round(parentRect.right)
          });
          parent = parent.parentElement;
        }
        return {
          tag: node.tagName.toLowerCase(),
          className: typeof node.className === "string" ? node.className : "",
          width: Math.round(rect.width),
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          computedWidth: style.width,
          maxWidth: style.maxWidth,
          boxSizing: style.boxSizing,
          minWidth: style.minWidth,
          display: style.display,
          position: style.position,
          paddingLeft: style.paddingLeft,
          paddingRight: style.paddingRight,
          marginLeft: style.marginLeft,
          marginRight: style.marginRight,
          parents
        };
      })
      .filter((item) => item.right > window.innerWidth + 1 || item.left < -1 || item.width > window.innerWidth + 1)
      .slice(0, 8)
  }));

  expect(metrics.documentWidth, JSON.stringify(metrics.overflowElements, null, 2)).toBeLessThanOrEqual(metrics.viewportWidth + 1);
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

test("admin panel hub visual audit covers cards and denied state", async ({ page }, testInfo) => {
  const assertNoRuntimeErrors = failOnRuntimeErrors(page);

  await openAdminHarness(page, "/?adminHarness=1", page.locator(".adminPanelHubPage"));
  await expect(page.locator(".adminPanelHubHero h1")).toBeVisible();
  await expect(page.locator(".adminPanelHubCard")).toHaveCount(3);
  await expectTapTargets(page, [".adminFixedMainBack", ".adminPanelHubCard"]);
  await expectNoHorizontalOverflow(page);
  await attachScreenshot(page, testInfo, "admin-panel-hub.png");

  await page.locator(".adminPanelHubCard").nth(0).click();
  await expect(page.getByTestId("admin-harness-action")).toHaveText("page:adminUsers");
  await page.locator(".adminPanelHubCard").nth(1).click();
  await expect(page.getByTestId("admin-harness-action")).toHaveText("programs");
  await page.locator(".adminPanelHubCard").nth(2).click();
  await expect(page.getByTestId("admin-harness-action")).toHaveText("page:admin");
  await page.locator(".adminFixedMainBack").click();
  await expect(page.getByTestId("admin-harness-action")).toHaveText("page:main");
  assertNoRuntimeErrors();

  await openAdminHarness(page, "/?adminHarness=1&adminAccess=denied", page.locator(".historyEmptyCard"));
  await expect(page.locator(".historyEmptyCard")).toContainText("Доступ");
  await expectTapTargets(page, [".backBtn"]);
  await expectNoHorizontalOverflow(page);
  await attachScreenshot(page, testInfo, "admin-panel-denied.png");
  await page.locator(".backBtn").click();
  await expect(page.getByTestId("admin-harness-action")).toHaveText("page:main");
  assertNoRuntimeErrors();
});

test("admin visual audit covers CRM and program internals harness", async ({ page }, testInfo) => {
  const assertNoRuntimeErrors = failOnRuntimeErrors(page);

  await openAdminHarness(page, "/?adminHarness=1&adminSurface=users", page.getByTestId("admin-users-harness"));
  await expect(page.locator(".adminUsersCrmHeader h1")).toBeVisible();
  await expect(page.locator(".adminClientCard")).toHaveCount(3);
  await expect(page.locator(".adminUsersFilterPills button[aria-pressed='true']")).toHaveCount(1);
  await expect(page.locator(".adminClientCardsGrid .adminClientCard[aria-pressed='true']")).toHaveCount(1);
  await expect(page.locator(".adminClientWorkspaceCrmPage")).toBeVisible();
  await expect(page.locator(".adminClientTabsCrm button[aria-pressed='true']")).toHaveCount(1);
  await expectTapTargets(page, [
    ".adminUsersFilterPills button",
    ".adminClientCard",
    ".adminClientTabsCrm button"
  ]);
  await expectNoHorizontalOverflow(page);
  await attachScreenshot(page, testInfo, "admin-users-crm-harness.png");

  await page.locator(".adminClientAddCard").click();
  await expect(page.getByTestId("admin-harness-action")).toHaveText("create-client");
  assertNoRuntimeErrors();

  await openAdminHarness(page, "/?adminHarness=1&adminSurface=programs", page.getByTestId("admin-programs-harness"));
  await expect(page.locator(".programsCompactHeader h1")).toBeVisible();
  await expect(page.locator(".programsOverviewCard")).toHaveCount(3);
  await expect(page.locator(".programsOverviewCard[aria-pressed='true']")).toHaveCount(1);
  await expectTapTargets(page, [
    ".adminFixedMainBack",
    ".programsOverviewCard"
  ]);
  await expectNoHorizontalOverflow(page);
  await attachScreenshot(page, testInfo, "admin-programs-overview-harness.png");

  await page.locator(".programsOverviewCard").nth(1).click();
  await expect(page.getByTestId("admin-harness-action")).toHaveText("program:Fat Loss");
  await page.locator(".adminFixedMainBack").click();
  await expect(page.getByTestId("admin-harness-action")).toHaveText("programs-back");
  assertNoRuntimeErrors();

  await openAdminHarness(page, "/?adminHarness=1&adminSurface=calendar", page.getByTestId("admin-calendar-harness"));
  await expect(page.locator(".adminCalendarPanel")).toBeVisible();
  await expect(page.locator(".adminCalendarDays button[aria-pressed='true']")).toHaveCount(3);
  await expect(page.locator(".adminCalendarHourReminder[aria-pressed='true']")).toHaveCount(2);
  await expect(page.locator(".adminCalendarToggles button[aria-pressed='true']")).toHaveCount(2);
  await expectTapTargets(page, [
    ".adminCalendarDays button",
    ".adminCalendarHourReminder",
    ".adminCalendarToggles button",
    ".adminCalendarSaveButton",
    ".adminCalendarTestButton"
  ]);
  await expectNoHorizontalOverflow(page);
  await attachScreenshot(page, testInfo, "admin-calendar-harness.png");

  await page.locator(".adminCalendarDays button").nth(1).click();
  await expect(page.getByTestId("admin-calendar-days")).toContainText("tuesday");
  await page.locator(".adminCalendarSaveButton").click();
  await expect(page.getByTestId("admin-harness-action")).toHaveText("calendar-save");
  assertNoRuntimeErrors();
});
