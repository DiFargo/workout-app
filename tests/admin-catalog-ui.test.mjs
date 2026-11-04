import assert from "node:assert/strict";
import test from "node:test";
import { mkdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { rolldown } from "rolldown";
import { transform } from "lightningcss";
import { chromium, expect } from "@playwright/test";

const source = name => fileURLToPath(new URL(`../src/${name}`, import.meta.url)).replaceAll("\\", "/");
const css = [];
const bundle = await rolldown({ input: "admin-catalog-scene", platform: "browser", transform: { jsx: { runtime: "automatic" } }, plugins: [{
  name: "actual-admin-catalog-local-firestore",
  resolveId(id) {
    if (id === "admin-catalog-scene") return id;
    if (id === "firebase/firestore") return "catalog-firestore";
    if (/(?:^|\/)firebase(?:\.js)?$/.test(id)) return "catalog-firebase";
    if (/(?:^|\/)firebaseStorage(?:\.js)?$/.test(id)) return "catalog-storage";
    if (/(?:^|\/)ProtectedExerciseVideo(?:\.jsx)?$/.test(id)) return "catalog-video";
    if (/(?:^|\/)AdminBasicProgramLifecycle(?:\.jsx)?$/.test(id)) return "catalog-programs";
    return null;
  },
  async load(id) {
    if (id.endsWith(".css")) {
      const sheet = transform({ filename: id, code: await readFile(id), cssModules: true, errorRecovery: false });
      css.push(sheet.code.toString());
      return { moduleType: "js", code: `export default ${JSON.stringify(Object.fromEntries(Object.entries(sheet.exports).map(([key, value]) => [key, value.name])))};` };
    }
    if (id === "catalog-firebase") return "export const db={};export const auth={currentUser:{uid:'admin-fixture'}};window.catalogAuth=auth;";
    if (id === "catalog-video") return { moduleType: "jsx", code: "export default function Video({src}){return <video data-testid='catalog-video-preview' src={src} controls/>;}" };
    if (id === "catalog-programs") return "export default function Programs(){return null;}";
    if (id === "catalog-storage") return "window.catalogUploads=[];export async function uploadStorageFile(path,file,options){window.catalogUploads.push({path,name:file.name,type:options.contentType});return {url:'https://fixture.invalid/'+path};}";
    if (id === "catalog-firestore") return `
      window.catalogDb={readMode:'hold',writeMode:'success',reads:[],writes:[],resolvedReads:0,overrides:{},releaseRead:null,releaseWrite:null};
      export const collection=(_, ...parts)=>({path:parts.join('/')});export const doc=(_, ...parts)=>({path:parts.join('/')});
      export const serverTimestamp=()=> 'server-timestamp';
      export async function getDocs(ref){const state=window.catalogDb;state.reads.push(ref.path);const mode=state.readMode;
        if(mode==='hold')await new Promise(resolve=>{state.releaseRead=resolve});
        state.resolvedReads++;if(mode==='fail')throw new Error('overrides unavailable');
        const docs=Object.entries(state.overrides).map(([id,value])=>({id,data:()=>({...value})}));return {docs,forEach:fn=>docs.forEach(fn)};}
      export async function setDoc(ref,patch,options){const state=window.catalogDb;state.writes.push({path:ref.path,patch,options});const mode=state.writeMode;
        if(mode==='hold')await new Promise(resolve=>{state.releaseWrite=resolve});
        if(mode==='fail')throw new Error('write rejected');const id=ref.path.split('/').at(-1);state.overrides[id]={...state.overrides[id],...patch};}
    `;
    if (id !== "admin-catalog-scene") return null;
    return { moduleType: "jsx", code: `
      import React from'react';import{createRoot}from'react-dom/client';
      import Catalog from ${JSON.stringify(source("components/admin/AdminBaseLibrary.jsx"))};
      import{useModalFocusTrap}from ${JSON.stringify(source("shared/hooks/useModalFocusTrap.js"))};
      import{advanceAuthSession}from ${JSON.stringify(source("utils/authSession.js"))};
      const exercises=Object.freeze([
        Object.freeze({id:'press',name:'Жим лёжа с гантелями',muscleGroup:'Грудь',equipment:'Гантели',note:'Опускайте руки плавно',videoUrl:'/fixture-press.mp4'}),
        Object.freeze({id:'row',name:'Тяга нижнего блока',muscleGroup:'Спина',equipment:'Блок'}),
        Object.freeze({id:'squat',name:'Приседания с гантелью',muscleGroup:'Ноги',note:'Сохраняйте нейтральную спину'})]);
      const original=JSON.stringify(exercises),root=createRoot(document.getElementById('root'));let key=0;
      function Scene(){useModalFocusTrap();return <Catalog embedded initialTab='exercises' exercises={exercises}/>;}
      window.catalogScene={show:({readMode='hold'}={})=>{window.catalogDb.readMode=readMode;root.render(<Scene key={++key}/>);},
        relogin:()=>advanceAuthSession(window.catalogAuth,window.catalogAuth.currentUser),baseUnchanged:()=>JSON.stringify(exercises)===original};
      window.catalogScene.show();
    ` };
  }
}] });
const generated = await bundle.generate({ format: "iife", codeSplitting: false });
await bundle.close();
const code = generated.output.find(item => item.type === "chunk").code;
const catalog = page => page.getByTestId("admin-base-library");
const cards = page => catalog(page).locator("article");
const editor = page => page.getByRole("dialog", { name: "Редактировать упражнение", exact: true });
const press = page => cards(page).filter({ hasText: "Жим лёжа с гантелями" });
const media = (page, title) => editor(page).locator("details").filter({ has: page.getByText(title, { exact: true }) });
const settleUi = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const ready = async page => {
  await page.evaluate(() => window.catalogDb.releaseRead());
  await expect(catalog(page).getByRole("button", { name: "Редактировать", exact: true }).first()).toBeEnabled();
};

async function fixture(run) {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 402, height: 874 } });
    page.setDefaultTimeout(4000);
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.route("**/*", route => route.abort());
    await page.setContent('<meta name="viewport" content="width=device-width,initial-scale=1"><main id="root"></main>');
    await page.addStyleTag({ content: `:root{--ownset-action-gradient:linear-gradient(115deg,#467b72 0%,#3e748b 54%,#3565a3 100%)}body{margin:0;padding:12px;background:#f2f2f7;font-family:Arial,sans-serif}${css.join("\n")}` });
    await page.addScriptTag({ content: code });
    await expect(cards(page)).toHaveCount(3);
    await expect.poll(() => page.evaluate(() => window.catalogDb.reads.length)).toBe(1);
    await run(page);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
}

