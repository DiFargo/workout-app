import { test, expect } from "@playwright/test";

test("voice results fit phone screens with one scrolling list and fixed actions", async ({ page }, testInfo) => {
  for (const viewport of [{ width: 320, height: 568 }, { width: 375, height: 667 }, { width: 390, height: 844 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/?clientHarness=1&clientHarnessPage=voiceReview&clientHarnessTheme=warm-light");
    const sheet = page.getByTestId("nutrition-voice-sheet");
    const body = page.getByTestId("nutrition-voice-results");
    const actions = page.getByTestId("nutrition-voice-actions");
    await expect(sheet).toBeVisible({ timeout: 20_000 });
    const sheetBox = await sheet.boundingBox();
    expect(sheetBox.y).toBeGreaterThanOrEqual(0);
    expect(sheetBox.y + sheetBox.height).toBeLessThanOrEqual(viewport.height);
    if (viewport.width < 600) {
      expect(sheetBox.height).toBe(viewport.height);
      expect(sheetBox.width).toBe(viewport.width);
    }
    for (const id of ["nutrition-voice-close", "nutrition-voice-record", "nutrition-voice-done"]) {
      const box = await page.getByTestId(id).boundingBox();
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
      expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
    }
    const initialActions = await actions.boundingBox();
    await body.evaluate(node => { node.scrollTop = node.scrollHeight; });
    expect(await actions.boundingBox()).toEqual(initialActions);
    const candidate = page.getByTestId("nutrition-voice-candidate").last();
    await candidate.scrollIntoViewIfNeeded();
    const textFits = await candidate.evaluate(node => [...node.children].every(child => child.scrollWidth <= child.clientWidth + 1 && child.scrollHeight <= child.clientHeight + 1));
    expect(textFits).toBe(true);
    await body.evaluate(node => { node.scrollTop = 0; });
    if (viewport.width === 375) await page.screenshot({ path: testInfo.outputPath("voice-results-375.png") });
  }
});

test("voice result review keeps editing, candidate selection, removal and completion", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?clientHarness=1&clientHarnessPage=voiceReview");
  await page.getByTestId("nutrition-voice-candidate").first().click();
  await expect(page.getByTestId("nutrition-voice-candidate")).toHaveCount(0);
  await page.getByRole("button", { name: "Редактировать Овощи и продукты из них: Томаты свежие с зеленью", exact: true }).click();
  await page.getByLabel("Название", { exact: true }).fill("Томаты свежие");
  const save = page.getByRole("button", { name: "Сохранить изменения" });
  let saveBounds = await save.boundingBox();
  expect(saveBounds.y + saveBounds.height).toBeLessThanOrEqual(667);
  await page.getByLabel("Порция, г", { exact: true }).fill("250");
  await page.screenshot({ path: testInfo.outputPath("voice-editor-375.png") });
  await save.click();
  await expect(page.getByRole("button", { name: "Редактировать Томаты свежие", exact: true })).toContainText("250 г");
  await page.getByRole("button", { name: "Удалить Тунец в собственном соку, консервированный", exact: true }).click();
  await page.getByTestId("nutrition-voice-record").click();
  await expect(page.getByTestId("nutrition-voice-record")).toHaveAttribute("data-nutrition-voice-state", "recording");
  await page.getByTestId("nutrition-voice-record").click();
  await expect(page.getByRole("button", { name: "Редактировать Томаты свежие", exact: true })).toBeVisible();
  await page.getByTestId("nutrition-voice-done").click();
  await expect(page.getByTestId("voice-harness-result")).toHaveText("saved:1");
  await expect(page.getByTestId("nutrition-voice-modal")).toHaveCount(0);
});

test("long voice results remain reachable without moving the close and done buttons", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?clientHarness=1&clientHarnessPage=voiceReview&clientVoiceLongList=1");
  const body = page.getByTestId("nutrition-voice-results");
  await expect(body).toBeVisible();
  expect(await body.evaluate(node => node.scrollHeight > node.clientHeight)).toBe(true);
  const actions = await page.getByTestId("nutrition-voice-actions").boundingBox();
  const close = await page.getByTestId("nutrition-voice-close").boundingBox();
  await page.getByTestId("nutrition-voice-candidate").last().scrollIntoViewIfNeeded();
  expect(await page.getByTestId("nutrition-voice-actions").boundingBox()).toEqual(actions);
  expect(await page.getByTestId("nutrition-voice-close").boundingBox()).toEqual(close);
  await page.getByTestId("nutrition-voice-close").click();
  await expect(page.getByTestId("voice-harness-result")).toHaveText("cancelled");
});

