import { test, expect, webkit, isolateTelegramSdk } from './app-test.js';
import { exerciseCardDatabase } from '../helpers/exercise-card-database.mjs';
import { manageTrainerExerciseCards } from '../../functions/trainerExerciseCards.js';
import { failOnRuntimeErrors } from './runtime-errors.js';
import { serveExerciseVideo } from './fixtures/serve-exercise-video.js';

async function setup(page, query = '') {
  const assertNoErrors = failOnRuntimeErrors(page);
  await page.route('**/e2e-media/*.mp4', route => route.fulfill({ contentType: 'video/mp4', body: '' }));
  await page.route('**/e2e-library-upload', route => route.fulfill({ json: { url: '/e2e-media/shared-new.mp4' } }));
  await page.goto(`/v2?trainerHarness=1&libraryAudit=1&cardAudit=1${query}`);
  const snapshot = page.getByTestId('card-prescription-snapshot');
  await expect(snapshot).toBeAttached({ timeout: 20_000 });
  const template = JSON.parse(await snapshot.textContent());
  const cardSnapshot = page.getByTestId('card-library-snapshot');
  const cards = await cardSnapshot.count() ? JSON.parse(await cardSnapshot.textContent()) : [];
  const db = exerciseCardDatabase({ 'trainingTemplates/card-template': template,
    ...Object.fromEntries(cards.map(card => [`trainerExerciseCards/${card.id}`, card])) });
  await page.route('**/api/trainer-exercise-cards', async route => {
    try {
      const result = await manageTrainerExerciseCards({ db, context: { uid: 'card-trainer', role: 'trainer' }, body: route.request().postDataJSON() });
      await route.fulfill({ json: result });
    } catch (error) { await route.fulfill({ status: error.status || 500, json: { error: error.message } }); }
  });
  await page.locator('[data-testid="trainer-nav-workouts"]:visible,[data-testid="trainer-desktop-nav-workouts"]:visible').click();
  await page.locator('.trainerNextPageTabs button').nth(1).click();
  return { db, template, snapshot, assertNoErrors, library: page.locator('.trainerNextLibrary'), editor: page.getByRole('dialog', { name: 'Редактирование упражнения', exact: true }) };
}

test('library removes blank duplicates across movements and never restores them after edit or delete', async ({ page }, info) => {
  const { db, template, snapshot, library, editor, assertNoErrors } = await setup(page, '&libraryDuplicateAudit=1');
  const movements = [
    ['Отведение рук с гантелями сидя в наклоне', '/e2e-media/seated.mp4'],
    ['Отведение рук с гантелями стоя в наклоне', '/e2e-media/standing.mp4'],
    ['Присед с гантелью', '/e2e-media/squat.mp4']
  ];
  const entry = name => library.getByRole('button', { name: `Редактировать упражнение ${name}`, exact: true });
  for (const [name, video] of movements) {
    await expect(entry(name)).toHaveCount(1);
    await expect(entry(name)).toContainText('С видео');
    await entry(name).click();
    await expect(editor.locator('video')).toHaveAttribute('src', video);
    await editor.getByRole('button', { name: 'Закрыть редактор упражнения' }).click();
  }
  const [originalName] = movements[0];
  await entry(originalName).click();
  await editor.getByLabel('Название', { exact: true }).fill('Отведение рук сидя — обновлено');
  await editor.getByLabel('Техника выполнения').fill('Сохраняйте устойчивое положение корпуса.');
  await editor.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await expect(editor).toBeHidden();
  await expect(entry(originalName)).toHaveCount(0);
  const renamed = entry('Отведение рук сидя — обновлено');
  await expect(renamed).toHaveCount(1);
  await renamed.click();
  await expect(editor.getByLabel('Техника выполнения')).toHaveValue('Сохраняйте устойчивое положение корпуса.');
  await editor.getByRole('button', { name: 'Удалить', exact: true }).click();
  await page.getByRole('dialog', { name: 'Удалить упражнение', exact: true }).getByRole('button', { name: 'Удалить', exact: true }).click();
  await expect(renamed).toHaveCount(0);
  await expect(entry(originalName)).toHaveCount(0);
  await expect(entry(movements[1][0])).toHaveCount(1);
  await library.getByRole('button', { name: /^Удалённые/ }).click();
  await expect(renamed).toHaveCount(1);
  await renamed.click();
  await editor.getByRole('button', { name: 'Восстановить', exact: true }).click();
  await library.getByRole('button', { name: 'К библиотеке' }).click();
  await expect(renamed).toHaveCount(1);
  await expect(entry(originalName)).toHaveCount(0);
  expect(JSON.parse(await snapshot.textContent())).toEqual(template);
  expect(db.documents.get('trainingTemplates/card-template')).toEqual(template);
  expect(db.writes).toEqual(Array(3).fill('trainerExerciseCards/card-seated'));
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: info.outputPath('deduplicated-library.png'), fullPage: true });
  assertNoErrors();
});