test("каталог: loading блокирует редактор, ошибка загрузки сохраняет базовые строки и retry ничего не записывает", { timeout: 30000 }, async () => {
  await fixture(async page => {
    await expect(catalog(page)).toContainText("Загружаем изменения каталога");
    for (const button of await catalog(page).getByRole("button", { name: "Редактировать", exact: true }).all()) await expect(button).toBeDisabled();
    await page.evaluate(() => window.catalogScene.show({ readMode: "fail" }));
    await expect(catalog(page).getByRole("alert")).toContainText("Не удалось загрузить сохранённые изменения");
    await expect(cards(page)).toHaveCount(3);
    await expect(press(page)).toBeVisible();
    await expect(catalog(page).getByRole("button", { name: "Редактировать", exact: true }).first()).toBeDisabled();
    await page.evaluate(() => { window.catalogDb.readMode = "success"; });
    await catalog(page).getByRole("button", { name: "Повторить загрузку", exact: true }).click();
    await expect(catalog(page).getByRole("button", { name: "Редактировать", exact: true }).first()).toBeEnabled();
    await expect(cards(page)).toHaveCount(3);
    assert.deepEqual(await page.evaluate(() => window.catalogDb.writes), []);
    assert.equal(await page.evaluate(() => window.catalogScene.baseUnchanged()), true);
  });
});

