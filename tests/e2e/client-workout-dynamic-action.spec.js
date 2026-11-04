import { expect, test, webkit, isolateTelegramSdk, isolateGoogleAuthTransport } from "./app-test.js";
import { failOnRuntimeErrors } from "./runtime-errors.js";

test.setTimeout(90_000);

const runUrl = "/cssV2?clientHarness=1&clientHarnessPage=workoutRunStage&clientWorkoutRunStage=exercise&clientHarnessTheme=warm-light";
const picker = (page, index, count = 3) => page.getByRole("button", {
  name: `Все подходы, выбран подход ${index} из ${count}`,
  exact: true
});
const action = (page) => page.getByTestId("workout-primary-action");
const completedStatus = (page, index) => page.getByRole("button", { name: `Подход ${index} выполнен, действия`, exact: true });
const undoAction = (page, index) => page.getByRole("button", { name: `Снять отметку выполнения подхода ${index}`, exact: true });

async function undoSet(page, index) {
  await completedStatus(page, index).click();
  await undoAction(page, index).click();
}

async function openRun(page, query = "", initialSet = 2, count = 3) {
  await page.goto(`${runUrl}${query}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("client-harness-workout-run-stage")).toBeVisible({ timeout: 40_000 });
  await expect(picker(page, initialSet, count)).toBeVisible();
}

async function selectSet(page, selected, target, count = 3) {
  await picker(page, selected, count).click();
  await page.getByRole("button", { name: `Перейти к подходу ${target}`, exact: true }).click();
  await expect(picker(page, target, count)).toBeVisible();
}

async function minimizeAutomaticRest(page) {
  const timer = page.getByTestId("workout-rest-timer-expanded");
  await expect(timer).toBeVisible();
  await timer.getByRole("button", { name: "Свернуть таймер отдыха", exact: true }).click();
  await expect(timer).toBeHidden();
}

async function expectSharedGradient(page) {
  const gradient = await action(page).evaluate(node => {
    const probe = document.createElement("span");
    probe.style.backgroundImage = "var(--ownset-action-gradient)";
    document.body.append(probe);
    const expected = getComputedStyle(probe).backgroundImage;
    const actual = getComputedStyle(node).backgroundImage;
    probe.remove();
    return { actual, expected };
  });
  expect(gradient.actual).toContain("linear-gradient(");
  expect(gradient.actual).toBe(gradient.expected);
}

async function clickPrimary(page, label, expectRest = label === "Завершить подход") {
  // This deliberately represents distinct human taps, not a double tap. The
  // separate rapid-tap regression below must not wait between its two clicks.
  await page.waitForTimeout(450);
  await expect(action(page)).toHaveAccessibleName(label);
  await action(page).click();
  if (expectRest) await minimizeAutomaticRest(page);
  else if (label === "Завершить подход") await expect(page.getByTestId("workout-rest-timer-expanded")).toBeHidden();
}

test("one bottom action completes three sets before moving to the next exercise and finish", async ({ page }) => {
  const assertNoErrors = failOnRuntimeErrors(page);
  await page.setViewportSize({ width: 402, height: 760 });
  await openRun(page);
  await selectSet(page, 2, 1);
  await undoSet(page, 1);
  await expect(action(page)).toHaveAccessibleName("Завершить подход");
  await expect(action(page).locator("svg")).toHaveCount(0);
  await expect(page.getByTestId("workout-set-status")).toHaveText("Нужно выполнить");
  await expectSharedGradient(page);
  const video = page.getByTestId("workout-exercise-video-frame").locator("video");
  await video.evaluate(node => { window.__dynamicActionVideo = node; });

  for (let index = 1; index <= 3; index += 1) {
    await clickPrimary(page, "Завершить подход");
    await expect(picker(page, index)).toBeVisible();
    await expect(picker(page, index)).toHaveAccessibleDescription(`Выполнено ${index} из 3`);
    await expect(page.getByTestId("workout-rest-timer-expanded")).toBeHidden();
    await expect(page.getByTestId("workout-rest-timer").getByRole("button", { name: "Открыть таймер отдыха", exact: true })).toBeVisible();
    await expect(completedStatus(page, index)).toBeVisible();
    await expect(page.getByTestId("workout-set-status")).toHaveText("Выполнен");
    await expect.poll(() => video.evaluate(node => node === window.__dynamicActionVideo)).toBe(true);
    if (index < 3) {
      await expect(action(page)).toHaveAccessibleName(`Перейти к подходу ${index + 1} из 3`);
      await clickPrimary(page, /^Перейти к подходу \d+ из \d+$/);
      await expect(picker(page, index + 1)).toBeVisible();
      await expect(action(page)).toHaveAccessibleName("Завершить подход");
      await expect(page.getByTestId("workout-rest-timer-start")).toHaveAttribute("aria-label", "Запустить таймер отдыха");
      await expect(completedStatus(page, index + 1)).toHaveCount(0);
      await expect(page.getByTestId("workout-set-status")).toHaveText("Нужно выполнить");
    }
  }
  await expect(action(page)).toHaveAccessibleName("К следующему упражнению");
  await clickPrimary(page, "К следующему упражнению");
  await expect(page.getByTestId("workout-exercise-progress")).toHaveText("Упражнение 2 из 2");
  await expect(picker(page, 1, 2)).toBeVisible();
  await clickPrimary(page, "Завершить подход");
  await clickPrimary(page, /^Перейти к подходу \d+ из \d+$/);
  await expect(picker(page, 2, 2)).toBeVisible();
  await clickPrimary(page, "Завершить подход");
  await expect(action(page)).toHaveAccessibleName("Завершить тренировку");
  await clickPrimary(page, "Завершить тренировку");
  await expect(page.getByTestId("workout-finish-screen")).toBeVisible();
  assertNoErrors();
});

test("undo, reviewing previous sets and double taps cannot silently skip or complete another set", async ({ page }) => {
  const assertNoErrors = failOnRuntimeErrors(page);
  await page.setViewportSize({ width: 360, height: 680 });
  await openRun(page);
  // Send two real pointer clicks at the same screen position. The first opens
  // the timer, so the second must not retarget a newly labelled footer button.
  const primaryBox = await action(page).boundingBox();
  await page.mouse.click(primaryBox.x + primaryBox.width / 2, primaryBox.y + primaryBox.height / 2);
  await page.waitForTimeout(70);
  await page.mouse.click(primaryBox.x + primaryBox.width / 2, primaryBox.y + primaryBox.height / 2);
  if (await page.getByTestId("workout-rest-timer-expanded").isVisible()) await minimizeAutomaticRest(page);
  await expect(picker(page, 2)).toBeVisible();
  await expect(picker(page, 2)).toHaveAccessibleDescription("Выполнено 2 из 3");
  await expect(action(page)).toHaveAccessibleName(/^Перейти к подходу \d+ из \d+$/);
  await expect(page.getByTestId("workout-rest-timer-expanded")).toBeHidden();
  await completedStatus(page, 2).click();
  await expect(undoAction(page, 2)).toBeVisible();
  await expect(picker(page, 2)).toHaveAccessibleDescription("Выполнено 2 из 3");
  await expect(action(page)).toHaveAccessibleName(/^Перейти к подходу \d+ из \d+$/);
  await page.keyboard.press("Escape");
  await expect(undoAction(page, 2)).toBeHidden();
  await expect(completedStatus(page, 2)).toBeFocused();
  await completedStatus(page, 2).click();
  await page.keyboard.press("Escape");
  await expect(undoAction(page, 2)).toBeHidden();
  await expect(picker(page, 2)).toHaveAccessibleDescription("Выполнено 2 из 3");
  await undoSet(page, 2);
  await expect(action(page)).toHaveAccessibleName("Завершить подход");
  await expect(picker(page, 2)).toHaveAccessibleDescription("Выполнено 1 из 3");
  await clickPrimary(page, "Завершить подход");
  await clickPrimary(page, /^Перейти к подходу \d+ из \d+$/);
  await expect(picker(page, 3)).toBeVisible();
  await selectSet(page, 3, 1);
  await expect(action(page)).toHaveAccessibleName("К текущему подходу");
  await completedStatus(page, 1).click();
  await expect(undoAction(page, 1)).toBeDisabled();
  await page.keyboard.press("Escape");
  await clickPrimary(page, "К текущему подходу");
  await expect(picker(page, 3)).toBeVisible();
  await expect(action(page)).toHaveAccessibleName("Завершить подход");
  await expect(picker(page, 3)).toHaveAccessibleDescription("Выполнено 2 из 3");
  assertNoErrors();
});

test("selected set, square video and single bottom action fit without scrolling on short Telegram viewports", async ({ page }, testInfo) => {
  const assertNoErrors = failOnRuntimeErrors(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const viewport of [{ width: 360, height: 680 }, { width: 402, height: 760 }]) {
    await page.setViewportSize(viewport);
    await openRun(page);
    const deck = page.getByTestId("workout-run-stage");
    await expect.poll(() => deck.evaluate(node => node.scrollHeight - node.clientHeight)).toBeLessThanOrEqual(1);
    const geometry = await page.evaluate(() => {
      const bounds = (selector) => {
        const { left, right, top, bottom, width, height } = document.querySelector(selector).getBoundingClientRect();
        return { left, right, top, bottom, width, height };
      };
      return {
        frame: bounds('[data-testid="workout-exercise-video-frame"]'),
        row: bounds('[data-testid="workout-exercise-set-row"]'),
        dock: bounds('[data-css-module-scope="workout-stage-action-panel"]'),
        primary: bounds('[data-testid="workout-primary-action"]'),
        scrollTop: document.querySelector('[data-testid="workout-run-stage"]').scrollTop,
        overflow: document.documentElement.scrollWidth - innerWidth
      };
    });
    expect(geometry.frame.width / geometry.frame.height).toBeCloseTo(1, 2);
    expect(geometry.frame.top).toBeGreaterThanOrEqual(0);
    expect(geometry.frame.bottom).toBeLessThanOrEqual(geometry.row.top);
    expect(geometry.row.bottom).toBeLessThanOrEqual(geometry.dock.top - 8);
    expect(geometry.primary.bottom).toBeLessThanOrEqual(viewport.height);
    expect(geometry.primary.height).toBeGreaterThanOrEqual(48);
    expect(geometry.primary.width).toBeGreaterThanOrEqual(48);
    expect(geometry.scrollTop).toBe(0);
    expect(geometry.overflow).toBeLessThanOrEqual(1);
    const dock = page.locator('[data-css-module-scope="workout-stage-action-panel"]');
    await expect(dock.getByRole("button", { name: "Предыдущее", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Предыдущее упражнение", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Предыдущий подход", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Перейти к подходу \d+ из \d+$/, exact: true })).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath(`dynamic-action-${viewport.width}x${viewport.height}.png`) });
    if (viewport.width === 360) {
      await expectSharedGradient(page);
      await page.screenshot({ path: "output/playwright/rest-gradient-3.0.858-main-360x680.png" });
      await action(page).click();
      await expect(page.getByTestId("workout-rest-timer-expanded")).toBeVisible();
      await page.screenshot({ path: "output/playwright/rest-gradient-3.0.858-expanded-360x680.png" });
      await minimizeAutomaticRest(page);
    }
  }
  assertNoErrors();
});

test("manual completion cancels a running or paused timed set before its old deadline", async ({ page }) => {
  const assertNoErrors = failOnRuntimeErrors(page);
  await page.setViewportSize({ width: 390, height: 740 });
  await page.clock.install();
  for (const pauseFirst of [false, true]) {
    await openRun(page, "&clientWorkoutRunSets=timed", 1);
    const timer = page.getByTestId("workout-timed-set-timer");
    await expect(timer).toHaveCount(1);
    await timer.click();
    await expect(timer).toHaveAttribute("data-running", "true");
    if (pauseFirst) {
      await timer.click();
      await expect(timer).toHaveAttribute("data-running", "false");
    }
    await clickPrimary(page, "Завершить подход");
    const completed = completedStatus(page, 1);
    await expect(completed).toBeVisible();
    await expect(timer).toHaveAttribute("data-running", "false");
    await expect(timer).toBeDisabled();
    await expect(action(page)).toHaveAccessibleName(/^Перейти к подходу \d+ из \d+$/);
    await page.clock.fastForward(31_000);
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(completed).toBeVisible();
    await expect(picker(page, 1)).toHaveAccessibleDescription("Выполнено 1 из 3");
    await expect(page.getByTestId("workout-rest-timer-expanded")).toBeHidden();
    await clickPrimary(page, /^Перейти к подходу \d+ из \d+$/);
    await expect(picker(page, 2)).toBeVisible();
    await expect(timer).toHaveAttribute("data-running", "false");
    await expect(action(page)).toHaveAccessibleName("Завершить подход");
    await expect(page.getByTestId("workout-rest-timer-start")).toHaveAttribute("aria-label", "Запустить таймер отдыха");
    await expect(completedStatus(page, 2)).toHaveCount(0);
  }
  await openRun(page, "&clientWorkoutRunSets=timed", 1);
  const timer = page.getByTestId("workout-timed-set-timer");
  await timer.click();
  await page.clock.fastForward(31_000);
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await minimizeAutomaticRest(page);
  const autoCompleted = completedStatus(page, 1);
  await expect(autoCompleted).toBeVisible();
  await expect(picker(page, 1)).toBeVisible();
  await expect(action(page)).toHaveAccessibleName(/^Перейти к подходу \d+ из \d+$/);
  await page.clock.fastForward(2_000);
  await expect(autoCompleted).toBeVisible();
  await expect(picker(page, 1)).toHaveAccessibleDescription("Выполнено 1 из 3");
  assertNoErrors();
});

test("WebKit completes, advances and undoes a set; top back and large-text safe-area layout remain usable", async ({ baseURL }, testInfo) => {
  const browser = await webkit.launch();
  try {
    const page = await browser.newPage({ baseURL, viewport: { width: 402, height: 760 }, isMobile: true, hasTouch: true });
    await isolateTelegramSdk(page);
    await isolateGoogleAuthTransport(page);
    await page.emulateMedia({ reducedMotion: "reduce" });
    const assertNoErrors = failOnRuntimeErrors(page);
    await openRun(page);
    await clickPrimary(page, "Завершить подход");
    await expect(picker(page, 2)).toBeVisible();
    await expect(completedStatus(page, 2)).toBeVisible();
    await expect(page.getByTestId("workout-rest-timer-expanded")).toBeHidden();
    await clickPrimary(page, /^Перейти к подходу \d+ из \d+$/);
    await expect(picker(page, 3)).toBeVisible();
    await expect(action(page)).toHaveAccessibleName("Завершить подход");
    await expect(page.getByTestId("workout-rest-timer-start")).toHaveAttribute("aria-label", "Запустить таймер отдыха");
    await expect(completedStatus(page, 3)).toHaveCount(0);
    await selectSet(page, 3, 2);
    await undoSet(page, 2);
    await expect(picker(page, 2)).toHaveAccessibleDescription("Выполнено 1 из 3");
    await expect(action(page)).toHaveAccessibleName("Завершить подход");
    // A real click catches a header covered by the independent top-control layer.
    await page.getByRole("button", { name: "Предыдущее упражнение", exact: true }).click();
    await expect(page.locator('[data-workout-stage="warmup"]')).toBeVisible();
    await page.getByRole("button", { name: "Начать тренировку", exact: true }).click();
    await expect(picker(page, 2)).toBeVisible();

    // WebKit has no CDP safe-area override. Model the required 24px bottom
    // clearance by enlarging this existing dock, then verify real layout reflow.
    // This is browser layout coverage, not a claim of native iOS safe-area QA.
    await page.addStyleTag({ content: '[data-css-module-scope="workout-stage-action-panel"] { padding-bottom: 24px !important; }' });
    await page.evaluate(() => { document.documentElement.style.fontSize = "32px"; });
    const deck = page.getByTestId("workout-run-stage");
    const dock = page.locator('[data-css-module-scope="workout-stage-action-panel"]');
    await expect.poll(async () => {
      const reserved = await page.locator('[data-css-module-scope="workout-run-page"]').evaluate(node => parseFloat(node.style.getPropertyValue("--workout-dock-height")));
      return Math.abs(reserved - (await dock.boundingBox()).height);
    }).toBeLessThanOrEqual(1);
    await deck.evaluate(node => { node.scrollTop = node.scrollHeight; });
    const rowBox = await page.getByTestId("workout-exercise-set-row").boundingBox();
    const dockBox = await dock.boundingBox();
    const buttonBox = await action(page).boundingBox();
    expect(rowBox.y + rowBox.height).toBeLessThanOrEqual(dockBox.y - 8);
    expect(buttonBox.y + buttonBox.height).toBeLessThanOrEqual(760 - 24);
    expect(await deck.evaluate(node => node.scrollWidth - node.clientWidth)).toBeLessThanOrEqual(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    await action(page).click({ trial: true });
    await page.screenshot({ path: testInfo.outputPath("dynamic-action-webkit-large-text-bottom-clearance.png") });
    assertNoErrors();
  } finally {
    await browser.close();
  }
});

test("triset action follows each exercise and round instead of skipping to another set of the same exercise", async ({ page }) => {
  const assertNoErrors = failOnRuntimeErrors(page);
  await page.setViewportSize({ width: 390, height: 740 });
  await openRun(page, "&clientWorkoutRunGroup=1", 1, 2);
  const progress = page.getByTestId("workout-exercise-progress");
  for (let round = 1; round <= 2; round += 1) {
    for (let position = 1; position <= 3; position += 1) {
      await expect(progress).toContainText(`круг ${round}/2`);
      await expect(progress).toContainText(`${position}/3`);
      await expect(picker(page, round, 2)).toBeVisible();
      await clickPrimary(page, "Завершить подход", position === 3);
      await expect(picker(page, round, 2)).toBeVisible();
      await expect(page.getByTestId("workout-rest-timer-expanded")).toBeHidden();
      const nextLabel = round === 2 && position === 3 ? "Завершить тренировку" : "К следующему упражнению";
      await expect(action(page)).toHaveAccessibleName(nextLabel);
      await clickPrimary(page, nextLabel);
    }
  }
  await expect(page.getByTestId("workout-finish-screen")).toBeVisible();
  assertNoErrors();
});

test("completed rest keeps its sheet and advances without completing the next set", async ({ page }, info) => {
  const assertNoErrors = failOnRuntimeErrors(page);
  await page.setViewportSize({ width: 375, height: 740 });
  await page.clock.install();
  await openRun(page);
  await action(page).click();
  const rest = page.getByTestId("workout-rest-timer-expanded");
  await expect(rest).toBeVisible();
  await page.clock.fastForward(120_000);
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(rest).toBeVisible();
  await expect(rest.getByRole("status")).toHaveText("Отдых завершён");
  await expect(rest.getByRole("button", { name: "Запустить таймер отдыха" })).toHaveCount(0);
  await expect(rest.getByText("Пропустить остаток отдыха", { exact: true })).toHaveCount(0);
  await page.screenshot({ path: info.outputPath("rest-ready.png") });
  await rest.getByRole("button", { name: /^Перейти к подходу \d+ из \d+$/, exact: true }).click();
  await expect(rest).toBeHidden();
  await expect(picker(page, 3)).toBeVisible();
  await expect(completedStatus(page, 3)).toHaveCount(0);
  await expect(action(page)).toHaveAccessibleName("Завершить подход");
  assertNoErrors();
});

test("exercise title opens a picker without changing set completion", async ({ page }, info) => {
  const assertNoErrors = failOnRuntimeErrors(page);
  await page.setViewportSize({ width: 320, height: 720 });
  await openRun(page);
  await page.getByTestId("workout-exercise-picker-trigger").click();
  const sheet = page.getByTestId("workout-exercise-picker");
  const rows = sheet.getByTestId("workout-exercise-picker-item");
  await expect(rows).toHaveCount(2);
  await expect(rows.first()).toHaveAttribute("aria-current", "step");
  await page.screenshot({ path: info.outputPath("exercise-picker.png") });
  await rows.nth(1).click();
  await expect(sheet).toBeHidden();
  await expect(page.getByTestId("workout-exercise-progress")).toHaveText("Упражнение 2 из 2");
  await expect(picker(page, 1, 2)).toBeVisible();
  await expect(completedStatus(page, 1)).toHaveCount(0);
  await page.getByTestId("workout-exercise-picker-trigger").click();
  await sheet.getByTestId("workout-exercise-picker-item").first().click();
  await expect(picker(page, 2)).toHaveAccessibleDescription("Выполнено 1 из 3");
  assertNoErrors();
});

test("unified set card groups the counter and values, and the value row edits without completing", async ({ page }, info) => {
  const assertNoErrors = failOnRuntimeErrors(page);
  for (const viewport of [{ width: 402, height: 874 }, { width: 320, height: 720 }]) {
    await page.setViewportSize(viewport);
    await openRun(page);
    const card = page.getByTestId("workout-plan-card");
    const navigation = card.getByRole("navigation", { name: "Выбор подхода", exact: true });
    const row = card.getByTestId("workout-exercise-set-row");
    const edit = row.getByRole("button", { name: "Изменить подход 2", exact: true });
    await expect(navigation).toBeVisible();
    await expect(row).toHaveCount(1);
    await expect(edit).toContainText("60");
    await expect(edit).toContainText("10");
    await expect(edit).toHaveAccessibleDescription(/План.*60.*кг.*10/);
    const cardBox = await card.boundingBox();
    const navBox = await navigation.boundingBox();
    const rowBox = await row.boundingBox();
    const editBox = await edit.boundingBox();
    expect(navBox.y).toBeGreaterThanOrEqual(cardBox.y);
    expect(navBox.y + navBox.height).toBeLessThanOrEqual(rowBox.y + 1);
    expect(rowBox.y + rowBox.height).toBeLessThanOrEqual(cardBox.y + cardBox.height + 1);
    // The editing target includes the values and free space, not just a pencil.
    expect(editBox.width).toBeGreaterThan(rowBox.width * 0.6);
    expect(editBox.height).toBeGreaterThanOrEqual(44);
    await edit.click({ position: { x: editBox.width * 0.85, y: editBox.height / 2 } });
    const editor = page.getByTestId("workout-set-edit-modal");
    await expect(editor).toHaveAccessibleName("Редактировать подход 2");
    await expect(editor.getByTestId("workout-set-wheel-picker")).toHaveCount(2);
    await editor.getByRole("button", { name: "Закрыть", exact: true }).click();
    await expect(editor).toBeHidden();
    await expect(picker(page, 2)).toHaveAccessibleDescription("Выполнено 1 из 3");
    await expect(completedStatus(page, 2)).toHaveCount(0);
    await expect(action(page)).toHaveAccessibleName("Завершить подход");
    await expect(page.getByTestId("workout-rest-timer-expanded")).toBeHidden();
    await selectSet(page, 2, 1);
    await expect(row.getByRole("button", { name: "Изменить подход 1", exact: true })).toHaveAccessibleDescription(/Результат подхода.*60.*кг.*10/);
    await selectSet(page, 1, 2);
    await page.screenshot({ path: info.outputPath(`unified-set-card-${viewport.width}.png`) });
  }
  await selectSet(page, 2, 1);
  await page.evaluate(() => { document.documentElement.style.fontSize = "32px"; });
  const completedRow = page.getByTestId("workout-exercise-set-row");
  const completedEdit = completedRow.getByRole("button", { name: "Изменить подход 1", exact: true });
  const completedMenu = completedStatus(page, 1);
  await completedRow.evaluate(row => row.scrollIntoView({ block: "end" }));
  await completedEdit.click({ trial: true });
  await completedMenu.click({ trial: true });
  const completedLayout = await completedRow.evaluate(row => {
    const bounds = node => {
      const { left, top, right, bottom, width, height } = node.getBoundingClientRect();
      return { left, top, right, bottom, width, height };
    };
    const edit = row.querySelector('[aria-label="Изменить подход 1"]');
    const label = edit.firstElementChild.firstElementChild;
    const values = label.nextElementSibling;
    const badge = row.querySelector('[aria-label="Подход 1 выполнен, действия"]');
    const intersect = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left))
      * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
    const rowBox = bounds(row), badgeBox = bounds(badge);
    return { row: rowBox, edit: bounds(edit), label: bounds(label), values: bounds(values), badge: badgeBox,
      labelOverlap: intersect(bounds(label), badgeBox), valuesOverlap: intersect(bounds(values), badgeBox) };
  });
  expect(completedLayout.labelOverlap, JSON.stringify(completedLayout)).toBeLessThanOrEqual(1);
  expect(completedLayout.valuesOverlap, JSON.stringify(completedLayout)).toBeLessThanOrEqual(1);
  for (const box of [completedLayout.edit, completedLayout.label, completedLayout.values, completedLayout.badge]) {
    expect(box.left).toBeGreaterThanOrEqual(completedLayout.row.left - 1);
    expect(box.right).toBeLessThanOrEqual(completedLayout.row.right + 1);
  }
  await expect(picker(page, 1)).toHaveAccessibleDescription("Выполнено 1 из 3");
  await page.screenshot({ path: info.outputPath("unified-set-completed-320-32.png") });
  assertNoErrors();
});

test("single labelled rest trigger starts idle rest and opens running or paused rest without toggling it", async ({ page }) => {
  const assertNoErrors = failOnRuntimeErrors(page);
  await page.setViewportSize({ width: 402, height: 874 });
  await page.clock.install();
  await openRun(page);
  const docked = page.getByTestId("workout-rest-timer");
  const expanded = page.getByTestId("workout-rest-timer-expanded");
  const secondsIn = async (timer) => {
    const text = await timer.locator("b, strong").first().textContent();
    const [minutes, seconds] = text.trim().split(":").map(Number);
    return minutes * 60 + seconds;
  };
  await expect(docked.getByRole("button")).toHaveCount(1);
  const open = docked.getByRole("button", { name: "Открыть таймер отдыха", exact: true });
  await expect(open).toContainText("Открыть");
  await open.click();
  await expect(expanded.getByRole("button", { name: "Остановить таймер отдыха", exact: true })).toBeVisible();
  const before = await secondsIn(expanded);
  await page.clock.fastForward(5_000);
  await expect.poll(() => secondsIn(expanded)).toBeLessThan(before);
  await expanded.getByRole("button", { name: "Остановить таймер отдыха", exact: true }).click();
  const pausedAt = await secondsIn(expanded);
  await minimizeAutomaticRest(page);
  await expect(docked.getByRole("button")).toHaveCount(1);
  await expect(open).toContainText("Отдых на паузе");
  await expect(open).toHaveAccessibleDescription(/На паузе\. Осталось/);
  await open.click();
  await expect(expanded.getByRole("button", { name: "Продолжить таймер отдыха", exact: true })).toBeVisible();
  await page.clock.fastForward(5_000);
  expect(await secondsIn(expanded)).toBe(pausedAt);
  await expanded.getByRole("button", { name: "Продолжить таймер отдыха", exact: true }).click();
  await minimizeAutomaticRest(page);
  await clickPrimary(page, "Завершить подход");
  await clickPrimary(page, /^Перейти к подходу \d+ из \d+$/);
  await expect(picker(page, 3)).toHaveAccessibleDescription("Выполнено 2 из 3");
  const start = docked.getByRole("button", { name: "Запустить таймер отдыха", exact: true });
  await expect(start).toContainText("Запустить");
  await expect(docked.getByRole("button")).toHaveCount(1);
  await start.click();
  await expect(expanded).toBeVisible();
  await expect(expanded.getByRole("button", { name: "Остановить таймер отдыха", exact: true })).toBeVisible();
  await expect(completedStatus(page, 3)).toHaveCount(0);
  await minimizeAutomaticRest(page);
  await expect(open).toBeVisible();
  await expect(docked.getByRole("button")).toHaveCount(1);
  assertNoErrors();
});

test("compact exercise actions keep replacement in an accessible menu with its unavailable reason", async ({ page }, info) => {
  const assertNoErrors = failOnRuntimeErrors(page);
  await page.setViewportSize({ width: 402, height: 874 });
  await openRun(page);
  const toolbar = page.getByRole("navigation", { name: "Действия с упражнением", exact: true });
  const more = toolbar.getByRole("button", { name: "Другие действия с упражнением", exact: true });
  const menu = page.getByRole("menu", { name: "Другие действия с упражнением", exact: true });
  await expect(toolbar.getByRole("button")).toHaveCount(3);
  await expect(toolbar.getByRole("button", { name: "Открыть раздел «Техника»", exact: true })).toBeVisible();
  await expect(toolbar.getByRole("button", { name: "Открыть заметку тренеру", exact: true })).toHaveText("Заметка");
  await expect(menu).toHaveCount(0);
  const box = await more.boundingBox();
  expect(box.width).toBeGreaterThanOrEqual(44);
  expect(box.height).toBeGreaterThanOrEqual(44);
  await more.click();
  await expect(more).toHaveAttribute("aria-expanded", "true");
  const swap = menu.getByRole("menuitem", { name: "Заменить упражнение", exact: true });
  await expect(swap).toBeEnabled();
  await swap.click();
  await expect(menu).toHaveCount(0);
  const swapSheet = page.getByTestId("basic-workout-exercise-swap-modal");
  await expect(swapSheet).toContainText("У этого упражнения уже есть выполненные подходы");
  await swapSheet.getByRole("button", { name: "Вернуться к упражнению", exact: true }).click();
  await expect(picker(page, 2)).toHaveAccessibleDescription("Выполнено 1 из 3");
  await page.getByTestId("workout-exercise-picker-trigger").click();
  await page.getByTestId("workout-exercise-picker-item").nth(1).click();
  await more.click();
  await expect(swap).toBeDisabled();
  await expect(swap).toHaveAccessibleDescription("Тренер пока не назначил варианты замены");
  await expect(menu.getByText("Тренер пока не назначил варианты замены", { exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath("unified-card-unavailable-replacement.png") });
  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);
  await expect(more).toBeFocused();
  await more.click();
  await toolbar.getByRole("button", { name: "Открыть заметку тренеру", exact: true }).click();
  await expect(menu).toHaveCount(0);
  const note = page.getByTestId("workout-exercise-note-modal");
  await expect(note).toBeVisible();
  await note.getByRole("button", { name: "Закрыть заметку тренеру", exact: true }).click();
  await expect(note).toBeHidden();
  await expect(action(page)).toHaveAccessibleName("Завершить подход");
  assertNoErrors();
});

function exerciseHistoryEntry(id, date, weight, assignmentVersion) {
  return { id, date, assignedProgramUpdatedAt: assignmentVersion, summary: `1 × ${weight} кг × 12 повт.`,
    sets: [{ set: 1, weight, reps: 12, setType: "working" }] };
}

async function stubAllTimeExerciseHistory(page, mode = "hold-more") {
  let moduleRequests = 0;
  const recent = [exerciseHistoryEntry("recent-2", "2026-10-21T12:00:00.000Z", 35, "current-program"),
    exerciseHistoryEntry("recent-1", "2026-09-20T12:00:00.000Z", 32.5, "current-program")];
  const old = [exerciseHistoryEntry("old-2", "2026-08-15T12:00:00.000Z", 30, "previous-program"),
    exerciseHistoryEntry("old-1", "2026-07-10T12:00:00.000Z", 25, "previous-program")];
  await page.route("**/src/utils/workoutExerciseHistory.js*", route => {
    moduleRequests++;
    return route.fulfill({ contentType: "application/javascript", body: `
      window.__exerciseHistoryCalls = [];
      window.__exerciseHistoryForces = [];
      let moreAttempts = 0;
      export async function loadRecentWorkoutExerciseHistory(context, options = {}) {
        const cursor = options.cursor ?? null;
        window.__exerciseHistoryCalls.push({ scope: context.scope, cursor, hasAssignmentFilter: Object.hasOwn(context, "assignmentVersion") });
        window.__exerciseHistoryForces.push(options.force === true);
        if (${JSON.stringify(mode)} === "obsolete-once" && window.__exerciseHistoryCalls.length === 1
          || cursor !== null && ${JSON.stringify(mode)} === "obsolete-more-once" && ++moreAttempts === 1) {
          return { entries: [], searchedWorkouts: 0, hasMore: false, nextCursor: null, isCurrent: () => false };
        }
        if (cursor !== null && ${JSON.stringify(mode)} === "fail-once" && ++moreAttempts === 1) throw new Error("Synthetic page failure");
        const value = cursor === null
          ? { entries: ${JSON.stringify(mode === "empty-first" ? [] : recent)}, searchedWorkouts: 20, hasMore: true, nextCursor: "older-page-1" }
          : { entries: ${JSON.stringify(old)}, searchedWorkouts: 8, hasMore: false, nextCursor: null };
        if (cursor !== null && ${JSON.stringify(mode)} === "hold-more") {
          return new Promise(resolve => { window.__releaseExerciseHistoryPage = () => resolve({ ...value, isCurrent: () => true }); });
        }
        return { ...value, isCurrent: () => true };
      }` });
  });
  return { moduleRequests: () => moduleRequests };
}

test("history icon keeps the actual set text exactly centered without a fake left control", async ({ page }, info) => {
  const assertNoErrors = failOnRuntimeErrors(page);
  await page.setViewportSize({ width: 320, height: 720 });
  await openRun(page);
  await selectSet(page, 2, 1);
  const navigation = page.getByRole("navigation", { name: "Выбор подхода", exact: true });
  const history = navigation.getByRole("button", { name: "История упражнения", exact: true });
  const selected = picker(page, 1);
  await expect(navigation.getByRole("button")).toHaveCount(2);
  await expect(history).toHaveText("");
  await expect(history.locator("svg")).toHaveCount(1);
  for (const viewport of [{ width: 320, height: 720 }, { width: 375, height: 812 }, { width: 402, height: 874 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(viewport);
    for (const fontSize of [16, 32]) {
      await page.evaluate(value => { document.documentElement.style.fontSize = `${value}px`; }, fontSize);
      const historyLayout = () => page.evaluate(() => {
        const bounds = (node) => {
          const { x, y, width, height, top, right, bottom, left } = node.getBoundingClientRect();
          return { x, y, width, height, top, right, bottom, left };
        };
        const history = document.querySelector('[aria-label="История упражнения"]');
        const label = document.querySelector('nav[aria-label="Выбор подхода"] [aria-live="polite"]');
        const range = document.createRange(); range.selectNodeContents(label);
        const historyBox = bounds(history);
        const hit = document.elementFromPoint(historyBox.x + historyBox.width / 2, historyBox.y + historyBox.height / 2);
        const deck = document.querySelector('[data-testid="workout-run-stage"]');
        const ancestors = [];
        for (let node = history.parentElement; node && ancestors.length < 10; node = node.parentElement) {
          const style = getComputedStyle(node);
          ancestors.push({ tag: node.tagName, class: node.className, bounds: bounds(node),
            overflowY: style.overflowY, scrollTop: node.scrollTop, scrollHeight: node.scrollHeight, clientHeight: node.clientHeight,
            paddingBottom: style.paddingBottom, scrollPaddingBottom: style.scrollPaddingBottom });
        }
        return { viewport: { width: innerWidth, height: innerHeight }, history: historyBox,
          label: bounds(range), labelElement: bounds(label), labelContainer: bounds(label.parentElement),
          chevron: bounds(label.parentElement.querySelector("svg")), ancestors,
          panel: bounds(document.querySelector('[data-css-module-scope="workout-stage-action-panel"]')),
          hit: hit && { tag: hit.tagName, class: hit.className, text: hit.textContent.slice(0, 100), historyContainsHit: history.contains(hit) },
          deck: { ...bounds(deck), scrollTop: deck.scrollTop, scrollHeight: deck.scrollHeight, clientHeight: deck.clientHeight,
            maxScroll: deck.scrollHeight - deck.clientHeight } };
      });
      const beforeTrial = await historyLayout();
      try {
        await history.click({ trial: true, timeout: 10_000 });
      } catch (error) {
        await info.attach(`history-layout-${viewport.width}-${fontSize}`, {
          body: JSON.stringify({ before: beforeTrial, after: await historyLayout() }, null, 2), contentType: "application/json"
        });
        await page.screenshot({ path: info.outputPath(`history-unreachable-${viewport.width}-${fontSize}.png`) });
        throw error;
      }
      const geometry = await selected.locator('[aria-live="polite"]').evaluate(label => {
        const navigation = label.closest('nav[aria-label="Выбор подхода"]');
        const button = navigation.querySelector('[aria-label="История упражнения"]');
        const range = document.createRange(); range.selectNodeContents(label);
        const text = range.getBoundingClientRect(), nav = navigation.getBoundingClientRect(), icon = button.getBoundingClientRect();
        const chevron = label.parentElement.querySelector("svg").getBoundingClientRect();
        return { offset: Math.abs(text.x + text.width / 2 - (nav.x + nav.width / 2)), textWidth: text.width,
          iconWidth: icon.width, iconHeight: icon.height, iconRight: icon.right, navRight: nav.right,
          chevronGap: chevron.left - text.right,
          iconHit: button.contains(document.elementFromPoint(icon.x + icon.width / 2, icon.y + icon.height / 2)),
          overflow: document.documentElement.scrollWidth - innerWidth };
      });
      expect(geometry.textWidth).toBeGreaterThan(0);
      expect(geometry.offset, JSON.stringify({ viewport, fontSize, geometry })).toBeLessThanOrEqual(1);
      expect(geometry.chevronGap).toBeGreaterThanOrEqual(0);
      expect(geometry.chevronGap).toBeLessThanOrEqual(20);
      expect(geometry.iconWidth).toBeGreaterThanOrEqual(44);
      expect(geometry.iconHeight).toBeGreaterThanOrEqual(44);
      expect(geometry.iconRight).toBeLessThanOrEqual(geometry.navRight + 1);
      expect(geometry.iconHit).toBe(true);
      expect(geometry.overflow).toBeLessThanOrEqual(1);
      await page.screenshot({ path: info.outputPath(`centered-history-${viewport.width}-${fontSize}.png`) });
    }
  }
  assertNoErrors();
});

test("all-time exercise history loads old-program pages on demand and adds a four-point chart", async ({ page }, info) => {
  const assertNoErrors = failOnRuntimeErrors(page);
  const stub = await stubAllTimeExerciseHistory(page);
  await page.setViewportSize({ width: 375, height: 740 });
  await openRun(page);
  expect(stub.moduleRequests()).toBe(0);
  await page.getByRole("button", { name: "История упражнения", exact: true }).click();
  const history = page.getByTestId("workout-exercise-progress-modal");
  const chart = history.getByTestId("workout-exercise-progress-chart");
  const entries = history.locator("ol > li");
  const more = history.getByRole("button", { name: "Загрузить более ранние записи упражнения", exact: true });
  await expect(entries).toHaveCount(2);
  await expect(chart).toContainText("По загруженным записям");
  await expect(chart.getByRole("img")).toHaveCount(0);
  expect(stub.moduleRequests()).toBe(1);
  expect(await page.evaluate(() => window.__exerciseHistoryCalls)).toEqual([{ scope: "all", cursor: null, hasAssignmentFilter: false }]);
  await more.click();
  await expect(more).toBeDisabled();
  await expect(entries).toHaveCount(2);
  await expect.poll(() => page.evaluate(() => window.__exerciseHistoryCalls.length)).toBe(2);
  await more.evaluate(button => { button.click(); button.click(); });
  expect(await page.evaluate(() => window.__exerciseHistoryCalls.length)).toBe(2);
  await page.evaluate(() => window.__releaseExerciseHistoryPage());
  await expect(entries).toHaveCount(4);
  await expect(entries.nth(2)).toContainText("1 × 30 кг × 12 повт.");
  await expect(entries.nth(3)).toContainText("1 × 25 кг × 12 повт.");
  await expect(chart).toContainText("За всё время");
  await expect(chart.getByRole("img")).toBeVisible();
  await expect(chart.locator("svg circle")).toHaveCount(4);
  await expect(more).toHaveCount(0);
  await expect(history).toContainText("Доступные записи за весь период загружены.");
  expect(await page.evaluate(() => window.__exerciseHistoryCalls)).toEqual([
    { scope: "all", cursor: null, hasAssignmentFilter: false }, { scope: "all", cursor: "older-page-1", hasAssignmentFilter: false }
  ]);
  await page.screenshot({ path: info.outputPath("all-time-exercise-history-four-points.png") });
  await history.getByRole("button", { name: "Закрыть прогресс упражнения" }).click();
  await expect(history).toBeHidden();
  await expect(picker(page, 2)).toHaveAccessibleDescription("Выполнено 1 из 3");
  assertNoErrors();
});

test("all-time exercise history preserves loaded entries on page failure and retries the same cursor", async ({ page }) => {
  const assertNoErrors = failOnRuntimeErrors(page);
  await stubAllTimeExerciseHistory(page, "fail-once");
  await page.setViewportSize({ width: 375, height: 740 });
  await openRun(page);
  await page.getByRole("button", { name: "История упражнения", exact: true }).click();
  const history = page.getByTestId("workout-exercise-progress-modal");
  const entries = history.locator("ol > li");
  const more = history.getByRole("button", { name: "Загрузить более ранние записи упражнения", exact: true });
  await expect(entries).toHaveCount(2);
  await more.click();
  await expect(history.getByRole("alert")).toContainText("Уже показанные результаты сохранены.");
  await expect(entries).toHaveCount(2);
  await expect(entries.first()).toContainText("1 × 35 кг × 12 повт.");
  await expect(more).toHaveText("Повторить загрузку");
  await expect(more).toBeEnabled();
  await more.click();
  await expect(entries).toHaveCount(4);
  await expect(history.getByRole("alert")).toHaveCount(0);
  expect(await page.evaluate(() => window.__exerciseHistoryCalls.map(call => call.cursor))).toEqual([null, "older-page-1", "older-page-1"]);
  await expect(history.getByTestId("workout-exercise-progress-chart").locator("svg circle")).toHaveCount(4);
  assertNoErrors();
});

test("all-time exercise history keeps paging after an empty first page instead of declaring all history empty", async ({ page }) => {
  const assertNoErrors = failOnRuntimeErrors(page);
  await stubAllTimeExerciseHistory(page, "empty-first");
  await page.setViewportSize({ width: 375, height: 740 });
  await openRun(page);
  await page.getByRole("button", { name: "История упражнения", exact: true }).click();
  const history = page.getByTestId("workout-exercise-progress-modal");
  const more = history.getByRole("button", { name: "Загрузить более ранние записи упражнения", exact: true });
  await expect(history.getByText("В загруженных тренировках записей пока нет. Можно посмотреть более ранние.", { exact: true })).toBeVisible();
  await expect(history.getByText("В сохранённой истории не найдено сопоставимых выполнений упражнения.", { exact: true })).toHaveCount(0);
  await expect(more).toBeEnabled();
  await more.click();
  await expect(history.locator("ol > li")).toHaveCount(2);
  await expect(history.locator("ol > li").last()).toContainText("1 × 25 кг × 12 повт.");
  await expect(history.getByTestId("workout-exercise-progress-chart")).toContainText("За всё время");
  await expect(more).toHaveCount(0);
  expect(await page.evaluate(() => window.__exerciseHistoryCalls.map(call => call.cursor))).toEqual([null, "older-page-1"]);
  assertNoErrors();
});

test("obsolete history results stop loading and explicit refresh forces a fresh first page", async ({ page }) => {
  const assertNoErrors = failOnRuntimeErrors(page);
  await page.setViewportSize({ width: 375, height: 740 });
  for (const append of [false, true]) {
    await stubAllTimeExerciseHistory(page, append ? "obsolete-more-once" : "obsolete-once");
    await openRun(page);
    await page.getByRole("button", { name: "История упражнения", exact: true }).click();
    const history = page.getByTestId("workout-exercise-progress-modal");
    const entries = history.locator("ol > li");
    if (append) {
      await expect(entries).toHaveCount(2);
      await history.getByRole("button", { name: "Загрузить более ранние записи упражнения", exact: true }).click();
    }
    await expect(history.getByRole("alert")).toContainText("История изменилась. Обнови список, чтобы продолжить просмотр.");
    await expect(history.getByText("Загружаем последние записи…", { exact: true })).toHaveCount(0);
    await expect(entries).toHaveCount(append ? 2 : 0);
    const refresh = history.getByRole("button", { name: /^Обновить историю(?: упражнения)?$/ });
    await expect(refresh).toBeEnabled();
    expect(await page.evaluate(() => window.__exerciseHistoryForces)).toEqual(append ? [false, false] : [false]);
    await refresh.click();
    await expect(entries).toHaveCount(2);
    await expect(history.getByRole("alert")).toHaveCount(0);
    await expect(history.getByRole("button", { name: "Загрузить более ранние записи упражнения", exact: true })).toBeEnabled();
    expect(await page.evaluate(() => window.__exerciseHistoryForces)).toEqual(append ? [false, false, true] : [false, true]);
    expect(await page.evaluate(() => window.__exerciseHistoryCalls.at(-1).cursor)).toBe(null);
  }
  assertNoErrors();
});

// Each test owns the mobile viewport, so do not repeat the same matrix in the
// desktop project. A separate WebKit run can use this file unchanged.
test.beforeEach(() => { test.skip(test.info().project.name === "desktop-chromium", "This focused mobile matrix runs once"); });