test('latest saved videos win across movements and stay current after metadata editing', async ({ page }) => {
  const { db, template, snapshot, library, editor, assertNoErrors } = await setup(page, '&libraryDuplicateAudit=1&videoPriorityAudit=1');
  const movements = [
    ['Отведение рук с гантелями сидя в наклоне', '/e2e-media/seated.mp4'],
    ['Отведение рук с гантелями стоя в наклоне', '/e2e-media/standing.mp4'],
    ['Присед с гантелью', '/e2e-media/squat.mp4']
  ];
  const entry = name => library.getByRole('button', { name: `Редактировать упражнение ${name}`, exact: true });
  for (const [name, video] of movements) {
    await expect(entry(name)).toHaveCount(1);
    await entry(name).click();
    await expect(editor.locator('video')).toHaveAttribute('src', video);
    await editor.getByRole('button', { name: 'Закрыть редактор упражнения' }).click();
  }
  await entry(movements[0][0]).click();
  await editor.getByLabel('Название', { exact: true }).fill('Отведение сидя — актуальный ролик');
  await editor.getByLabel('Техника выполнения').fill('Обновлённое описание без замены видео.');
  await editor.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await expect(editor).toBeHidden();
  await expect(entry(movements[0][0])).toHaveCount(0);
  await expect(entry('Отведение сидя — актуальный ролик')).toHaveCount(1);
  await entry('Отведение сидя — актуальный ролик').click();
  await expect(editor.locator('video')).toHaveAttribute('src', movements[0][1]);
  expect(db.documents.get('trainerExerciseCards/card-seated').videoUpdatedAt).toBe('2026-09-19T07:00:00.000Z');
  expect(JSON.parse(await snapshot.textContent())).toEqual(template);
  expect(db.documents.get('trainingTemplates/card-template')).toEqual(template);
  expect(db.writes).toEqual(['trainerExerciseCards/card-seated']);
  assertNoErrors();
});

