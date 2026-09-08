import { test, expect } from "@playwright/test";

async function openQuiz(page, viewport = { width: 375, height: 667 }) {
  await page.setViewportSize(viewport);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => localStorage.setItem("basic-workout-long-plan-access:client-harness", JSON.stringify({ activated: true })));
  await page.goto("/?clientHarness=1&clientHarnessPage=basicQuiz&clientHarnessTheme=warm-light");
  await expect(page.getByTestId("basic-quiz-card")).toBeVisible({ timeout: 30_000 });
}

async function answer(page, label) {
  const card = page.getByTestId("basic-quiz-card");
  await card.getByRole("button", { name: label }).click();
  await card.getByRole("button", { name: "Далее", exact: true }).click();
}

test("every required question starts empty and deliberate answers survive back navigation", async ({ page }, testInfo) => {
  await openQuiz(page);
  const card = page.getByTestId("basic-quiz-card");
  await expect(card.locator('[aria-pressed="true"]')).toHaveCount(0);
  await expect(card.getByRole("button", { name: "Далее", exact: true })).toBeDisabled();
  await page.screenshot({ path: testInfo.outputPath("quiz-empty-375.png"), fullPage: true });
  const answers = ["Хорошая форма", "Я новичок", "Дома", "3 тренировки", "Около 45 минут", "Нет ограничений"];
  for (const label of answers) {
    await expect(card.locator('[aria-pressed="true"]')).toHaveCount(0);
    await expect(card.getByRole("button", { name: "Далее", exact: true })).toBeDisabled();
    await answer(page, label);
  }
  await expect(card.getByRole("button", { name: "Проверить ответы", exact: true })).toBeEnabled();
  await card.getByRole("button", { name: "Назад", exact: true }).click();
  await expect(card.getByRole("button", { name: "Нет ограничений" })).toHaveAttribute("aria-pressed", "true");
  await card.getByRole("button", { name: "Далее", exact: true }).click();
  await card.getByRole("button", { name: "Проверить ответы", exact: true }).click();
  await expect(page.getByTestId("basic-quiz-review")).toBeVisible();
  await page.getByTestId("basic-quiz-review").locator('[data-answer-key="days"]').click();
  await card.getByRole("button", { name: "2 тренировки" }).click();
  await card.getByRole("button", { name: "Сохранить ответ" }).click();
  const structure = card.getByTestId("basic-quiz-two-day-structure");
  await expect(structure.locator('[aria-pressed="true"]')).toHaveCount(0);
  await expect(card.getByRole("button", { name: "Сохранить ответ" })).toBeDisabled();
  await structure.getByRole("button", { name: "Равномерная нагрузка" }).click();
  await card.getByRole("button", { name: "Сохранить ответ" }).click();
  await expect(page.getByTestId("basic-quiz-review")).toContainText("Равномерная нагрузка");
  await page.getByTestId("basic-quiz-review").locator('[data-answer-key="goal"]').click();
  await card.getByRole("button", { name: "Набор мышц" }).click();
  await card.getByRole("button", { name: "Сохранить ответ" }).click();
  await expect(page.getByTestId("basic-quiz-review")).toContainText("Набор мышц");
  await expect.poll(() => page.getByTestId("basic-quiz-review").locator('[class*="_answerList_"]').evaluate(node => node.scrollTop)).toBe(0);
  await page.screenshot({ path: testInfo.outputPath("quiz-review-375.png") });
  await page.getByTestId("basic-quiz-generate").click();
  await expect(page.getByTestId("basic-quiz-result")).toBeVisible();
  await page.getByTestId("basic-quiz-save-plan").click();
  await expect(page.getByTestId("workout-render-overview")).toBeVisible();
});

test("other restrictions require details, remain on review, and clear when not applicable", async ({ page }, testInfo) => {
  await openQuiz(page, { width: 320, height: 568 });
  for (const label of ["Стать сильнее", "Есть опыт", "В тренажёрном зале", "2 тренировки", "Около 30 минут"]) await answer(page, label);
  const card = page.getByTestId("basic-quiz-card");
  await card.getByRole("button", { name: "Другое" }).click();
  await expect(card.getByRole("button", { name: "Далее", exact: true })).toBeDisabled();
  await card.getByLabel("Кратко опиши ограничение (обязательно)").fill("Без прыжков");
  await card.getByRole("button", { name: "Далее", exact: true }).click();
  await card.getByRole("button", { name: "Больше восстановления" }).click();
  await card.getByRole("button", { name: "Проверить ответы", exact: true }).click();
  await expect(page.getByTestId("basic-quiz-review")).toContainText("Без прыжков");
  await page.getByTestId("basic-quiz-review").locator('[data-answer-key="restrictions"]').click();
  await card.getByRole("button", { name: "Нет ограничений" }).click();
  await card.getByRole("button", { name: "Другое" }).click();
  await expect(card.getByLabel("Кратко опиши ограничение (обязательно)")).toHaveValue("");
  await expect(card.getByRole("button", { name: "Сохранить ответ" })).toBeDisabled();
  await page.screenshot({ path: testInfo.outputPath("quiz-restrictions-320.png"), fullPage: true });
});

test("small and landscape layouts keep controls reachable and text scalable", async ({ page }, testInfo) => {
  for (const viewport of [{ width: 320, height: 568 }, { width: 844, height: 390 }, { width: 768, height: 1024 }]) {
    await openQuiz(page, viewport);
    const card = page.getByTestId("basic-quiz-card");
    await page.addStyleTag({ content: '[data-testid="basic-quiz-card"] strong { font-size: 22px; }' });
    await card.getByRole("button", { name: "Хорошая форма" }).click();
    const next = card.getByRole("button", { name: "Далее", exact: true });
    await next.scrollIntoViewIfNeeded();
    const box = await next.boundingBox();
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
    const navBox = await page.getByTestId("client-bottom-nav").boundingBox();
    expect(box.y + box.height).toBeLessThanOrEqual(navBox.y);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`quiz-scaled-${viewport.width}.png`) });
    await next.click();
    await expect(card.getByText("Шаг 2 из 7")).toBeVisible();
  }
});
