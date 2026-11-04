import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { resolve } from "node:path";
import { rolldown } from "rolldown";
import { chromium, expect } from "@playwright/test";

const component = JSON.stringify(resolve("src/features/client/workouts/WorkoutListDialogs.jsx").replaceAll("\\", "/"));
const bundle = await rolldown({ input: "workout-history-scene", platform: "browser", transform: { jsx: { runtime: "automatic" } }, plugins: [{
  name: "workout-history-synthetic-io",
  resolveId: id => id === "workout-history-scene" ? id : null,
  load(id) {
    if (id.endsWith(".css")) return { code: "export default {};", moduleType: "js" };
    if (id !== "workout-history-scene") return null;
    return { moduleType: "jsx", code: `
      import React,{useState}from'react';import{createRoot}from'react-dom/client';import{flushSync}from'react-dom';
      import{IndividualWorkoutHistoryDialog as History,WorkoutProgramDialog as Program}from ${component};
      let setOpen,setOwner,setSupplied,setTick,setProgram,currentOwner='client-a';
      const fallback=[{id:'current-1',workout:'Текущая 1',date:'2026-10-29'},{id:'current-2',workout:'Текущая 2',date:'2026-10-28'}];
      window.scene={requests:[],valid:true,
        read(owner,tick){return new Promise((resolve,reject)=>this.requests.push({owner,tick,resolve,reject}));},
        open(){flushSync(()=>setOpen(true));},close(){flushSync(()=>setOpen(false));},
        changeOwner(owner){currentOwner=owner;flushSync(()=>setOwner(owner));},
        rerender(){flushSync(()=>setTick(value=>value+1));},
        noLoader(){flushSync(()=>setSupplied(false));},
        resolve(index,items,guardKind='function'){const request=this.requests[index];request.resolve({items,
          isCurrent:guardKind==='function'?()=>this.valid&&currentOwner===request.owner:true});},
        reject(index){this.requests[index].reject(new Error('synthetic network failure'));},
        program(){flushSync(()=>{setOpen(false);setProgram(true);});}
      };
      function App(){const[open,updateOpen]=useState(false),[owner,updateOwner]=useState('client-a'),[supplied,updateSupplied]=useState(true),[tick,updateTick]=useState(0),[program,updateProgram]=useState(false);
        setOpen=updateOpen;setOwner=updateOwner;setSupplied=updateSupplied;setTick=updateTick;setProgram=updateProgram;
        const historyLoader=supplied?()=>window.scene.read(owner,tick):undefined;
        return <><History open={open} historyOwnerKey={owner} historyLoader={historyLoader} historyItems={fallback} onClose={()=>updateOpen(false)}/>
          <Program open={program} programName='Тестовая программа' completedCount={0} onClose={()=>updateProgram(false)} workouts={[
            {id:'day-5',index:5,programOrder:1,name:'Занятие А',exerciseCount:0,exercises:[]},
            {id:'day-8',index:8,programOrder:2,name:'Занятие Б',exerciseCount:0,exercises:[]}]}/></>;}
      flushSync(()=>createRoot(document.getElementById('root')).render(<App/>));
    ` };
  }
}] });
const generated = await bundle.generate({ format: "iife", codeSplitting: false });
await bundle.close();
const code = generated.output.find(item => item.type === "chunk").code;
let browser;
before(async () => { browser = await chromium.launch(); });
after(async () => { await browser?.close(); });

async function fixture(run) {
  const context = await browser.newContext({ viewport: { width: 402, height: 874 } });
  try {
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.route("**/*", route => route.request().url() === "https://workout-history.test/"
      ? route.fulfill({ contentType: "text/html", body: '<meta name="viewport" content="width=device-width,initial-scale=1"><main id="root"></main>' })
      : route.abort());
    await page.goto("https://workout-history.test/");
    await page.clock.install({ time: new Date("2026-10-30T12:00:00Z") });
    await page.addScriptTag({ content: code });
    await run(page);
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
}

const records = Array.from({ length: 16 }, (_, index) => ({
  id: `all-${index}`, workout: `Архивная тренировка ${index + 1}`, date: `2026-10-${String(index + 1).padStart(2, "0")}`,
  ...(index === 15 ? {} : { durationSeconds: 60 }), exercises: [{ sets: [{ weight: 1000 }] }]
}));

test("история: полная загрузка только при открытии, реальные общие итоги и список по 12", { timeout: 30000 }, async () => fixture(async page => {
  assert.equal(await page.evaluate(() => window.scene.requests.length), 0);
  await page.evaluate(() => window.scene.open());
  await expect(page.getByRole("status")).toContainText("Загружаем историю за всё время");
  await expect(page.getByTestId("workout-history-all-time")).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => window.scene.requests.length)).toBe(1);
  await page.evaluate(() => window.scene.rerender());
  assert.equal(await page.evaluate(() => window.scene.requests.length), 1);
  await page.evaluate(items => window.scene.resolve(0, [...items, { id: "pending", workout: "Не синхронизирована", pendingSync: true }]), records);
  await expect(page.getByTestId("workout-history-all-time")).toContainText("Всего 16 тренировок");
  await expect(page.getByTestId("workout-history-program-count")).toHaveText("В текущей программе: 2 тренировки.");
  await expect(page.getByText("Время указано у 15 из 16 тренировок — итог неполный.", { exact: true })).toBeVisible();
  await expect(page.getByText("макс. вес", { exact: true })).toHaveCount(0);
  await expect(page.getByText("1000 кг", { exact: true })).toHaveCount(0);
  await expect(page.getByTestId("workout-history-dialog-item")).toHaveCount(12);
  await page.getByRole("button", { name: "Показать ещё · осталось 4", exact: true }).click();
  await expect(page.getByTestId("workout-history-dialog-item")).toHaveCount(16);
  await expect(page.getByText("Архивная тренировка 16", { exact: true })).toBeVisible();
  await expect(page.getByText("Не синхронизирована", { exact: true })).toHaveCount(0);
}));

