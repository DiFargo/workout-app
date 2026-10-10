import { expect, test } from "./app-test.js";
import { failOnRuntimeErrors } from "./runtime-errors.js";

test.beforeEach(async ({ page }) => {
  await page.route("**/*", route => {
    const { hostname } = new URL(route.request().url());
    return ["127.0.0.1", "localhost"].includes(hostname) ? route.continue() : route.abort();
  });
});

async function openSheet(page, query) {
  await page.goto(`/?clientHarness=1&clientHarnessTheme=warm-light&${query}`);
  await page.getByTestId("client-nav-cabinet").click();
}

async function checkControl(control) {
  await expect(control).toBeVisible();
  expect(await control.evaluate(node => {
    const r = node.getBoundingClientRect();
    return r.width >= 44 && r.height >= 44 && r.left >= 0 && r.right <= innerWidth
      && r.top >= 0 && r.bottom <= innerHeight
      && node.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
  })).toBe(true);
}

async function checkCurrentAction(control) {
  expect(await control.evaluate(node => getComputedStyle(node).backgroundImage)).toMatch(/linear-gradient/);
  expect(Number(await control.evaluate(node => getComputedStyle(node).fontWeight))).toBeLessThanOrEqual(600);
  await checkControl(control);
}

for (const viewport of [{ width: 402, height: 874 }, { width: 320, height: 568 }]) {
  test(`progress photo sheet uses current styles and keeps comparison at ${viewport.width}`, async ({ page }, testInfo) => {
    const noErrors = failOnRuntimeErrors(page);
    await page.setViewportSize(viewport);
    await openSheet(page, "clientCabinetModal=photos&clientPhotosTabbed=1");
    const dialog = page.getByTestId("profile-progress-photos-dialog");
    await expect(dialog).toBeVisible();
    await expect(page.getByTestId("profile-progress-photo-step")).toHaveCount(3);
    const save = page.getByTestId("profile-progress-photos-save");
    await expect(save).toBeDisabled();
    await checkCurrentAction(save);
    for (const tab of await page.getByTestId("profile-progress-photos-section-tabs").getByRole("tab").all()) await checkControl(tab);
    await expect(page.getByTestId("profile-progress-photos-intro")).toHaveCSS("border-top-width", "0px");
    await page.screenshot({ path: testInfo.outputPath(`photos-${viewport.width}.png`) });
    await page.getByTestId("profile-progress-photos-compare-toggle").click();
    await expect(page.getByTestId("profile-progress-photos-compare-content")).toBeVisible();
    await expect(page.getByTestId("profile-progress-photos-compare-content").getByRole("combobox")).toHaveCount(2);
    await checkControl(save);
    await page.getByTestId("profile-progress-photos-close").click();
    await expect(dialog).toBeHidden();
    noErrors();
  });

  test(`measurements sheet keeps all 12 values and current action at ${viewport.width}`, async ({ page }, testInfo) => {
    const noErrors = failOnRuntimeErrors(page);
    await page.setViewportSize(viewport);
    await openSheet(page, "clientCabinetModal=measurements&clientMeasurementsTabbed=1&clientMeasurementsState=full");
    await expect(page.getByTestId("profile-measurements-cell")).toHaveCount(12);
    await expect(page.getByTestId("profile-measurements-cell").first()).toHaveCSS("border-top-width", "0px");
    await expect(page.getByTestId("profile-measurements-cell").first().locator("small")).toHaveCSS("font-weight", "400");
    for (const tab of await page.getByTestId("profile-measurements-section-tabs").getByRole("tab").all()) await checkControl(tab);
    await checkCurrentAction(page.getByTestId("profile-measurements-start"));
    await page.screenshot({ path: testInfo.outputPath(`measurements-${viewport.width}.png`) });
    await page.getByTestId("profile-measurements-close").click();
    await expect(page.getByTestId("profile-measurements-dialog")).toBeHidden();
    noErrors();
  });

  test(`account sheet keeps editing and password controls at ${viewport.width}`, async ({ page }, testInfo) => {
    const noErrors = failOnRuntimeErrors(page);
    await page.setViewportSize(viewport);
    await openSheet(page, "clientCabinetModal=settings");
    const section = page.getByTestId("profile-account-section");
    await expect(section).toBeVisible();
    await expect(page.getByTestId("profile-account-quick-panel")).toHaveCSS("border-top-width", "0px");
    for (const testId of ["profile-account-name-edit", "profile-account-login-edit", "profile-account-password"]) {
      await checkControl(page.getByTestId(testId));
    }
    await page.screenshot({ path: testInfo.outputPath(`account-${viewport.width}.png`) });
    await page.getByTestId("profile-account-name-edit").click();
    await expect(page.getByTestId("profile-account-identity").locator('input:not([type="file"])')).toBeEditable();
    await page.getByTestId("profile-account-login-edit").click();
    await expect(page.getByTestId("profile-account-login-row").locator("input")).toBeEditable();
    await page.getByTestId("profile-account-password").click();
    await expect(page.getByTestId("profile-password-dialog")).toBeVisible();
    await page.getByTestId("profile-password-dismiss").click();
    await page.getByTestId("profile-settings-close").click();
    await expect(page.getByTestId("profile-settings-dialog")).toBeHidden();
    noErrors();
  });
}
