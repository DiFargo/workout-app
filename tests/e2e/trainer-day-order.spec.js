import { expect, test } from "./app-test.js";
import { failOnRuntimeErrors } from "./runtime-errors.js";

test.setTimeout(60_000);

async function openEditor(page, extra = "&assignmentScheduleAudit=1&draftAudit=1") {
  await page.goto(`/v2?trainerHarness=1${extra}`);
  await expect(page.locator(".trainerNextRoot")).toBeVisible({ timeout: 40_000 });
  const mobileNav = page.getByTestId("trainer-nav-clients");
  await (await mobileNav.isVisible() ? mobileNav : page.getByTestId("trainer-desktop-nav-clients")).click();
  await page.locator(".trainerNextClientTable > button").first().click();
  const mobileTab = page.locator(".trainerNextClientMobileNav").getByRole("button", { name: "Тренировки", exact: true });
  const desktopTab = page.locator(".trainerNextClientTabs").getByRole("button", { name: "Тренировки", exact: true });
  await (await mobileTab.isVisible() ? mobileTab : desktopTab).click();
  await page.locator(".trainerClientProgramEditButton").click();
  const editor = page.getByRole("dialog", { name: "Редактор программы клиента", exact: true });
  await expect(editor).toBeVisible();
  return editor;
}
const picker = editor => editor.locator(".clientEditorMobileDays select");
const ids = editor => picker(editor).locator("option").evaluateAll(options => options.map(option => option.value));
async function selectDay(editor, index) {
  if (await picker(editor).isVisible()) await picker(editor).selectOption({ index });
  else await editor.locator(".trainerNextWorkoutDaySelect").nth(index).click();
}

test("day order is draft-only, cancel discards it and explicit Save retains the selected workout identity", async ({ page }) => {
  const noErrors = failOnRuntimeErrors(page);
  let editor = await openEditor(page);
  const initial = await ids(editor);
  await expect(editor.getByRole("button", { name: "Переместить день вверх", exact: true })).toBeDisabled();
  await selectDay(editor, 2);
  await editor.getByRole("button", { name: "Переместить день вверх", exact: true }).click();
  const moved = [...initial]; [moved[1], moved[2]] = [moved[2], moved[1]];
  await expect.poll(() => ids(editor)).toEqual(moved);
  await expect(picker(editor)).toHaveValue(initial[2]);
  await editor.screenshot({ path: test.info().outputPath("day-order-editable-moved.png") });
  await expect(page.locator("html")).not.toHaveAttribute("data-draft-save-attempts");
  await editor.getByRole("button", { name: "Отмена", exact: true }).click();
  await page.getByRole("button", { name: "Выйти без сохранения", exact: true }).click();
  await page.locator(".trainerClientProgramEditButton").click();
  editor = page.getByRole("dialog", { name: "Редактор программы клиента", exact: true });
  await expect.poll(() => ids(editor)).toEqual(initial);
  await selectDay(editor, 2);
  await editor.getByRole("button", { name: "Переместить день вверх", exact: true }).click();
  await editor.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(editor).toBeHidden();
  await page.locator(".trainerClientProgramEditButton").click();
  await expect.poll(() => ids(editor)).toEqual(moved);
  await selectDay(editor, moved.length - 1);
  await expect(editor.getByRole("button", { name: "Переместить день вниз", exact: true })).toBeDisabled();
  await expect(editor.getByRole("button", { name: "Копировать тренировку", exact: true })).toBeVisible();
  noErrors();
});

test("a failed order save keeps the draft for a successful explicit retry", async ({ page }) => {
  const noErrors = failOnRuntimeErrors(page);
  const editor = await openEditor(page, "&assignmentScheduleAudit=1&draftAudit=1&saveFailure=1");
  const initial = await ids(editor);
  await selectDay(editor, 1);
  await editor.getByRole("button", { name: "Переместить день вверх", exact: true }).click();
  await editor.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(editor).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-draft-save-attempts", "1");
  await expect(picker(editor)).toHaveValue(initial[1]);
  expect((await ids(editor))[0]).toBe(initial[1]);
  await editor.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(editor).toBeHidden();
  await expect(page.locator("html")).toHaveAttribute("data-draft-save-attempts", "2");
  noErrors();
});

test("completed days cannot move and controls fit primary, narrow and landscape layouts", async ({ page }) => {
  const noErrors = failOnRuntimeErrors(page);
  const editor = await openEditor(page, "");
  await selectDay(editor, 0);
  for (const direction of ["вверх", "вниз"]) await expect(editor.getByRole("button", { name: `Переместить день ${direction}`, exact: true })).toBeDisabled();
  for (const [width, height] of [[402, 874], [320, 720], [844, 390], [1440, 900]]) {
    await page.setViewportSize({ width, height });
    const controls = editor.getByRole("button", { name: "Переместить день вниз", exact: true });
    await expect(controls).toBeVisible();
    const bounds = await controls.boundingBox();
    expect(bounds.width).toBeGreaterThanOrEqual(44);
    expect(bounds.height).toBeGreaterThanOrEqual(44);
    const desktopActions = editor.locator(".trainerNextWorkoutDayActions:visible");
    if (await desktopActions.count()) {
      const card = await desktopActions.locator("..").boundingBox();
      for (const button of await desktopActions.getByRole("button").all()) {
        const target = await button.boundingBox();
        expect(target.width).toBeGreaterThanOrEqual(44);
        expect(target.x).toBeGreaterThanOrEqual(card.x);
        expect(target.x + target.width).toBeLessThanOrEqual(card.x + card.width + 1);
      }
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await editor.screenshot({ path: test.info().outputPath(`day-order-${width}.png`) });
  }
  noErrors();
});