test("каталог: multiword ё/е search, фильтры мышц/медиа и reset работают локально", { timeout: 30000 }, async () => {
  await fixture(async page => {
    await ready(page);
    const search = catalog(page).getByRole("searchbox", { name: "Поиск в каталоге" });
    await search.fill("ГАНТЕЛЯМИ лежа");
    await expect(cards(page)).toHaveCount(1);
    await expect(press(page)).toBeVisible();
    await catalog(page).getByRole("combobox", { name: "Группа мышц" }).selectOption("Грудь");
    await catalog(page).getByRole("combobox", { name: "Содержимое" }).selectOption("no-video");
    await expect(catalog(page)).toContainText("Упражнения не найдены");
    await catalog(page).getByRole("button", { name: "Сбросить", exact: true }).click();
    await expect(search).toHaveValue("");
    await expect(cards(page)).toHaveCount(3);
    await catalog(page).getByRole("combobox", { name: "Содержимое" }).selectOption("no-technique");
    await expect(cards(page)).toHaveCount(1);
    await expect(cards(page)).toContainText("Тяга нижнего блока");
    assert.equal((await page.evaluate(() => window.catalogDb.reads)).length, 1);
    assert.deepEqual(await page.evaluate(() => window.catalogDb.writes), []);
  });
});

test("каталог: отмена редактора не пишет данные, успешный ack обновляет только override и блокирует поздний ввод", { timeout: 30000 }, async () => {
  await fixture(async page => {
    await ready(page);
    await press(page).getByRole("button", { name: "Редактировать", exact: true }).click();
    await editor(page).getByLabel("Название", { exact: true }).fill("Несохранённое название");
    await editor(page).getByRole("button", { name: "Отмена", exact: true }).click();
    await expect(editor(page)).toHaveCount(0);
    assert.deepEqual(await page.evaluate(() => window.catalogDb.writes), []);
    await expect(press(page)).toBeVisible();

    await press(page).getByRole("button", { name: "Редактировать", exact: true }).click();
    await editor(page).getByLabel("Название", { exact: true }).fill("Жим с гантелями — уточнённая техника");
    await page.evaluate(() => { window.catalogDb.writeMode = "hold"; });
    await editor(page).getByRole("button", { name: "Сохранить", exact: true }).click();
    await expect(editor(page).getByRole("button", { name: "Сохраняем…", exact: true })).toBeDisabled();
    for (const input of await editor(page).getByRole("textbox").all()) await expect(input).toBeDisabled();
    await page.keyboard.press("Escape");
    await editor(page).locator("..").click({ position: { x: 1, y: 1 } });
    await expect(editor(page)).toBeVisible();
    await page.evaluate(() => window.catalogDb.releaseWrite());
    await expect(editor(page)).toHaveCount(0);
    await expect(catalog(page).getByRole("heading", { name: "Жим с гантелями — уточнённая техника", exact: true })).toBeVisible();
    await expect(catalog(page)).toContainText("Изменения сохранены в общем каталоге.");
    const writes = await page.evaluate(() => window.catalogDb.writes);
    assert.equal(writes.length, 1);
    assert.equal(writes[0].path, "basicExerciseOverrides/press");
    assert.equal(writes[0].patch.name, "Жим с гантелями — уточнённая техника");
    assert.deepEqual(writes[0].options, { merge: true });
    assert.equal(await page.evaluate(() => window.catalogScene.baseUnchanged()), true);
  });
});

