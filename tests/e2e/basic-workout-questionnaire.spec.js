import { test, expect } from "./app-test.js";

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

test("compact questions start selected and deliberate answers survive back navigation", async ({ page }, testInfo) => {
  await openQuiz(page);
  const card = page.getByTestId("basic-quiz-card");
  await expect(card.getByRole("button", { name: "Хорошая форма", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(card.getByRole("button", { name: "Далее", exact: true })).toBeEnabled();
  await page.screenshot({ path: testInfo.outputPath("quiz-default-375.png"), fullPage: true });
  const answers = ["Хорошая форма", "Я новичок", "Дома", "3 тренировки", "Около 45 минут", "Нет ограничений"];
  for (const label of answers) {
    await expect(card.locator('[aria-pressed="true"]')).toHaveCount(label === "Нет ограничений" ? 0 : 1);
    if (label === "Нет ограничений") await expect(card.getByRole("button", { name: "Далее", exact: true })).toBeDisabled();
    else await expect(card.getByRole("button", { name: "Далее", exact: true })).toBeEnabled();
    await answer(page, label);
  }
  await expect(card.getByRole("button", { name: "Проверить ответы", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Назад", exact: true }).click();
  await expect(card.getByRole("button", { name: "Нет ограничений" })).toHaveAttribute("aria-pressed", "true");
  await card.getByRole("button", { name: "Далее", exact: true }).click();
  await card.getByRole("button", { name: "Проверить ответы", exact: true }).click();
  await expect(page.getByTestId("basic-quiz-review")).toBeVisible();
  await page.getByTestId("basic-quiz-review").locator('[data-answer-key="days"]').click();
  await card.getByRole("button", { name: "2 тренировки" }).click();
  await card.getByRole("button", { name: "Сохранить ответ" }).click();
  const structure = card.getByTestId("basic-quiz-two-day-structure");
  await expect(structure.getByRole("combobox")).toHaveValue("");
  await expect(card.getByRole("button", { name: "Сохранить ответ" })).toBeDisabled();
  await structure.getByRole("combobox").selectOption({ label: "Равномерная нагрузка" });
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

test("unchanged visible defaults reach review with direct answer buttons", async ({ page }, testInfo) => {
  await openQuiz(page, { width: 402, height: 874 });
  const card = page.getByTestId("basic-quiz-card");
  const labels = ["Хорошая форма", "Я новичок", "В тренажёрном зале", "1 тренировка", "Около 30 минут"];
  for (const [index, label] of labels.entries()) {
    await expect(card.getByRole("group").first()).toBeVisible();
    await expect(card.getByRole("button", { name: label, exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(card.getByText("Выбери один вариант, чтобы продолжить.")).toHaveCount(0);
    const next = card.getByRole("button", { name: "Далее", exact: true });
    await expect(next).toBeEnabled();
    await page.screenshot({ path: testInfo.outputPath(`default-step-${index + 1}.png`), scale: "css" });
    await next.click();
  }
  await expect(card.getByRole("button", { name: "Далее", exact: true })).toBeDisabled();
  await answer(page, "Нет ограничений");
  await expect(card.getByRole("group", { name: "Акцент программы" }).locator('[aria-pressed="true"]')).toHaveCount(1);
  await card.getByRole("button", { name: "Проверить ответы", exact: true }).click();
  const review = page.getByTestId("basic-quiz-review");
  for (const [key, label] of Object.entries({ goal: "Хорошая форма", level: "Я новичок", location: "В тренажёрном зале", days: "1 раз", duration: "30 мин" })) {
    await expect(review.locator(`[data-answer-key="${key}"]`)).toContainText(label);
  }
  await review.locator('[data-answer-key="goal"]').click();
  await card.getByRole("button", { name: "Стать сильнее", exact: true }).click();
  await card.getByRole("button", { name: "Сохранить ответ", exact: true }).click();
  await review.locator('[data-answer-key="goal"]').click();
  await expect(card.getByRole("button", { name: "Стать сильнее", exact: true })).toHaveAttribute("aria-pressed", "true");
});

test("other restrictions require details, remain on review, and clear when not applicable", async ({ page }, testInfo) => {
  await openQuiz(page, { width: 320, height: 568 });
  for (const label of ["Стать сильнее", "Есть опыт", "В тренажёрном зале", "2 тренировки", "Около 30 минут"]) await answer(page, label);
  const card = page.getByTestId("basic-quiz-card");
  await card.getByRole("button", { name: "Другое" }).click();
  await expect(card.getByRole("button", { name: "Далее", exact: true })).toBeDisabled();
  await card.getByLabel("Кратко опиши ограничение (обязательно)").fill("Без прыжков");
  await card.getByRole("button", { name: "Далее", exact: true }).click();
  await card.getByRole("combobox", { name: "Формат двух тренировок" }).selectOption({ label: "Больше восстановления" });
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

// This file owns its viewport matrix; avoid repeating it in the second project.
test.beforeEach(() => { test.skip(test.info().project.name !== "mobile-chromium", "Viewport matrix runs once"); });