test('shared card editor changes metadata only and supersedes older copies of the same movement', async ({ page }, info) => {
  const { db, template, snapshot, library, editor, assertNoErrors } = await setup(page);
  await library.getByRole('button', { name: 'Редактировать упражнение Отведение рук с гантелями', exact: true }).click();
  await expect(editor.getByLabel(/Вес, подход|Повторы, подход|Отдых|Используется вес/)).toHaveCount(0);
  await expect(editor).toContainText('Нагрузка и история не меняются');
  await editor.getByLabel('Название', { exact: true }).fill('Обновлённая карточка');
  await editor.getByLabel('Техника выполнения').fill('Сохраняйте устойчивое положение корпуса.');
  await editor.locator('input[type="file"]').setInputFiles({ name: 'new.mp4', mimeType: 'video/mp4', buffer: Buffer.from('fixture') });
  await expect(editor.locator('video')).toHaveAttribute('src', '/e2e-media/shared-new.mp4');
  expect(db.writes).toHaveLength(0);
  await editor.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await expect(editor).toBeHidden();
  await expect(library.getByRole('button', { name: 'Редактировать упражнение Обновлённая карточка', exact: true })).toBeVisible();
  await expect(library.getByRole('button', { name: 'Редактировать упражнение Разведения гантелей в стороны', exact: true })).toHaveCount(0);
  expect(JSON.parse(await snapshot.textContent())).toEqual(template);
  expect(db.documents.get('trainingTemplates/card-template')).toEqual(template);
  expect(db.writes).toHaveLength(1);
  expect(db.writes[0]).toMatch(/^trainerExerciseCards\//);
  await library.getByRole('button', { name: 'Редактировать упражнение Обновлённая карточка', exact: true }).click();
  await expect(editor.getByLabel('Техника выполнения')).toHaveValue('Сохраняйте устойчивое положение корпуса.');
  await editor.getByLabel('Техника выполнения').scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await editor.screenshot({ path: info.outputPath('shared-exercise-card.png') });
  assertNoErrors();
});

test('new library cards save independently, validate name, and can be hidden and restored', async ({ page }) => {
  const { db, template, snapshot, library, editor, assertNoErrors } = await setup(page);
  await library.getByRole('button', { name: 'Создать новое упражнение' }).click();
  await editor.getByLabel('Название', { exact: true }).fill('');
  await editor.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await expect(editor.getByRole('alert')).toContainText('Укажите название');
  expect(db.writes).toHaveLength(0);
  await editor.getByLabel('Название', { exact: true }).fill('Отдельная карточка');
  await editor.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await expect(editor).toBeHidden();
  const card = library.getByRole('button', { name: 'Редактировать упражнение Отдельная карточка', exact: true });
  await card.click();
  await editor.getByRole('button', { name: 'Удалить', exact: true }).click();
  await page.getByRole('dialog', { name: 'Удалить упражнение', exact: true }).getByRole('button', { name: 'Удалить', exact: true }).click();
  await expect(card).toBeHidden();
  await library.getByRole('button', { name: /^Удалённые/ }).click();
  await card.click();
  await editor.getByRole('button', { name: 'Восстановить', exact: true }).click();
  await library.getByRole('button', { name: 'К библиотеке' }).click();
  await expect(card).toBeVisible();
  expect(JSON.parse(await snapshot.textContent())).toEqual(template);
  expect(db.writes.every(path => path.startsWith('trainerExerciseCards/'))).toBe(true);
  assertNoErrors();
});

async function exerciseCropScenario({ page }, info) {
  await page.setViewportSize({ width: 402, height: 874 });
  const { db, template, library, editor, assertNoErrors } = await setup(page);
  await serveExerciseVideo(page);
  const entry = library.getByRole('button', { name: 'Редактировать упражнение Отведение рук с гантелями', exact: true });
  await entry.click();
  const crop = editor.getByTestId('exercise-video-crop-editor');
  const open = crop.getByRole('button', { name: 'Настроить кадр' });
  await open.click();
  const dialog = page.getByRole('dialog', { name: 'Кадр видео', exact: true });
  const zoom = dialog.getByRole('slider', { name: 'Приближение', exact: true });
  await expect(zoom).toBeEnabled({ timeout: 15000 });
  await zoom.focus(); await zoom.press('End');
  await expect(zoom).toHaveValue('3');
  const preview = dialog.getByTestId('exercise-crop-preview');
  const position = () => preview.locator('video').evaluate(video => video.style.objectPosition);
  await preview.focus(); await preview.press('ArrowLeft');
  const keyboardPosition = await position();
  expect(keyboardPosition).not.toBe('50% 50%');
  await dialog.locator('summary').click();
  await dialog.getByRole('button', { name: 'Сдвинуть кадр вверх' }).click();
  expect(await position()).not.toBe(keyboardPosition);
  await dialog.locator('summary').click();
  const rect = await preview.boundingBox();
  expect(rect.width / rect.height).toBeCloseTo(4 / 3, 2);
  await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2);
  await page.mouse.down(); await page.mouse.move(rect.x + rect.width / 2 - 35, rect.y + rect.height / 2 - 15, { steps: 5 }); await page.mouse.up();
  const selectedPosition = await position();
  const [x, y] = selectedPosition.split(' ').map(value => parseFloat(value) / 100);
  await dialog.getByRole('button', { name: 'Без обрезки', exact: true }).click();
  await expect(preview.locator('video')).toHaveCSS('object-fit', 'contain');
  await expect(preview.locator('video')).toHaveCSS('transform', 'none');
  await dialog.getByRole('button', { name: 'Кадр 4:3', exact: true }).click();
  await expect(preview.locator('video')).toHaveCSS('object-fit', 'cover');
  expect(await position()).toBe(selectedPosition);
  await dialog.getByRole('button', { name: 'Воспроизвести предпросмотр' }).click();
  await expect(dialog.getByRole('button', { name: 'Приостановить предпросмотр' })).toBeVisible();
  await dialog.getByRole('button', { name: 'Приостановить предпросмотр' }).click();
  await dialog.screenshot({ path: info.outputPath('video-crop-iphone-17-pro.png') });
  expect(db.writes).toHaveLength(0);
  await dialog.getByRole('button', { name: 'Применить', exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(crop).toContainText('Выбран кадр 4:3');
  expect(db.writes).toHaveLength(0);
  await editor.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await expect(editor).toBeHidden();
  const card = [...db.documents].find(([path]) => path.startsWith('trainerExerciseCards/'))[1];
  expect(card.videoCrop.x).toBeCloseTo(x, 4);
  expect(card.videoCrop.y).toBeCloseTo(y, 4);
  expect(card.videoCrop.zoom).toBe(3);
  expect(db.documents.get('trainingTemplates/card-template')).toEqual(template);
  await entry.click();
  await open.click();
  await expect(zoom).toHaveValue('3');
  await zoom.focus(); await zoom.press('Home');
  await dialog.getByRole('button', { name: 'Отмена', exact: true }).click();
  await expect(editor).toBeVisible();
  await open.click();
  await expect(zoom).toHaveValue('3');
  await dialog.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(editor).toBeVisible();

  for (const viewport of [{ width: 1366, height: 768 }, { width: 320, height: 720 }, { width: 874, height: 402 }]) {
    await page.setViewportSize(viewport);
    await open.click();
    await expect(zoom).toBeEnabled();
    const apply = dialog.getByRole('button', { name: 'Применить', exact: true });
    await apply.click({ trial: true });
    const actionBox = await apply.boundingBox();
    expect(actionBox.y + actionBox.height).toBeLessThanOrEqual(viewport.height);
    if (viewport.height < 500) {
      const body = dialog.locator(':scope > div');
      const bounds = await body.boundingBox();
      await page.mouse.move(bounds.x + bounds.width - 15, bounds.y + 40);
      await page.mouse.wheel(0, 300);
      await expect.poll(() => body.evaluate(el => el.scrollTop)).toBeGreaterThan(0);
    }
    await zoom.scrollIntoViewIfNeeded();
    expect(await zoom.evaluate(el => {
      const r = el.getBoundingClientRect();
      return document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2) === el;
    })).toBe(true);
    expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    await dialog.screenshot({ path: info.outputPath(`crop-${viewport.width}.png`) });
    await dialog.getByRole('button', { name: 'Закрыть кадр видео' }).click();
  }
  await editor.locator('input[type="file"]').setInputFiles({ name: 'new.mp4', mimeType: 'video/mp4', buffer: Buffer.from('fixture') });
  await expect(crop.locator('video')).toHaveAttribute('src', '/e2e-media/shared-new.mp4');
  await expect(crop).toContainText('без обрезки');
  expect(db.writes).toHaveLength(1);
  await editor.getByRole('button', { name: 'Закрыть редактор упражнения' }).click();
  assertNoErrors();
}

test('trainer frames one video, saves and cancels cropping without altering the programme', exerciseCropScenario);

test('crop sheet supports touch dragging and scrolling without moving the exercise editor', async ({ browser, baseURL }, info) => {
  test.skip(info.project.name !== 'desktop-chromium', 'Run the touch check once.');
  const page = await browser.newPage({ baseURL, isMobile: true, hasTouch: true, viewport: { width: 402, height: 874 } });
  await isolateTelegramSdk(page);
  try {
    const { library, editor, db, assertNoErrors } = await setup(page);
    await serveExerciseVideo(page);
    await library.getByRole('button', { name: 'Редактировать упражнение Отведение рук с гантелями', exact: true }).tap();
    await editor.getByRole('button', { name: 'Настроить кадр' }).tap();
    const dialog = page.getByRole('dialog', { name: 'Кадр видео', exact: true });
    const zoom = dialog.getByRole('slider', { name: 'Приближение', exact: true });
    await expect(zoom).toBeEnabled();
    await dialog.getByRole('button', { name: 'Увеличить масштаб' }).tap();
    const preview = dialog.getByTestId('exercise-crop-preview');
    const position = () => preview.locator('video').evaluate(video => video.style.objectPosition);
    const before = await position();
    const cdp = await page.context().newCDPSession(page);
    const swipe = async (x, y, dx, dy) => {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
      for (let step = 1; step <= 8; step++) {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + dx * step / 8, y: y + dy * step / 8 }] });
      }
      // Lift a stationary finger: an artificial high-speed fling would consume
      // the next tap to stop native momentum instead of activating the button.
      await page.waitForTimeout(200);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    };
    const frame = await preview.boundingBox();
    await swipe(frame.x + frame.width / 2, frame.y + frame.height / 2, -30, -20);
    await expect.poll(position).not.toBe(before);
    const seek = dialog.getByRole('slider', { name: 'Позиция видео' });
    const seekBox = await seek.boundingBox();
    await page.touchscreen.tap(seekBox.x + seekBox.width / 2, seekBox.y + seekBox.height / 2);
    await expect.poll(() => preview.locator('video').evaluate(video => video.currentTime)).toBeGreaterThan(1);

    await page.setViewportSize({ width: 402, height: 520 });
    const body = dialog.locator(':scope > div');
    const bounds = await body.boundingBox();
    const parentPosition = () => editor.evaluate(el => [el, ...el.querySelectorAll('*')].filter(node => !node.closest('dialog') && node.scrollHeight > node.clientHeight).map(node => node.scrollTop));
    const parentScroll = await parentPosition();
    await swipe(bounds.x + bounds.width - 10, bounds.y + bounds.height - 20, 0, -Math.min(180, bounds.height - 60));
    await expect.poll(() => body.evaluate(el => el.scrollTop)).toBeGreaterThan(0);
    await body.evaluate(el => new Promise(resolve => {
      let last = el.scrollTop; let stableFrames = 0;
      const check = () => {
        stableFrames = el.scrollTop === last ? stableFrames + 1 : 0;
        last = el.scrollTop;
        if (stableFrames >= 8) resolve(); else requestAnimationFrame(check);
      };
      requestAnimationFrame(check);
    }));
    expect(await parentPosition()).toEqual(parentScroll);
    await dialog.screenshot({ path: info.outputPath('crop-touch-short-screen.png') });
    await dialog.getByRole('button', { name: 'Отмена', exact: true }).tap();
    await expect(dialog).toBeHidden();
    expect(db.writes).toHaveLength(0);
    assertNoErrors();
    await cdp.detach();
  } finally { await page.close(); }
});

