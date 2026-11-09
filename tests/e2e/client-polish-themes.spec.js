import { expect, test } from "./app-test.js";
import { failOnRuntimeErrors } from "./runtime-errors.js";

async function selectDarkAppearance(page) {
  await page.evaluate(() => {
    localStorage.setItem("zmena-client-appearance-v1", "dark");
    window.dispatchEvent(new CustomEvent("zmena-client-appearance-change", { detail: "dark" }));
  });
  await expect(page.locator("html")).toHaveAttribute("data-client-appearance", "dark");
}

async function readSurfaceContrast(root, selector) {
  return root.evaluate((node, textSelector) => {
    const parse = value => {
      const numbers = value.match(/[\d.]+/g).map(Number);
      return [...numbers.slice(0, 3), numbers[3] ?? 1];
    };
    const background = element => {
      if (!element) return [0, 0, 0, 1];
      const own = parse(getComputedStyle(element).backgroundColor);
      const under = own[3] < 1 ? background(element.parentElement) : own;
      return own.slice(0, 3).map((channel, index) => channel * own[3] + under[index] * (1 - own[3]));
    };
    const luminance = rgb => rgb.slice(0, 3).map(channel => channel / 255)
      .map(channel => channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4)
      .reduce((total, channel, index) => total + channel * [.2126, .7152, .0722][index], 0);
    const values = [...node.querySelectorAll(textSelector)].map(element => {
      const style = getComputedStyle(element);
      const ink = parse(style.webkitTextFillColor || style.color);
      const paper = background(element);
      const inkLum = luminance(ink), paperLum = luminance(paper);
      return { label: element.getAttribute("aria-label") || element.textContent || element.type,
        ratio: (Math.max(inkLum, paperLum) + .05) / (Math.min(inkLum, paperLum) + .05), paperLum };
    });
    return { surface: luminance(background(node)), values };
  }, selector);
}

