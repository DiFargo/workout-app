import { test, expect } from "./app-test.js";
import { buildLocalHybridWorkoutPlan } from "../../functions/basicWorkoutHybridPlan.js";
import { getWorkoutEmphasisOption } from "../../functions/basicWorkoutEmphasis.js";

async function isolate(page) {
  await page.setViewportSize({ width: 402, height: 874 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  // These fixtures verify plan generation, not Telegram authentication.
  await page.route("https://telegram.org/js/telegram-web-app.js*", route => route.fulfill({ contentType: "application/javascript", body: "" }));
  await page.route(/firestore\.googleapis\.com/, (route) => route.abort());
  // Auth transport is stubbed only in this isolated harness. The real endpoint
  // authentication contract is covered separately, never bypassed in runtime.
  await page.route(/\/src\/utils\/apiClient\.js(?:\?.*)?$/, (route) => route.fulfill({ contentType: "text/javascript", body: `
    export const fetchAuthorizedWithTimeout = (url, options) => fetch(url, options);
    export const fetchAuthorized = fetchAuthorizedWithTimeout;
    export const fetchWithAppCheck = fetchAuthorizedWithTimeout;
    export const getAppCheckApiHeaders = async (headers = {}) => headers;
    export const withAppCheckHeader = (headers = {}) => headers;
  ` }));
  await page.addInitScript(() => localStorage.setItem("basic-workout-long-plan-access:client-harness", JSON.stringify({ activated: true })));
}

async function answerQuiz(page, restrictions = "Нет ограничений", emphasis = "classic") {
  await page.goto("/?clientHarness=1&clientHarnessPage=basicQuiz");
  const card = page.getByTestId("basic-quiz-card");
  for (const label of ["Хорошая форма", "Я новичок", "Дома", "3 тренировки", "Около 45 минут", restrictions]) {
    await card.getByRole("button", { name: label, exact: false }).click();
    await card.getByRole("button", { name: "Далее", exact: true }).click();
  }
  await card.getByRole("group", { name: "Акцент программы" }).getByRole("button", { name: getWorkoutEmphasisOption(emphasis).label, exact: true }).click();
  await card.getByRole("button", { name: "Проверить ответы", exact: true }).click();
}

test("weekly emphasis can be compared, changed and preserved in the generated mobile preview", async ({ page }, testInfo) => {
  await isolate(page);
  let requested;
  await page.route("**/api/ai-basic-workout-plan", async (route) => {
    requested = route.request().postDataJSON().profile;
    await route.fulfill({ json: { ok: true, plan: buildLocalHybridWorkoutPlan(requested) } });
  });
  await answerQuiz(page, "Нет ограничений", "lower");
  const review = page.getByTestId("basic-quiz-review");
  await expect(review.locator('[data-answer-key="trainingEmphasis"]')).toContainText("Ноги и ягодицы");
  await review.locator('[data-answer-key="trainingEmphasis"]').click();
  const select = page.getByRole("group", { name: "Акцент программы" });
  await expect(select.getByRole("button", { name: "Ноги и ягодицы", exact: true })).toHaveAttribute("aria-pressed", "true");
  for (const viewport of [{ width: 402, height: 874 }, { width: 320, height: 568 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(viewport);
    await select.scrollIntoViewIfNeeded();
    const box = await select.boundingBox();
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.setViewportSize({ width: 402, height: 874 });
  await select.getByRole("button", { name: getWorkoutEmphasisOption("classic").label, exact: true }).click();
  await expect(page.locator("#basic-quiz-emphasis-hint")).toContainText("ноги → жимовой верх → тяговой верх");
  await select.getByRole("button", { name: getWorkoutEmphasisOption("balanced").label, exact: true }).click();
  await page.screenshot({ path: testInfo.outputPath("emphasis-choice-iphone.png") });
  await page.getByRole("button", { name: "Сохранить ответ", exact: true }).click();
  await expect(review.locator('[data-answer-key="trainingEmphasis"]')).toContainText("Сбалансированно");
  await page.getByTestId("basic-quiz-generate").click();
  await expect(page.getByTestId("basic-quiz-result")).toContainText("Сбалансированно.");
  await expect(page.getByTestId("basic-quiz-emphasis-summary")).toContainText("ноги и ягодицы — 18, верх — 18, кор — 9");
  expect(requested.trainingEmphasis).toBe("balanced");
  await page.screenshot({ path: testInfo.outputPath("emphasis-result-iphone.png"), fullPage: true });
});

test("an old server response cannot silently replace the requested weekly emphasis", async ({ page }) => {
  await isolate(page);
  await page.route("**/api/ai-basic-workout-plan", async (route) => {
    const profile = route.request().postDataJSON().profile;
    const plan = buildLocalHybridWorkoutPlan({ ...profile, trainingEmphasis: "classic" });
    delete plan.trainingEmphasis;
    await route.fulfill({ json: { ok: true, plan } });
  });
  await answerQuiz(page, "Нет ограничений", "lower");
  await page.getByTestId("basic-quiz-generate").click();
  await expect(page.getByRole("alert")).toContainText("Сервер не применил выбранный акцент");
  await expect(page.getByTestId("basic-quiz-result")).toHaveCount(0);
  await page.getByRole("button", { name: "Использовать готовый базовый план" }).click();
  await expect(page.getByTestId("basic-quiz-result")).toContainText("Ноги и ягодицы.");
});

test("Gemini four-week preview uses manual loads, all weeks and explicit save on iPhone viewport", async ({ page }, testInfo) => {
  await isolate(page);
  let requests = 0;
  await page.route("**/api/ai-basic-workout-plan", async (route) => {
    requests++;
    const body = route.request().postDataJSON();
    expect(body.provider).toBe("gemini");
    expect(body.profile.registration).toMatchObject({ sex: "female", age: 30, height: 178, weight: 80 });
    expect(Array.isArray(body.profile.trainingHistory)).toBe(true);
    const plan = buildLocalHybridWorkoutPlan(body.profile);
    plan.generationProvider = "gemini"; plan.generationFallback = false; plan.generatedBy = "gemini_hybrid";
    await route.fulfill({ json: { ok: true, plan } });
  });
  await answerQuiz(page);
  await expect(page.getByTestId("basic-quiz-review")).toContainText("Учтём данные профиля");
  await page.getByText("Учтём данные профиля", { exact: true }).click();
  await expect(page.getByRole("region", { name: "Данные для персонализации" })).toContainText("Женщина · 30 лет · 178 см · 80 кг");
  const profileCard = page.getByRole("region", { name: "Данные для персонализации" });
  const profileBox = await profileCard.boundingBox();
  const reviewBox = await page.getByTestId("basic-quiz-review").boundingBox();
  expect(profileBox.width).toBeGreaterThan(reviewBox.width * 0.8);
  expect(await profileCard.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("gemini-profile-review-iphone.png"), fullPage: true });
  await page.getByTestId("basic-quiz-generate").click();
  const result = page.getByTestId("basic-quiz-result");
  await expect(result).toContainText("Gemini подобрал");
  await expect(result).toContainText("Рабочий вес укажи вручную");
  await expect(page.getByTestId("basic-quiz-save-plan")).toBeEnabled();
  expect(requests).toBe(1);
  await expect(page.getByTestId("workout-render-overview")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await page.screenshot({ path: testInfo.outputPath("gemini-plan-iphone.png"), fullPage: true });
});

test("today template fallback is labelled and save failure keeps draft", async ({ page }, testInfo) => {
  await isolate(page);
  await page.route("**/api/ai-basic-workout-plan", async (route) => {
    const profile = route.request().postDataJSON().profile;
    expect(profile.registration.sex).toBe("female");
    await route.fulfill({ json: { ok: true, plan: buildLocalHybridWorkoutPlan(profile) } });
  });
  await page.goto("/?clientHarness=1&clientHarnessPage=basicWorkoutToday&clientWorkoutProgramMode=basic&clientBasicSave=error");
  await page.getByRole("region", { name: "Выбор зон тренировки" }).getByRole("button").first().click();
  await page.getByTestId("basic-workout-today-generate").click();
  await expect(page.getByText("Gemini не использовался:", { exact: false })).toBeVisible();
  await page.getByTestId("basic-workout-save-later").click();
  await expect(page.getByRole("alert")).toContainText("Не удалось сохранить");
  await expect(page.getByTestId("basic-workout-save-start")).toBeEnabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await page.screenshot({ path: testInfo.outputPath("gemini-today-fallback-iphone.png"), fullPage: true });
});

test("missing profile blocks remote and local generation without spending a today attempt", async ({ page }) => {
  await isolate(page);
  let requests = 0;
  await page.route("**/api/ai-basic-workout-plan", (route) => { requests++; return route.abort(); });
  await page.goto("/?clientHarness=1&clientHarnessPage=basicWorkoutToday&clientBasicProfile=missing");
  await page.getByRole("region", { name: "Выбор зон тренировки" }).getByRole("button").first().click();
  const allowance = await page.getByText("Подборок на сегодня осталось:", { exact: false }).textContent();
  await page.getByTestId("basic-workout-today-generate").click();
  await expect(page.getByRole("alert")).toContainText("Заполни в кабинете");
  await expect(page.getByText(allowance, { exact: true })).toBeVisible();
  expect(requests).toBe(0);
  await expect(page.getByTestId("basic-workout-save-start")).toHaveCount(0);
});

test("pregnancy is an explicit safety gate, not inferred from female sex", async ({ page }) => {
  await isolate(page);
  let requests = 0;
  await page.route("**/api/ai-basic-workout-plan", (route) => { requests++; return route.abort(); });
  await answerQuiz(page);
  await page.getByText("Учтём данные профиля", { exact: true }).click();
  await page.getByLabel("Особые состояния (если актуально)").selectOption("pregnant");
  await page.getByTestId("basic-quiz-generate").click();
  await expect(page.getByRole("alert")).toContainText("нужен подбор с тренером");
  expect(requests).toBe(0);
  await page.getByRole("button", { name: "Использовать готовый базовый план" }).click();
  await expect(page.getByTestId("basic-quiz-result")).toHaveCount(0);
});

test("health restriction blocks generation and the local-template escape route", async ({ page }) => {
  await isolate(page);
  let requests = 0;
  await page.route("**/api/ai-basic-workout-plan", (route) => { requests++; return route.abort(); });
  await answerQuiz(page, "Колени");
  await page.getByTestId("basic-quiz-generate").click();
  await expect(page.getByRole("alert")).toContainText("нужен подбор с тренером");
  await expect(page.getByTestId("basic-quiz-result")).toHaveCount(0);
  expect(requests).toBe(0);
});
