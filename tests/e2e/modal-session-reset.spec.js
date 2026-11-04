import { test, expect } from "./app-test.js";

test("profile form reopening clears sensitive drafts, visibility and weight errors", async ({ page }) => {
  await page.goto("/tests/e2e/fixtures/profile-modal-lifecycle.html");
  await page.getByRole("button", { name: "Открыть email", exact: true }).click();
  await page.getByTestId("profile-email-address").fill("unsaved@example.test");
  await page.getByTestId("profile-email-password").fill("private-draft");
  await page.getByTestId("profile-email-close").click();
  await page.getByRole("button", { name: "Обновить email профиля" }).click();
  await page.getByRole("button", { name: "Открыть email", exact: true }).click();
  await expect(page.getByTestId("profile-email-address")).toHaveValue("updated@example.test");
  await expect(page.getByTestId("profile-email-password")).toHaveValue("");
  await page.getByTestId("profile-email-close").click();

  await page.getByRole("button", { name: "Открыть password", exact: true }).click();
  await page.getByTestId("profile-password-currentPassword").fill("private-password");
  await page.getByTestId("profile-password-toggle-currentPassword").click();
  await expect(page.getByTestId("profile-password-currentPassword")).toHaveAttribute("type", "text");
  await page.getByTestId("profile-password-close").click();
  await page.getByRole("button", { name: "Открыть password", exact: true }).click();
  await expect(page.getByTestId("profile-password-currentPassword")).toHaveValue("");
  await expect(page.getByTestId("profile-password-currentPassword")).toHaveAttribute("type", "password");
  await page.getByTestId("profile-password-close").click();

  await page.getByRole("button", { name: "Открыть weight", exact: true }).click();
  await page.getByTestId("profile-quick-weight-input").fill("0");
  await page.getByTestId("profile-quick-weight-submit").click();
  await expect(page.getByTestId("profile-quick-weight-status")).toBeVisible();
  await page.getByTestId("profile-quick-weight-close").click();
  await page.getByRole("button", { name: "Открыть weight", exact: true }).click();
  await expect(page.getByTestId("profile-quick-weight-input")).toHaveValue("");
  await expect(page.getByTestId("profile-quick-weight-status")).toHaveCount(0);
});

test("a fresh voice session does not reopen the previous unsaved item editor", async ({ page }) => {
  await page.goto("/tests/e2e/fixtures/profile-modal-lifecycle.html");
  await page.getByRole("button", { name: "Открыть voice", exact: true }).click();
  await page.getByRole("button", { name: "Редактировать Йогурт", exact: true }).click();
  await page.getByLabel("Название", { exact: true }).fill("Несохранённый черновик");
  await page.getByTestId("nutrition-voice-close").click();
  await expect(page.getByRole("alertdialog", { name: "Не все продукты добавлены", exact: true })).toBeVisible();
  await expect(page.getByLabel("Название", { exact: true })).toHaveValue("Несохранённый черновик");
  await page.getByRole("button", { name: "Пропустить и закрыть", exact: true }).click();
  await page.getByRole("button", { name: "Открыть voice", exact: true }).click();
  await expect(page.getByLabel("Название", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Редактировать Йогурт", exact: true }).click();
  await expect(page.getByLabel("Название", { exact: true })).toHaveValue("Йогурт");
});

test("voice discard confirmation owns keyboard focus and restores its parent sheet", async ({ page }) => {
  await page.goto("/tests/e2e/fixtures/profile-modal-lifecycle.html");
  await page.getByRole("button", { name: "Открыть voice", exact: true }).click();
  await page.getByTestId("nutrition-voice-close").click();
  const alert = page.getByRole("alertdialog", { name: "Не все продукты добавлены", exact: true });
  const continueButton = alert.getByRole("button", { name: "Продолжить выбор", exact: true });
  const discardButton = alert.getByRole("button", { name: "Пропустить и закрыть", exact: true });
  await expect(continueButton).toBeFocused();
  await expect(page.getByTestId("nutrition-voice-sheet")).toHaveJSProperty("inert", true);
  await expect(page.getByTestId("nutrition-voice-backdrop")).toHaveJSProperty("inert", true);
  await expect(page.getByTestId("nutrition-voice-backdrop")).toHaveAttribute("data-modal-backdrop-muted", "true");
  await page.keyboard.press("Shift+Tab");
  await expect(discardButton).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(continueButton).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(discardButton).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(continueButton).toBeFocused();
  await continueButton.click();
  await expect(alert).toHaveCount(0);
  await expect(page.getByTestId("nutrition-voice-sheet")).toHaveJSProperty("inert", false);
  await expect(page.getByTestId("nutrition-voice-backdrop")).toHaveJSProperty("inert", false);
  await expect(page.getByTestId("nutrition-voice-backdrop")).not.toHaveAttribute("data-modal-backdrop-muted", "true");
  await expect.poll(() => page.getByTestId("nutrition-voice-sheet").evaluate(node => node.contains(document.activeElement))).toBe(true);
  await expect(page.getByRole("button", { name: "Редактировать Йогурт", exact: true })).toBeVisible();
});

test("weight slider follows idle input but preserves its range while a key is held", async ({ page }) => {
  await page.goto("/?clientHarness=1&clientHarnessPage=firstSetup&clientFirstSetupStep=4");
  const input = page.getByRole("textbox", { name: "Текущий вес, кг", exact: true });
  const slider = page.getByRole("slider", { name: "Текущий вес, шкала", exact: true });
  await input.fill("100");
  await expect(slider).toHaveAttribute("min", "60");
  await expect(slider).toHaveAttribute("max", "140");
  await slider.focus();
  await page.keyboard.down("ArrowRight");
  await expect(input).toHaveValue("100.1");
  await expect(slider).toHaveAttribute("min", "60");
  await page.keyboard.up("ArrowRight");
  await expect.poll(async () => Number(await slider.getAttribute("min"))).toBeCloseTo(60.1);
  await expect.poll(async () => Number(await slider.getAttribute("max"))).toBeCloseTo(140.1);
});
