import { expect, test } from "@playwright/test";
import { renderInviteFixture } from "../helpers/invite-page-template.mjs";
import { failOnRuntimeErrors } from "./runtime-errors.js";

test("onboarding welcome, name and navigation use the current mobile design", async ({ page }, testInfo) => {
  const assertNoErrors = failOnRuntimeErrors(page);
  await page.setViewportSize({ width: 375, height: 812 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?clientHarness=1&clientHarnessPage=firstSetup&clientFirstSetupStep=0&clientHarnessTheme=warm-light");
  const root = page.getByTestId("first-setup-onboarding");
  await expect(root).toBeVisible();
  await expect(root).toHaveCSS("background-color", "rgb(242, 242, 247)");
  await expect(root.getByRole("button", { name: "Начать", exact: true })).toHaveCSS("background-color", "rgb(63, 115, 184)");
  const features = page.getByTestId("first-setup-welcome-features");
  await expect(features.getByRole("listitem")).toHaveCount(3);
  for (const icon of await features.locator("svg").all()) {
    await expect(icon).toHaveCSS("width", "24px");
    await expect(icon).toHaveCSS("height", "24px");
  }
  await page.screenshot({ path: testInfo.outputPath("welcome-375.png") });
  await root.getByRole("button", { name: "Начать", exact: true }).click();
  await root.getByRole("button", { name: "Женщина", exact: true }).click();
  await expect(root.getByRole("button", { name: "Женщина", exact: true })).toHaveAttribute("aria-pressed", "true");
  await root.getByRole("button", { name: "Далее", exact: true }).click();
  const name = root.getByRole("textbox", { name: "Ваше имя" });
  await name.fill("мария");
  await root.getByRole("button", { name: "Далее", exact: true }).click();
  await root.getByRole("button", { name: "Назад", exact: true }).click();
  await expect(name).toHaveValue("Мария");
  await page.screenshot({ path: testInfo.outputPath("name-375.png") });
  await root.getByRole("button", { name: "Далее", exact: true }).click();
  for (let step = 3; step < 9; step++) {
    await expect(page.getByTestId("first-setup-card")).toHaveAttribute("data-step", String(step));
    await root.getByRole("button", { name: "Далее", exact: true }).click();
  }
  await expect(root.getByText("Мария", { exact: true })).toBeVisible();
  await expect(root.getByRole("button", { name: "Создать профиль", exact: true })).toBeEnabled();
  await page.screenshot({ path: testInfo.outputPath("review-375.png") });
  await page.setViewportSize({ width: 812, height: 375 });
  await root.getByRole("button", { name: "Создать профиль", exact: true }).scrollIntoViewIfNeeded();
  const box = await root.getByRole("button", { name: "Создать профиль", exact: true }).boundingBox();
  expect(box.y + box.height).toBeLessThanOrEqual(375);
  await expect(root.getByRole("button", { name: "Выйти из опросника" })).toBeVisible();
  await root.getByRole("button", { name: "Выйти из опросника" }).click();
  await expect(root.getByRole("dialog", { name: "Выход из опросника" })).toBeVisible();
  await root.getByRole("button", { name: "Остаться" }).click();
  assertNoErrors();
});

test("invitation password form retains validation, retry and success in the calm style", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.route("**/__test/invite", route => route.fulfill({ contentType: "text/html", body: renderInviteFixture() }));
  const requests = [];
  await page.route("https://identitytoolkit.googleapis.com/**", async route => {
    requests.push(route.request().postDataJSON());
    await route.fulfill({ status: requests.length === 1 ? 400 : 200, contentType: "application/json", body: "{}" });
  });
  await page.goto("/__test/invite");
  await expect(page.locator("#email")).toHaveText("Логин: Nargo");
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(242, 242, 247)");
  const submit = page.getByRole("button", { name: "Сохранить пароль" });
  await expect(submit).toHaveCSS("background-color", "rgb(63, 115, 184)");
  await page.getByLabel("Новый пароль").fill("test-password-123");
  await page.getByLabel("Повтори пароль").fill("different-password");
  await submit.click();
  await expect(page.getByRole("status")).toHaveText("Пароли не совпадают.");
  expect(requests).toHaveLength(0);
  await page.getByLabel("Повтори пароль").fill("test-password-123");
  await page.screenshot({ path: testInfo.outputPath("password-375.png") });
  await submit.click();
  await expect(page.getByRole("status")).toContainText("Ссылка недействительна");
  await expect(submit).toBeEnabled();
  await submit.click();
  await expect(page.getByRole("status")).toContainText("Пароль создан");
  await expect(page.locator("#form")).toBeHidden();
  await expect(page.getByRole("link", { name: "Перейти ко входу" })).toHaveAttribute("href", "https://example.test/");
  expect(requests).toEqual(Array(2).fill({ oobCode: "test-only-invite-code", newPassword: "test-password-123" }));
  await page.screenshot({ path: testInfo.outputPath("password-success-375.png") });
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(width).toBeLessThanOrEqual(375);
});