test("каталог: отказ сохранения оставляет форму и исходную карточку для безопасного повтора", { timeout: 30000 }, async () => {
  await fixture(async page => {
    await ready(page);
    await press(page).getByRole("button", { name: "Редактировать", exact: true }).click();
    await editor(page).getByLabel("Название", { exact: true }).fill("Оставить для повтора");
    await page.evaluate(() => { window.catalogDb.writeMode = "fail"; });
    await editor(page).getByRole("button", { name: "Сохранить", exact: true }).click();
    await expect(editor(page).getByRole("alert")).toContainText("Не удалось сохранить изменения");
    await expect(editor(page).getByLabel("Название", { exact: true })).toHaveValue("Оставить для повтора");
    await expect(editor(page).getByRole("button", { name: "Сохранить", exact: true })).toBeEnabled();
    await editor(page).getByRole("button", { name: "Отмена", exact: true }).click();
    await expect(press(page)).toBeVisible();
    assert.deepEqual(await page.evaluate(() => window.catalogDb.overrides), {});
  });
});

test("каталог: поздний load/ack прежнего входа с тем же UID не обновляет текущий UI", { timeout: 30000 }, async () => {
  await fixture(async page => {
    await page.evaluate(() => { window.catalogDb.overrides.press = { name: "Позднее старое чтение" }; window.catalogScene.relogin(); window.catalogDb.releaseRead(); });
    await expect.poll(() => page.evaluate(() => window.catalogDb.resolvedReads)).toBe(1);
    await settleUi(page);
    await expect(press(page)).toBeVisible();
    await expect(catalog(page).getByRole("heading", { name: "Позднее старое чтение", exact: true })).toHaveCount(0);
    await expect(catalog(page).getByRole("button", { name: "Редактировать", exact: true }).first()).toBeDisabled();
    await page.evaluate(() => window.catalogScene.show({ readMode: "success" }));
    const updated = cards(page).filter({ hasText: "Позднее старое чтение" });
    await expect(updated.getByRole("button", { name: "Редактировать", exact: true })).toBeEnabled();
    await updated.getByRole("button", { name: "Редактировать", exact: true }).click();
    await editor(page).getByLabel("Название", { exact: true }).fill("ACK старой сессии");
    await page.evaluate(() => { window.catalogDb.writeMode = "hold"; });
    await editor(page).getByRole("button", { name: "Сохранить", exact: true }).click();
    await expect.poll(() => page.evaluate(() => window.catalogDb.writes.length)).toBe(1);
    await page.evaluate(() => { window.catalogScene.relogin(); window.catalogDb.releaseWrite(); });
    await settleUi(page);
    await expect(editor(page)).toBeVisible();
    await expect(updated).toBeVisible();
    await expect(catalog(page).getByRole("heading", { name: "ACK старой сессии", exact: true })).toHaveCount(0);
    await expect(catalog(page).getByText("Изменения сохранены в общем каталоге.", { exact: true })).toHaveCount(0);
  });
});

test("каталог: 320/1440 без overflow, редактор доступен на маленьком экране", { timeout: 30000 }, async () => {
  await fixture(async page => {
    await ready(page);
    await mkdir("output/playwright", { recursive: true });
    for (const viewport of [{ width: 320, height: 720 }, { width: 1440, height: 900 }]) {
      await page.setViewportSize(viewport);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await page.screenshot({ path: `output/playwright/admin-catalog-${viewport.width}.png`, fullPage: true });
    }
    await page.setViewportSize({ width: 320, height: 720 });
    await press(page).getByRole("button", { name: "Редактировать", exact: true }).click();
    await expect(editor(page).getByLabel("Название", { exact: true })).toBeVisible();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: "output/playwright/admin-catalog-editor-320.png" });
    await page.keyboard.press("Escape");
    await expect(editor(page)).toHaveCount(0);
    assert.deepEqual(await page.evaluate(() => window.catalogDb.writes), []);
  });
});

