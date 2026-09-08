import { test, expect } from "@playwright/test";

test("basic plan keeps a neutral, working notification card and inbox", async ({ page }, testInfo) => {
  const cases = [
    ["message", "1 сообщение", "1"],
    ["task", "1 напоминание", "1"],
    ["both", "1 сообщение · 1 напоминание", "2"],
    ["empty", "Новых уведомлений нет", null]
  ];
  for (const [state, label, badge] of cases) {
    await page.goto(`/?clientHarness=1&clientWorkoutProgramMode=basic&clientCoachNotificationState=${state}`);
    await expect(page.getByRole("heading", { name: "Сообщения и напоминания" })).toBeVisible();
    const card = page.getByTestId("profile-summary-notifications-button");
    await expect(card).toContainText("Уведомления");
    await expect(card).not.toContainText(/тренер|под контролем/i);
    await expect(page.getByTestId("profile-summary-trainer-status")).toHaveText(label);
    if (badge) await expect(page.getByTestId("profile-summary-trainer-badge")).toHaveAttribute("aria-label", `${badge} новых уведомлений`);
    else await expect(page.getByTestId("profile-summary-trainer-badge")).toHaveCount(0);
    await card.click();
    const dialog = page.getByTestId("profile-trainer-notifications-dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog).not.toContainText(/тренер/i);
    if (state === "empty") {
      await expect(dialog).toContainText("Сообщения и напоминания появятся здесь.");
    } else {
      await expect(page.getByTestId("profile-trainer-notification-item")).toHaveCount(Number(badge));
    }
    await page.getByTestId("profile-trainer-notifications-close").click();
    await expect(dialog).toHaveCount(0);
    if (state === "both") {
      await card.scrollIntoViewIfNeeded();
      await page.screenshot({ path: testInfo.outputPath("basic-notifications.png"), fullPage: true });
    }
  }
});

test("individual plan retains trainer copy and notifications", async ({ page }) => {
  await page.goto("/?clientHarness=1&clientWorkoutProgramMode=individual&clientCoachNotificationState=message");
  await expect(page.getByRole("heading", { name: "Тренер рядом" })).toBeVisible();
  await expect(page.getByTestId("profile-summary-notifications-button")).toContainText("Ваш тренер");
  await expect(page.getByTestId("profile-summary-trainer-status")).toHaveText("1 сообщение от тренера");
  await page.getByTestId("profile-summary-notifications-button").click();
  await expect(page.getByTestId("profile-trainer-notifications-dialog")).toContainText("Сообщение от тренера");
});