test("история: ошибка, повтор с последним loader и честный fallback текущей программы", { timeout: 30000 }, async () => fixture(async page => {
  await page.evaluate(() => window.scene.open());
  await expect.poll(() => page.evaluate(() => window.scene.requests.length)).toBe(1);
  await page.evaluate(() => window.scene.reject(0));
  await expect(page.getByRole("alert")).toContainText("Не удалось загрузить полную историю");
  await expect(page.getByTestId("workout-history-all-time")).toHaveCount(0);
  await expect(page.getByTestId("workout-history-dialog-item")).toHaveCount(2);
  await page.evaluate(() => window.scene.rerender());
  await page.getByRole("button", { name: "Повторить загрузку", exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.scene.requests.length)).toBe(2);
  assert.equal(await page.evaluate(() => window.scene.requests[1].tick), 1);
  await page.evaluate(() => window.scene.resolve(1, []));
  await expect(page.getByTestId("workout-history-all-time")).toContainText("Всего 0 тренировок");
  await expect(page.getByText("Здесь появятся ваши завершённые тренировки.", { exact: false })).toBeVisible();
}));

test("история: stale guard и смена owner скрывают старые значения до нового чтения", { timeout: 30000 }, async () => fixture(async page => {
  await page.evaluate(() => window.scene.open());
  await expect.poll(() => page.evaluate(() => window.scene.requests.length)).toBe(1);
  await page.evaluate(items => window.scene.resolve(0, items), records);
  await expect(page.getByTestId("workout-history-all-time")).toBeVisible();
  assert.equal(await page.evaluate(() => { window.scene.changeOwner("client-b"); return document.querySelector('[data-testid="workout-history-all-time"]') === null; }), true);
  await expect.poll(() => page.evaluate(() => window.scene.requests.length)).toBe(2);
  await page.evaluate(() => window.scene.resolve(1, [{ id: "new-owner", workout: "Новое занятие", date: "2026-10-30" }]));
  await expect(page.getByTestId("workout-history-all-time")).toContainText("Всего 1 тренировка");
  await expect(page.getByText("Архивная тренировка 16", { exact: true })).toHaveCount(0);
  await page.evaluate(() => { window.scene.valid = false; window.scene.rerender(); });
  await expect(page.getByTestId("workout-history-all-time")).toHaveCount(0);
  await expect(page.getByRole("alert")).toContainText("История недоступна для текущей сессии");
  await expect(page.getByTestId("workout-history-dialog-item")).toHaveCount(0);
  await page.getByRole("button", { name: "Закрыть историю тренировок", exact: true }).click();
  await expect(page.getByTestId("workout-history-dialog")).toHaveCount(0);
}));

test("история: закрытое окно не принимает поздний ответ, boolean guard не считается подтверждением", { timeout: 30000 }, async () => fixture(async page => {
  await page.evaluate(() => { window.scene.open(); window.scene.close(); });
  assert.equal(await page.evaluate(() => window.scene.requests.length), 0);
  await page.evaluate(() => window.scene.open());
  await expect.poll(() => page.evaluate(() => window.scene.requests.length)).toBe(1);
  await page.getByRole("button", { name: "Закрыть историю тренировок", exact: true }).click();
  await page.evaluate(items => window.scene.resolve(0, items), records);
  await expect(page.getByTestId("workout-history-dialog")).toHaveCount(0);
  await page.evaluate(() => window.scene.open());
  await expect.poll(() => page.evaluate(() => window.scene.requests.length)).toBe(2);
  await expect(page.getByTestId("workout-history-all-time")).toHaveCount(0);
  await page.evaluate(items => window.scene.resolve(1, items, "boolean"), records);
  await expect(page.getByRole("alert")).toContainText("История недоступна для текущей сессии");
  await expect(page.getByTestId("workout-history-all-time")).toHaveCount(0);
}));

test("история: без полного loader нет общего итога; ordinal программы берётся из programOrder", { timeout: 30000 }, async () => fixture(async page => {
  await page.evaluate(() => { window.scene.noLoader(); window.scene.open(); });
  await expect(page.getByRole("status")).toContainText("Полная история пока недоступна");
  await expect(page.getByTestId("workout-history-all-time")).toHaveCount(0);
  await expect(page.getByTestId("workout-history-dialog-item")).toHaveCount(2);
  assert.equal(await page.evaluate(() => window.scene.requests.length), 0);
  await page.evaluate(() => window.scene.program());
  await expect(page.getByTestId("workout-program-dialog-item").first().locator("span").first()).toHaveText("01");
  await expect(page.getByTestId("workout-program-dialog-item").nth(1).locator("span").first()).toHaveText("02");
}));
