import { expect, test } from "@playwright/test";
import { failOnRuntimeErrors } from "./runtime-errors.js";

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

test("admin panel hub visual audit covers cards and denied state", async ({ page }, testInfo) => {
  const assertNoRuntimeErrors = failOnRuntimeErrors(page);

  await page.goto("/?adminHarness=1");
  await expect(page.getByTestId("admin-harness-root")).toBeVisible();
  await expect(page.locator(".adminPanelHubPage")).toBeVisible();
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

  await page.goto("/?adminHarness=1&adminAccess=denied");
  await expect(page.getByTestId("admin-harness-root")).toBeVisible();
  await expect(page.locator(".historyEmptyCard")).toBeVisible();
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

  await page.goto("/?adminHarness=1&adminSurface=users");
  await expect(page.getByTestId("admin-users-harness")).toBeVisible();
  await expect(page.locator(".adminUsersCrmHeader h1")).toBeVisible();
  await expect(page.locator(".adminClientCard")).toHaveCount(3);
  await expect(page.locator(".adminClientWorkspaceCrmPage")).toBeVisible();
  await expectTapTargets(page, [
    ".adminUsersFilterPills button",
    ".adminClientCard",
    ".adminClientWorkspaceActionsRender button",
    ".adminClientTabsCrm button"
  ]);
  await expectNoHorizontalOverflow(page);
  await attachScreenshot(page, testInfo, "admin-users-crm-harness.png");

  await page.locator(".adminClientAddCard").click();
  await expect(page.getByTestId("admin-harness-action")).toHaveText("create-client");
  await page.locator(".adminClientWorkspaceActionsRender button").nth(1).click();
  await expect(page.getByTestId("admin-harness-action")).toHaveText("assign");
  assertNoRuntimeErrors();

  await page.goto("/?adminHarness=1&adminSurface=programs");
  await expect(page.getByTestId("admin-programs-harness")).toBeVisible();
  await expect(page.locator(".programsCompactHeader h1")).toBeVisible();
  await expect(page.locator(".programsOverviewCard")).toHaveCount(3);
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
});