test('iPhone WebKit editor preserves the selected frame and cancels unsaved changes', async ({ baseURL }, info) => {
  test.skip(info.project.name !== 'desktop-chromium', 'Run the WebKit check once.');
  test.skip(process.platform === 'win32', 'Windows WebKit cannot decode these H.264 fixtures; run actual playback on macOS Safari/WebKit.');
  const browser = await webkit.launch();
  try {
    const page = await browser.newPage({ baseURL, isMobile: true, hasTouch: true, viewport: { width: 402, height: 874 } });
    await isolateTelegramSdk(page);
    await exerciseCropScenario({ page }, info);
  } finally { await browser.close(); }
});

test('WebKit keeps 4:3 framing and lets the trainer close an unavailable video preview', async ({ baseURL }, info) => {
  test.setTimeout(90_000);
  test.skip(info.project.name !== 'desktop-chromium', 'Run the WebKit layout check once.');
  const browser = await webkit.launch();
  try {
    const page = await browser.newPage({ baseURL, isMobile: true, hasTouch: true, viewport: { width: 402, height: 874 } });
    await isolateTelegramSdk(page);
    await page.goto('/?clientHarness=1&clientHarnessPage=exerciseVideo&clientExerciseVideoCrop=1');
    const frame = page.getByTestId('workout-exercise-video-frame');
    await expect(frame).toBeVisible({ timeout: 40_000 });
    const box = await frame.boundingBox();
    expect(box.width / box.height).toBeCloseTo(4 / 3, 2);
    await expect(frame.locator('video')).toHaveCSS('object-fit', 'cover');
    await expect(frame.locator('video')).toHaveCSS('object-position', '20% 80%');
    const { library, editor, db, assertNoErrors } = await setup(page);
    await library.getByRole('button', { name: 'Редактировать упражнение Отведение рук с гантелями', exact: true }).click();
    const crop = editor.getByTestId('exercise-video-crop-editor');
    await crop.getByRole('button', { name: 'Настроить кадр' }).click();
    const dialog = page.getByRole('dialog', { name: 'Кадр видео', exact: true });
    await expect(dialog.getByTestId('exercise-crop-preview').getByRole('status')).toContainText('Не удалось загрузить');
    await expect(dialog.getByRole('button', { name: 'Повторить загрузку предпросмотра' })).toBeEnabled();
    await expect(dialog.getByRole('button', { name: 'Применить', exact: true })).toBeDisabled();
    await dialog.getByRole('button', { name: 'Закрыть кадр видео' }).click();
    await editor.getByRole('button', { name: 'Закрыть редактор упражнения' }).click();
    await expect(editor).toBeHidden();
    expect(db.writes).toHaveLength(0);
    assertNoErrors();
  } finally { await browser.close(); }
});
