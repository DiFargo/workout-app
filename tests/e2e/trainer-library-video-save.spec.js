import { test, expect } from './app-test.js';
import { failOnRuntimeErrors } from './runtime-errors.js';

const file = { name: 'replacement.mp4', mimeType: 'video/mp4', buffer: Buffer.from('local upload fixture') };
const oldVideo = '/e2e-media/side-a.mp4';
const newVideo = '/e2e-media/replacement.mp4';

async function openLibrary(page, query = '') {
  await page.route('**/e2e-media/*.mp4', route => route.fulfill({ status: 200, contentType: 'video/mp4', body: '' }));
  await page.goto(`/v2?trainerHarness=1&libraryAudit=1${query}`);
  await page.locator('[data-testid="trainer-nav-workouts"]:visible,[data-testid="trainer-desktop-nav-workouts"]:visible').click();
  await page.locator('.trainerNextPageTabs button').nth(1).click();
  const card = page.locator('.trainerNextLibrary').getByRole('button', { name: 'Редактировать упражнение Отведение рук с гантелями', exact: true });
  await card.click();
  return { card, editor: page.getByRole('dialog', { name: 'Редактирование упражнения', exact: true }) };
}

test('video replacement waits for Save, cancel retains the original and loading prevents early saves', async ({ page }, info) => {
  const assertNoErrors = failOnRuntimeErrors(page);
  let finishUpload;
  await page.route('**/e2e-library-upload', async route => {
    await new Promise(resolve => { finishUpload = resolve; });
    await route.fulfill({ json: { url: newVideo } });
  });
  const { card, editor } = await openLibrary(page);
  await expect(editor.locator('video')).toHaveAttribute('src', oldVideo);
  await editor.locator('input[type="file"]').setInputFiles(file);
  await expect(editor.getByRole('button', { name: 'Загружаем видео...' })).toBeDisabled();
  await expect(editor.getByRole('button', { name: 'Закрыть редактор упражнения' })).toBeDisabled();
  await expect.poll(() => Boolean(finishUpload)).toBe(true);
  finishUpload();
  await expect(editor.locator('video')).toHaveAttribute('src', newVideo);
  await expect(editor.getByRole('button', { name: 'Сохранить', exact: true })).toBeEnabled();
  await editor.getByRole('button', { name: 'Закрыть редактор упражнения' }).click();
  await card.click();
  await expect(editor.locator('video')).toHaveAttribute('src', oldVideo);

  await page.unroute('**/e2e-library-upload');
  await page.route('**/e2e-library-upload', route => route.fulfill({ json: { url: newVideo } }));
  await editor.locator('input[type="file"]').setInputFiles(file);
  await expect(editor.locator('video')).toHaveAttribute('src', newVideo);
  await editor.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await expect(editor).toBeHidden();
  await card.click();
  await expect(editor.locator('video')).toHaveAttribute('src', newVideo);
  await expect(editor.getByLabel(/Вес, подход|Повторы, подход/)).toHaveCount(0);
  await expect(editor.getByLabel('Техника выполнения')).toBeVisible();
  await editor.screenshot({ path: info.outputPath('video-replacement-saved.png') });
  assertNoErrors();
});

test('upload and save errors stay visible without losing the draft', async ({ page }) => {
  const assertNoErrors = failOnRuntimeErrors(page);
  await page.route('**/e2e-library-upload', route => route.fulfill({ status: 503, body: '' }));
  const { editor } = await openLibrary(page, '&librarySaveConflict=1');
  await editor.locator('input[type="file"]').setInputFiles(file);
  await expect(editor.getByRole('alert')).toContainText('Не удалось загрузить видео');
  await expect(editor.locator('video')).toHaveAttribute('src', oldVideo);
  await expect(editor.getByRole('button', { name: 'Сохранить', exact: true })).toBeEnabled();
  await page.unroute('**/e2e-library-upload');
  await page.route('**/e2e-library-upload', route => route.fulfill({ json: { url: newVideo } }));
  await editor.locator('input[type="file"]').setInputFiles(file);
  await expect(editor.locator('video')).toHaveAttribute('src', newVideo);
  await editor.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await expect(editor.getByRole('alert')).toContainText('Упражнение изменено в другом окне');
  await expect(editor.locator('video')).toHaveAttribute('src', newVideo);
  await expect(editor.getByRole('button', { name: 'Сохранить', exact: true })).toBeEnabled();
  assertNoErrors();
});
