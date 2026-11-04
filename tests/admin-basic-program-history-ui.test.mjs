import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { rolldown } from "rolldown";
import { transform } from "lightningcss";
import { chromium, expect } from "@playwright/test";

const source = path => fileURLToPath(new URL(`../src/${path}`, import.meta.url)).replaceAll("\\", "/");
const css = [];
const bundle = await rolldown({ input: "admin-history-fixture", platform: "browser", transform: { jsx: { runtime: "automatic" } }, plugins: [{
  name: "admin-history-local-react",
  resolveId(id) {
    if (id === "admin-history-fixture") return id;
    if (id === "firebase/firestore") return "admin-history-firestore";
    if (id.endsWith("/firebase")) return "admin-history-auth";
    return null;
  },
  async load(id) {
    if (id.endsWith(".css")) {
      const sheet = transform({ filename: id, code: await readFile(id), cssModules: true, errorRecovery: false });
      css.push(sheet.code.toString());
      return { moduleType: "js", code: `export default ${JSON.stringify(Object.fromEntries(Object.entries(sheet.exports).map(([key, value]) => [key, value.name])))};` };
    }
    if (id === "admin-history-auth") return { moduleType: "js", code: "export const auth={currentUser:{uid:'admin-history-audit'}};export const db={};" };
    if (id === "admin-history-firestore") return { moduleType: "js", code: `
      const pathOf=args=>args.map(item=>typeof item==='string'?item:item?.path||'').filter(Boolean).join('/');
      export const collection=(...args)=>({path:pathOf(args)}),doc=(...args)=>({path:pathOf(args)});
      export const getDocs=ref=>window.auditHistoryRead(ref.path);
      export const serverTimestamp=()=>null;
      export const writeBatch=()=>({set(){window.auditWrites++;},commit(){throw new Error('Unexpected mutation in read-only fixture');}});
    ` };
    if (id !== "admin-history-fixture") return null;
    return { moduleType: "jsx", code: `
      import React,{useState}from'react';import{createRoot}from'react-dom/client';
      import Lifecycle from ${JSON.stringify(source("components/admin/AdminBasicProgramLifecycle.jsx"))};
      import{auth}from'./firebase';import{advanceAuthSession}from ${JSON.stringify(source("utils/authSession.js"))};
      const snapshot=items=>({docs:items.map(item=>({id:item.id,data:()=>item}))});
      const programs=[{id:'program-a',title:'Программа А',managedBy:'admin-basic-catalog',status:'published',version:3,workouts:[]},
        {id:'program-b',title:'Программа Б',managedBy:'admin-basic-catalog',status:'draft',version:2,workouts:[]}];
      window.auditWrites=0;window.auditHistoryRequests=[];
      window.auditHistoryRead=path=>path.endsWith('/versions')?new Promise((resolve,reject)=>window.auditHistoryRequests.push({path,resolve:items=>resolve(snapshot(items)),reject})):Promise.resolve(snapshot(programs));
      window.historyFixture={resolve:(index,items)=>window.auditHistoryRequests[index].resolve(items),reject:index=>window.auditHistoryRequests[index].reject(new Error('synthetic unavailable')),
        relogin:()=>advanceAuthSession(auth,auth.currentUser)};
      function Scene(){const[visible,setVisible]=useState(true);window.historyFixture.mount=setVisible;return visible?<Lifecycle/>:null;}
      createRoot(document.getElementById('root')).render(<Scene/>);
    ` };
  }
}] });
const generated = await bundle.generate({ format: "iife", codeSplitting: false });
await bundle.close();
const code = generated.output.find(item => item.type === "chunk").code;
const lifecycle = page => page.getByTestId("admin-basic-program-lifecycle");
const sheet = (page, name) => page.getByRole("dialog", { name, exact: true });
async function openHistory(page, title) {
  const card = lifecycle(page).getByRole("article").filter({ has: page.getByRole("heading", { name: title, exact: true }) });
  await card.getByRole("button", { name: "Открыть историю", exact: true }).click();
  await expect(sheet(page, title)).toBeVisible();
}
async function fixture(run) {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 402, height: 874 } });
    page.setDefaultTimeout(4000);
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.route("**/*", route => route.abort());
    await page.setContent('<meta name="viewport" content="width=device-width,initial-scale=1"><main id="root"></main>');
    await page.addStyleTag({ content: `body{margin:0;padding:16px;background:#f2f2f7;font-family:Arial,sans-serif}${css.join("\n")}` });
    await page.addScriptTag({ content: code });
    await expect(lifecycle(page).getByRole("article")).toHaveCount(2);
    await run(page);
    assert.deepEqual(errors, []);
    assert.equal(await page.evaluate(() => window.auditWrites), 0);
  } finally { await browser.close(); }
}

