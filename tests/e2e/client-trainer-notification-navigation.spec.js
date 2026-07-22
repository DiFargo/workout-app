import { expect, test } from "@playwright/test";

async function openTrainerNotifications(page) {
  await page.goto("/?clientHarness=1&clientCabinetModal=notifications");
  await page.getByTestId("client-nav-cabinet").click();
  await expect(page.getByTestId("profile-trainer-notifications-dialog")).toBeVisible();
}

test("trainer task buttons open the matching client destination", async ({ page }) => {
  await openTrainerNotifications(page);
  await page.getByTestId("profile-trainer-notification-open").first().click();
  await expect(page.getByTestId("profile-trainer-notifications-dialog")).toBeHidden();
  await expect(page.getByTestId("profile-progress-photos-dialog")).toBeVisible();

  await openTrainerNotifications(page);
  await page.getByTestId("profile-trainer-notification-open").nth(1).click();
  await expect(page.getByTestId("profile-trainer-notifications-dialog")).toBeHidden();
  await expect(page.getByTestId("client-harness-workouts")).toBeVisible();
});