test("voice sheet has clear recording controls across phone sizes", async ({ page }, testInfo) => {
  for (const viewport of [{ width: 320, height: 720 }, { width: 390, height: 844 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/?clientHarness=1");
    await page.getByTestId("client-nav-nutrition").click();
    await page.getByTestId("nutrition-orbit-audio-search").click();
    const sheet = page.getByTestId("nutrition-voice-sheet");
    const record = page.getByTestId("nutrition-voice-record");
    await expect(sheet).toBeVisible();
    await expect(record).toHaveText("Завершить запись");
    await expect(record).toHaveCSS("background-color", "rgb(63, 115, 184)");
    await expect(page.getByTestId("nutrition-voice-meter")).toContainText("Запись идёт");
    await record.scrollIntoViewIfNeeded();
    const bounds = await record.boundingBox();
    expect(bounds.width).toBeGreaterThanOrEqual(240);
    expect(bounds.height).toBeGreaterThanOrEqual(44);
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height);
    if (viewport.width === 390) await page.screenshot({ path: testInfo.outputPath("voice-recording.png") });
    await record.click();
    await expect(record).toHaveText("Начать запись");
    await record.click();
    await expect(record).toHaveText("Завершить запись");
    await page.getByTestId("nutrition-voice-close").click();
    await expect(sheet).toHaveCount(0);
  }
});

test("voice search processing keeps a readable disabled control and can be cancelled", async ({ page }) => {
  await page.goto("/?clientHarness=1&clientVoiceState=analyzing");
  await page.getByTestId("client-nav-nutrition").click();
  await page.getByTestId("nutrition-orbit-audio-search").click();
  await page.getByTestId("nutrition-voice-record").click();
  await expect(page.getByTestId("nutrition-voice-record")).toBeDisabled();
  await expect(page.getByTestId("nutrition-voice-record")).toHaveText("Ищем продукты…");
  await expect(page.getByTestId("nutrition-voice-meter")).toContainText("Обрабатываем запись");
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("nutrition-voice-modal")).toHaveCount(0);
});

test("voice waveform responds to sound, stays quiet in silence and respects reduced motion", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const levels = [];
  for (const level of [0, 0.12, 0.85]) {
    await page.goto(`/?clientHarness=1&clientVoiceAudioLevel=${level}`);
    await page.getByTestId("client-nav-nutrition").click();
    await page.getByTestId("nutrition-orbit-audio-search").click();
    const meter = page.getByTestId("nutrition-voice-meter");
    await expect(meter).toHaveAttribute("data-speech", String(level > 0));
    await page.getByTestId("nutrition-voice-sheet").evaluate(node => Promise.all(node.getAnimations().map(animation => animation.finished)));
    const bars = meter.locator('[aria-hidden="true"] > span');
    const strokes = bars.locator("i");
    const heights = await bars.evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().height));
    levels.push(Math.max(...heights));
    if (level === 0) {
      const names = await strokes.evaluateAll(nodes => nodes.map(node => getComputedStyle(node).animationName));
      expect(names.every(name => name === "none")).toBe(true);
      expect(Math.max(...heights) - Math.min(...heights)).toBeLessThan(1);
    }
    if (level === 0.85) {
      const bounds = await meter.boundingBox();
      const readFrame = () => strokes.evaluateAll(nodes => nodes.map(node => getComputedStyle(node).transform));
      const firstFrame = await readFrame();
      await expect.poll(readFrame).not.toEqual(firstFrame);
      expect(await meter.boundingBox()).toEqual(bounds);
      await page.screenshot({ path: testInfo.outputPath("voice-waveform.png") });
      await page.emulateMedia({ reducedMotion: "reduce" });
      const names = await strokes.evaluateAll(nodes => nodes.map(node => getComputedStyle(node).animationName));
      expect(names.every(name => name === "none")).toBe(true);
      await expect(page.getByTestId("nutrition-voice-record")).toBeEnabled();
      await page.getByTestId("nutrition-voice-record").click();
      await expect(meter).toHaveAttribute("data-speech", "false");
      await expect(meter).toContainText("Готов к записи");
    }
    await page.getByTestId("nutrition-voice-close").click();
    await expect(page.getByTestId("nutrition-voice-modal")).toHaveCount(0);
  }
  expect(levels[1]).toBeGreaterThan(levels[0]);
  expect(levels[2]).toBeGreaterThan(levels[1] * 2);
});