test("история базовых программ: failed read — ошибка и повтор, а не ложное отсутствие версий", { timeout: 30000 }, async () => {
  await fixture(async page => {
    const card = lifecycle(page).getByRole("article").filter({ has: page.getByRole("heading", { name: "Программа А", exact: true }) });
    await card.getByRole("button", { name: "Открыть историю", exact: true }).evaluate(button => { button.click(); button.click(); });
    const dialog = sheet(page, "Программа А");
    await expect(dialog.getByRole("status")).toContainText("Загружаем историю");
    assert.equal(await page.evaluate(() => window.auditHistoryRequests.length), 1);
    await page.evaluate(() => window.historyFixture.reject(0));
    await expect(dialog.getByRole("alert")).toContainText("Не удалось загрузить историю версий");
    await expect(dialog.getByText(/Версий пока нет/)).toHaveCount(0);
    await dialog.getByRole("button", { name: "Повторить загрузку", exact: true }).click();
    await expect(dialog.getByRole("status")).toContainText("Загружаем историю");
    await expect(dialog.getByText(/Версий пока нет/)).toHaveCount(0);
    assert.equal(await page.evaluate(() => window.auditHistoryRequests.length), 2);
    await page.evaluate(() => window.historyFixture.resolve(1, [{ id: "v1", version: 1, reason: "Первая версия" }, { id: "v3", version: 3, reason: "Проверенная версия" }]));
    await expect(dialog.getByRole("alert")).toHaveCount(0);
    await expect(dialog.getByRole("listitem")).toHaveCount(2);
    await expect(dialog.getByRole("listitem").first()).toContainText("Проверенная версия");
    await expect(dialog.getByText(/Версий пока нет/)).toHaveCount(0);
  });
});

test("история базовых программ: только успешное пустое чтение показывает отсутствие версий", { timeout: 30000 }, async () => {
  await fixture(async page => {
    await openHistory(page, "Программа А");
    await page.evaluate(() => window.historyFixture.resolve(0, []));
    await expect(sheet(page, "Программа А").getByText(/Версий пока нет/)).toBeVisible();
    await expect(sheet(page, "Программа А").getByRole("alert")).toHaveCount(0);
  });
});

test("история базовых программ: закрытие, same-UID relogin и unmount изолируют старые ответы от новой выбранной истории", { timeout: 30000 }, async () => {
  await fixture(async page => {
    for (const change of ["close", "relogin", "unmount"]) {
      const oldIndex = await page.evaluate(() => window.auditHistoryRequests.length);
      await openHistory(page, "Программа А");
      if (change === "relogin") {
        await page.evaluate(async index => {
          window.historyFixture.relogin();
          window.historyFixture.resolve(index, [{ id: "old-session-a", version: 99, reason: "История прежней сессии" }]);
          await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        }, oldIndex);
        await expect(sheet(page, "Программа А").getByText("История прежней сессии", { exact: true })).toHaveCount(0);
        await expect(sheet(page, "Программа А").getByText(/Версий пока нет/)).toHaveCount(0);
      }
      if (change === "unmount") {
        await page.evaluate(() => window.historyFixture.mount(false));
        await expect(lifecycle(page)).toHaveCount(0);
        await page.evaluate(() => window.historyFixture.mount(true));
        await expect(lifecycle(page).getByRole("article")).toHaveCount(2);
      } else await sheet(page, "Программа А").getByRole("button", { name: "Закрыть", exact: true }).click();
      await openHistory(page, "Программа Б");
      await page.evaluate(index => window.historyFixture.resolve(index, [{ id: "current-b", version: 2, reason: "Текущая история Б" }]), oldIndex + 1);
      await expect(sheet(page, "Программа Б").getByText("Текущая история Б", { exact: true })).toBeVisible();
      await page.evaluate(async index => { window.historyFixture.resolve(index, [{ id: "stale-a", version: 99, reason: "Устаревшая история А" }]); await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))); }, oldIndex);
      await expect(sheet(page, "Программа Б").getByText("Текущая история Б", { exact: true })).toBeVisible();
      await expect(page.getByText("Устаревшая история А", { exact: true })).toHaveCount(0);
      await sheet(page, "Программа Б").getByRole("button", { name: "Закрыть", exact: true }).click();
    }
  });
});