test("редактор: загрузка файлов, MIME-ошибка, скрытие и восстановление медиа сохраняют реальные действия", { timeout: 30000 }, async () => {
  await fixture(async page => {
    await ready(page);
    await press(page).getByRole("button", { name: "Редактировать", exact: true }).click();
    const image = media(page, "Изображение"), video = media(page, "Видео");
    await expect(image).not.toHaveAttribute("open");
    await expect(video).not.toHaveAttribute("open");
    await image.locator("summary").click();
    await video.locator("summary").click();
    const imageInput = editor(page).getByLabel("Выбрать изображение упражнения", { exact: true });
    const videoInput = editor(page).getByLabel("Выбрать видео упражнения", { exact: true });
    const imageFile = { name: "preview.png", mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aR1EAAAAASUVORK5CYII=", "base64") };
    const videoFile = { name: "movement.mp4", mimeType: "video/mp4", buffer: Buffer.from("local-video-fixture") };
    await imageInput.setInputFiles(imageFile);
    await expect(image.locator("summary")).toContainText("Новый файл выбран");
    const chosenPreview = await image.getByAltText("Предпросмотр изображения упражнения").getAttribute("src");
    assert.match(chosenPreview, /^blob:/);
    await imageInput.setInputFiles({ name: "invalid.txt", mimeType: "text/plain", buffer: Buffer.from("not an image") });
    await expect(editor(page).getByRole("alert")).toContainText("Для изображения подойдёт JPG, PNG или WebP");
    await expect(image.getByAltText("Предпросмотр изображения упражнения")).toHaveAttribute("src", chosenPreview);
    await image.getByRole("button", { name: "Вернуть исходное", exact: true }).click();
    await expect(image.locator("summary")).toContainText("Исходная иллюстрация");
    await image.getByRole("button", { name: "Убрать", exact: true }).click();
    await expect(image.locator("summary")).toContainText("Скрыто");
    await expect(image.getByAltText("Предпросмотр изображения упражнения")).toHaveCount(0);
    await image.getByRole("button", { name: "Вернуть исходное", exact: true }).click();
    await imageInput.setInputFiles(imageFile);
    await videoInput.setInputFiles(videoFile);
    await expect(video.locator("summary")).toContainText("Новый файл выбран");
    await expect(video.getByTestId("catalog-video-preview")).toHaveAttribute("src", /^blob:/);
    await editor(page).getByRole("button", { name: "Сохранить", exact: true }).click();
    await expect(editor(page)).toHaveCount(0);
    const uploads = await page.evaluate(() => window.catalogUploads);
    assert.deepEqual(uploads.map(item => [item.name, item.type]), [["preview.png", "image/png"], ["movement.mp4", "video/mp4"]]);
    const uploaded = (await page.evaluate(() => window.catalogDb.writes)).at(-1).patch;
    assert.equal(uploaded.imageUrl, `https://fixture.invalid/${uploads[0].path}`);
    assert.equal(uploaded.videoUrl, `https://fixture.invalid/${uploads[1].path}`);
    assert.equal(uploaded.imageDisabled, false);
    assert.equal(uploaded.videoDisabled, false);

    await press(page).getByRole("button", { name: "Редактировать", exact: true }).click();
    await image.locator("summary").click(); await video.locator("summary").click();
    await expect(image.locator("summary")).toContainText("Добавлено администратором");
    await image.getByRole("button", { name: "Вернуть исходное", exact: true }).click();
    await video.getByRole("button", { name: "Вернуть исходное", exact: true }).click();
    await expect(image.locator("summary")).toContainText("Исходная иллюстрация");
    await expect(video.locator("summary")).toContainText("Исходное видео");
    await editor(page).getByRole("button", { name: "Сохранить", exact: true }).click();
    await expect(editor(page)).toHaveCount(0);
    const restored = (await page.evaluate(() => window.catalogDb.writes)).at(-1).patch;
    assert.equal(restored.imageUrl, ""); assert.equal(restored.videoUrl, "");
    assert.equal((await page.evaluate(() => window.catalogUploads)).length, 2);

    await press(page).getByRole("button", { name: "Редактировать", exact: true }).click();
    await image.locator("summary").click(); await video.locator("summary").click();
    await image.getByRole("button", { name: "Убрать", exact: true }).click();
    await video.getByRole("button", { name: "Убрать", exact: true }).click();
    await editor(page).getByRole("button", { name: "Сохранить", exact: true }).click();
    await expect(editor(page)).toHaveCount(0);
    const hidden = (await page.evaluate(() => window.catalogDb.writes)).at(-1).patch;
    assert.equal(hidden.imageDisabled, true); assert.equal(hidden.videoDisabled, true);
    assert.equal(await page.evaluate(() => window.catalogScene.baseUnchanged()), true);
  });
});

test("редактор: шапка и Save/Cancel всегда видны, прокручивается только тело на 320/402/1440 и коротком экране", { timeout: 30000 }, async () => {
  await fixture(async page => {
    await ready(page);
    await press(page).getByRole("button", { name: "Редактировать", exact: true }).click();
    const body = editor(page).getByTestId("admin-exercise-editor-body");
    const header = editor(page).getByTestId("admin-exercise-editor-header");
    const footer = editor(page).getByTestId("admin-exercise-editor-footer");
    const save = editor(page).getByRole("button", { name: "Сохранить", exact: true });
    const cancel = editor(page).getByRole("button", { name: "Отмена", exact: true });
    await media(page, "Изображение").locator("summary").click();
    await media(page, "Видео").locator("summary").click();
    for (const viewport of [{ width: 320, height: 720 }, { width: 402, height: 874 }, { width: 1440, height: 900 }, { width: 320, height: 600 }, { width: 402, height: 600 }, { width: 844, height: 390 }]) {
      await page.setViewportSize(viewport);
      await body.evaluate(element => { element.scrollTop = 0; });
      const before = { header: await header.boundingBox(), footer: await footer.boundingBox() };
      for (const control of [header.getByRole("button", { name: "Закрыть", exact: true }), save, cancel]) {
        await expect(control).toBeInViewport({ ratio: 1 });
        const size = await control.boundingBox();
        assert.ok(size.width >= 44 && size.height >= 44);
      }
      await body.evaluate(element => { element.scrollTop = element.scrollHeight; });
      assert.equal(await editor(page).evaluate(element => element.scrollTop), 0);
      assert.ok(await body.evaluate(element => element.scrollHeight <= element.clientHeight || element.scrollTop > 0));
      for (const control of [save, cancel]) await expect(control).toBeInViewport({ ratio: 1 });
      assert.ok(Math.abs((await header.boundingBox()).y - before.header.y) < 1);
      assert.ok(Math.abs((await footer.boundingBox()).y - before.footer.y) < 1);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      assert.match(await save.evaluate(element => getComputedStyle(element).backgroundImage), /linear-gradient/);
      if (viewport.height === 600 || viewport.width === 1440) {
        await mkdir("output/playwright", { recursive: true });
        await page.screenshot({ path: `output/playwright/admin-catalog-editor-fixed-${viewport.width}x${viewport.height}.png` });
      }
    }
    await page.setViewportSize({ width: 320, height: 600 });
    await media(page, "Видео").getByRole("button", { name: "Убрать", exact: true }).focus();
    await expect(media(page, "Видео").getByRole("button", { name: "Убрать", exact: true })).toBeInViewport({ ratio: 1 });
    const focusBox = await media(page, "Видео").getByRole("button", { name: "Убрать", exact: true }).boundingBox();
    const bodyBox = await body.boundingBox();
    assert.ok(focusBox.y >= bodyBox.y && focusBox.y + focusBox.height <= bodyBox.y + bodyBox.height + 1);
    await editor(page).getByLabel("Выбрать изображение упражнения", { exact: true }).setInputFiles({ name: "invalid.txt", mimeType: "text/plain", buffer: Buffer.from("invalid") });
    await expect(editor(page).getByRole("alert")).toBeVisible();
    for (const control of [save, cancel]) await expect(control).toBeInViewport({ ratio: 1 });
    await cancel.click();
    await expect(editor(page)).toHaveCount(0);
    assert.deepEqual(await page.evaluate(() => window.catalogDb.writes), []);
  });
});