test("пять клиентских вкладок сохраняют непрозрачную шапку, адаптивность и читаемую тёмную анкету", async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 402, height: 874 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => localStorage.setItem("zmena-client-appearance-v1", "light"));
  const assertNoErrors = failOnRuntimeErrors(page);
  await page.goto("/?clientHarness=1&clientWorkoutOverviewState=today");
  const tabs = [
    ["main", "Сегодня"], ["workouts", "Тренировки"], ["nutrition", "Питание"],
    ["progress", "Прогресс"], ["cabinet", "Кабинет"]
  ];

  for (const [theme, label] of [["light", "Светлая"], ["dark", "Тёмная"]]) {
    await page.getByTestId("client-nav-cabinet").click();
    await page.getByRole("button", { name: "Оформление приложения", exact: true }).click();
    const appearance = page.getByRole("dialog", { name: "Оформление", exact: true });
    await expect(appearance.locator("[aria-pressed]")).toHaveCount(2);
    await expect(appearance.getByRole("button", { name: "Системная", exact: true })).toHaveCount(0);
    await appearance.getByRole("button", { name: label, exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute("data-client-appearance", theme);
    await expect(appearance.getByRole("button", { name: label, exact: true })).toHaveAttribute("aria-pressed", "true");
    await appearance.getByRole("button", { name: "Готово", exact: true }).click();

    let scrolledTabs = 0;
    for (const [tab, title] of tabs) {
      await page.getByTestId(`client-nav-${tab}`).click();
      const header = page.locator('[data-client-page-header-primary="true"]');
      await expect(header).toHaveCount(1);
      await expect(header.getByRole("heading", { name: title, exact: true })).toBeVisible();
      await expect(page.getByTestId(`client-nav-${tab}`)).toHaveAttribute("aria-current", "page");
      const before = await header.boundingBox();
      const chrome = await header.evaluate(node => {
        const style = getComputedStyle(node);
        const rgba = style.backgroundColor.match(/[\d.]+/g).map(Number);
        return { alpha: rgba[3] ?? 1, position: style.position, opacity: Number(style.opacity) };
      });
      expect(chrome.position, `${theme}/${tab}: шапка закреплена`).toBe("fixed");
      expect(chrome.alpha * chrome.opacity, `${theme}/${tab}: фон шапки непрозрачный`).toBeGreaterThanOrEqual(.99);

      // Scroll the actual feature shell, not window.scrollTo (which does not
      // exercise the nested mobile viewport used by these client pages).
      const scroll = await header.evaluate(node => {
        let host = node.parentElement;
        while (host) {
          if (/auto|scroll/.test(getComputedStyle(host).overflowY) && host.scrollHeight > host.clientHeight + 1) {
            host.scrollTop = Math.min(180, host.scrollHeight - host.clientHeight);
            return { top: host.scrollTop, maximum: host.scrollHeight - host.clientHeight };
          }
          host = host.parentElement;
        }
        return { top: 0, maximum: 0 };
      });
      if (scroll.maximum > 1) {
        expect(scroll.top, `${theme}/${tab}: реальный контейнер прокрутился`).toBeGreaterThan(0);
        scrolledTabs += 1;
      }
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const after = await header.boundingBox();
      for (const key of ["x", "y", "width", "height"]) {
        expect(Math.abs(after[key] - before[key]), `${theme}/${tab}: стабильная геометрия ${key}`).toBeLessThanOrEqual(1);
      }
      const overflow = await page.evaluate(() => ({
        document: document.documentElement.scrollWidth - innerWidth,
        shells: [...document.querySelectorAll('[data-client-adaptive-shell="true"]')]
          .filter(node => node.getBoundingClientRect().width > 0)
          .map(node => node.scrollWidth - node.clientWidth)
      }));
      expect(overflow.document, `${theme}/${tab}: документ без горизонтальной прокрутки`).toBeLessThanOrEqual(1);
      expect(Math.max(0, ...overflow.shells), `${theme}/${tab}: оболочка без горизонтальной прокрутки`).toBeLessThanOrEqual(1);
      if (tab === "cabinet") await page.screenshot({ path: testInfo.outputPath(`${theme}-cabinet.png`) });
    }
    expect(scrolledTabs, `${theme}: проверена прокрутка реального содержимого`).toBeGreaterThanOrEqual(3);
  }

  // The general cabinet fixture has no questionnaire callback; this local-only
  // fixture mounts the same production sheet with editable fake profile data.
  await page.goto("/?clientHarness=1&clientHarnessPage=profileSheets&sheet=profile");
  // addInitScript runs on every navigation: select dark explicitly before
  // measuring this independently mounted sheet.
  await selectDarkAppearance(page);
  const questionnaire = page.getByTestId("profile-settings-dialog");
  await expect(questionnaire.getByRole("heading", { name: "Анкета", exact: true })).toBeVisible();
  const metrics = page.getByTestId("profile-body-metrics-section");
  const contrast = await readSurfaceContrast(metrics, "input, select, [class*='fieldLabel']");
  expect(contrast.surface, "у тёмной анкеты нет белой подложки").toBeLessThan(.2);
  expect(contrast.values.length).toBeGreaterThanOrEqual(8);
  for (const field of contrast.values) {
    expect(field.paperLum, `${field.label}: тёмная поверхность`).toBeLessThan(.2);
    expect(field.ratio, `${field.label}: текст читаем на своей подложке`).toBeGreaterThanOrEqual(4.5);
  }
  await page.screenshot({ path: testInfo.outputPath("dark-questionnaire.png") });

  await page.goto("/?clientHarness=1&clientHarnessPage=workoutRunStage&clientWorkoutRunModal=technique");
  await selectDarkAppearance(page);
  const technique = page.getByTestId("workout-exercise-technique-modal").getByRole("dialog");
  await expect(technique.locator("p")).toBeVisible();
  const techniqueContrast = await readSurfaceContrast(technique, "p");
  expect(techniqueContrast.values).toHaveLength(1);
  expect(techniqueContrast.values[0].paperLum, "техника: тёмная подложка").toBeLessThan(.2);
  expect(techniqueContrast.values[0].ratio, "техника: контраст пояснения ≥ 4.5").toBeGreaterThanOrEqual(4.5);
  await page.screenshot({ path: testInfo.outputPath("dark-technique.png") });

  // Align time with the fixed photo/measurement fixture so there are genuinely
  // no overdue tasks; do not hide real task elements to manufacture this state.
  await page.clock.setFixedTime(new Date("2026-06-22T12:00:00+03:00"));
  await page.goto("/?clientHarness=1&clientBodyMeasurementTask=fresh");
  await selectDarkAppearance(page);
  const planCard = page.getByTestId("profile-summary-task-card");
  await expect(planCard).toHaveCount(1);
  await expect(planCard.getByTestId("profile-summary-primary")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Не забудь", exact: true })).toHaveCount(0);
  await expect(page.getByTestId("profile-summary-task-empty")).toHaveCount(0);
  await page.goto("/?clientHarness=1&clientBodyMeasurementTask=first&clientWeightCheckInDue=1");
  await selectDarkAppearance(page);
  const reminder = page.getByTestId("profile-summary-task-measurements");
  await expect(page.getByTestId("profile-summary-task-card").getByTestId("profile-summary-task-measurements")).toBeEnabled();
  await reminder.click();
  await expect(page.getByTestId("profile-measurements-dialog")).toBeVisible();

  await page.goto("/?clientHarness=1&clientHarnessPage=basicWorkoutToday");
  await selectDarkAppearance(page);
  const today = page.getByTestId("basic-workout-today-page");
  await today.getByRole("button", { name: "Грудь. Не выбрано.", exact: true }).click();
  await today.getByRole("button", { name: "Далее: время и условия", exact: true }).click();
  const todayContrast = await readSurfaceContrast(today, "[class*='chipRow'] button, [class*='settingGroup'] > span, [class*='locationRow'] > span, [class*='generationLimit']");
  expect(todayContrast.values.length).toBeGreaterThanOrEqual(8);
  for (const item of todayContrast.values) expect(item.ratio, `базовая тренировка: ${item.label}`).toBeGreaterThanOrEqual(4.5);

  await page.evaluate(() => localStorage.setItem("basic-workout-long-plan-access:client-harness", JSON.stringify({ activated: true })));
  await page.goto("/?clientHarness=1&clientHarnessPage=basicQuiz");
  await selectDarkAppearance(page);
  const quiz = page.getByTestId("basic-quiz-card");
  await expect(quiz).toBeVisible();
  const quizContrast = await readSurfaceContrast(quiz, "[class*='questionBody'] > p, [class*='optionButton'] small, [class*='optionButton'] strong");
  expect(quizContrast.values.length).toBeGreaterThan(0);
  for (const item of quizContrast.values) expect(item.ratio, `базовая анкета: ${item.label}`).toBeGreaterThanOrEqual(4.5);

  await page.goto("/?clientHarness=1&clientHarnessPage=measurementWizard");
  await selectDarkAppearance(page);
  const wizard = page.getByTestId("measurement-wizard-intro");
  const tipsContrast = await readSurfaceContrast(wizard, "[class*='tips'] span");
  expect(tipsContrast.values.length).toBeGreaterThanOrEqual(3);
  for (const item of tipsContrast.values) expect(item.ratio, `замеры: ${item.label}`).toBeGreaterThanOrEqual(4.5);

  await page.goto("/?clientHarness=1");
  await selectDarkAppearance(page);
  await page.getByTestId("client-nav-nutrition").click();
  await page.getByTestId("nutrition-summary").getByRole("button").click();
  const details = page.getByTestId("nutrition-plan-details");
  await expect(details).toBeVisible();
  const scoreContrast = await readSurfaceContrast(details, "[data-nutrition-plan-part='score-block'] span, [class*='badge']");
  expect(scoreContrast.values.length).toBeGreaterThanOrEqual(2);
  for (const item of scoreContrast.values) expect(item.ratio, `анализ питания: ${item.label}`).toBeGreaterThanOrEqual(4.5);
  await page.screenshot({ path: testInfo.outputPath("dark-plan-details.png") });
  assertNoErrors();
});
