import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { rolldown } from "rolldown";
import { chromium } from "playwright";

const componentPath = fileURLToPath(new URL("../src/features/client/workouts/WorkoutRestTimer.jsx", import.meta.url)).replaceAll("\\", "/");
const css = await readFile(new URL("../src/features/client/workouts/WorkoutRestTimer.module.css", import.meta.url), "utf8");
const cssNames = Object.fromEntries([...css.matchAll(/\.([a-zA-Z][\w-]*)/g)].map((match) => [match[1], match[1]]));
const bundle = await rolldown({
  input: "workout-rest-component", platform: "browser", transform: { jsx: { runtime: "automatic" } },
  plugins: [{
    name: "workout-rest-component-test",
    resolveId(id) { return id === "workout-rest-component" ? id : null; },
    load(id) {
      if (id.endsWith(".css")) return { moduleType: "js", code: `const sheet=document.createElement('style');sheet.textContent=${JSON.stringify(css)};document.head.appendChild(sheet);export default ${JSON.stringify(cssNames)};` };
      if (id !== "workout-rest-component") return null;
      return { moduleType: "jsx", code: `
        import React from 'react';
        import {createRoot} from 'react-dom/client';
        import Timer from ${JSON.stringify(componentPath)};
        window.timerCalls={start:[],seconds:[],running:[],completion:0,minimize:0};
        window.timerExpandCalls=0;
        let options={expanded:true,duration:90,seconds:30,running:true,showCompletionAction:true,completionActionLabel:'Перейти к подходу 2 из 3',completionActionHint:'Пропустить остаток отдыха'};
        const root=createRoot(document.getElementById('root'));
        window.renderTimer=patch=>{
          options={...options,...patch};
          root.render(<Timer {...options}
            onStart={value=>window.timerCalls.start.push(value)}
            onSecondsChange={value=>window.timerCalls.seconds.push(value)}
            onRunningChange={value=>window.timerCalls.running.push(value)}
            onCompletionAction={()=>window.timerCalls.completion++}
            onExpand={()=>window.timerExpandCalls++}
            onMinimize={()=>window.timerCalls.minimize++}/>);
        };
        window.renderTimer({});
      ` };
    }
  }]
});
const generated = await bundle.generate({ format: "iife", codeSplitting: false });
await bundle.close();

async function openTimer(browser, viewport = { width: 375, height: 740 }) {
  const page = await browser.newPage({ viewport });
  await page.setContent('<style>html{font-family:system-ui}*{box-sizing:border-box}:root{--ownset-action-gradient:linear-gradient(110deg,#487e75,#3569a4)}</style><main id="root"></main>');
  await page.addScriptTag({ content: generated.output[0].code });
  await page.getByRole("dialog", { name: "Таймер отдыха", exact: true }).waitFor();
  return page;
}

test("открытый таймер сохраняет running/paused и завершённое состояние не выводится из обычного нуля", { timeout: 30000 }, async () => {
  const browser = await chromium.launch();
  try {
    const page = await openTimer(browser);
    const dialog = page.getByRole("dialog", { name: "Таймер отдыха", exact: true });
    assert.equal(await dialog.getAttribute("data-rest-completed"), "false");
    assert.equal(await dialog.locator(".expandedCountdown").textContent(), "0:30");
    assert.equal(await dialog.locator(".timerRing").count(), 1);
    await dialog.getByRole("button", { name: "Остановить таймер отдыха", exact: true }).click();
    assert.deepEqual(await page.evaluate(() => window.timerCalls.running), [false]);
    await page.evaluate(() => window.renderTimer({ running: false, seconds: 12 }));
    await dialog.getByRole("button", { name: "Продолжить таймер отдыха", exact: true }).waitFor();
    assert.equal(await dialog.locator(".expandedCountdown").textContent(), "0:12");
    await dialog.getByRole("button", { name: "Продолжить таймер отдыха", exact: true }).click();
    assert.deepEqual(await page.evaluate(() => window.timerCalls.running), [false, true]);
    await page.evaluate(() => window.renderTimer({ running: false, seconds: 0 }));
    await dialog.getByRole("button", { name: "Запустить таймер отдыха", exact: true }).waitFor();
    assert.equal(await dialog.locator(".expandedCountdown").textContent(), "1:30");
    assert.equal(await dialog.getByRole("status").count(), 0);
    assert.equal(await page.evaluate(() => window.timerCalls.completion), 0);
  } finally { await browser.close(); }
});

test("после отдыха то же окно заменяет круг одним доступным переходом и само ничего не выполняет", { timeout: 30000 }, async () => {
  const browser = await chromium.launch();
  try {
    const page = await openTimer(browser);
    const dialog = page.getByRole("dialog", { name: "Таймер отдыха", exact: true });
    const original = await dialog.elementHandle();
    await page.evaluate(() => window.renderTimer({ restCompleted: true, running: false, seconds: 0 }));
    await dialog.getByRole("status").waitFor();
    assert.equal(await dialog.getAttribute("data-rest-completed"), "true");
    assert.equal(await original.evaluate(element => element === document.querySelector('[data-testid="workout-rest-timer-expanded"]')), true);
    assert.equal(await dialog.getByRole("status").textContent(), "Отдых завершён");
    assert.equal(await dialog.locator(".timerRing, .expandedCountdown, .expandedControls").count(), 0);
    const action = dialog.getByRole("button", { name: "Перейти к подходу 2 из 3", exact: true });
    assert.equal(await action.getAttribute("aria-description"), null);
    assert.equal(await dialog.getByText("Пропустить остаток отдыха", { exact: true }).count(), 0);
    assert.deepEqual(await page.evaluate(() => window.timerCalls), { start: [], seconds: [], running: [], completion: 0, minimize: 0 });
    for (const viewport of [{ width: 375, height: 740 }, { width: 320, height: 568 }, { width: 740, height: 375 }]) {
      await page.setViewportSize(viewport);
      const bounds = await action.boundingBox();
      assert.ok(bounds.width >= 44 && bounds.height >= 44);
      assert.ok(bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= viewport.width && bounds.y + bounds.height <= viewport.height);
    }
    await page.emulateMedia({ reducedMotion: "reduce" });
    await action.focus();
    await page.keyboard.press("Enter");
    assert.deepEqual(await page.evaluate(() => window.timerCalls), { start: [], seconds: [], running: [], completion: 1, minimize: 0 });
    await page.evaluate(() => window.renderTimer({ completionActionDisabled: true, completionActionLabel: 'Завершить тренировку' }));
    const finish = dialog.getByRole("button", { name: "Завершить тренировку", exact: true });
    await finish.waitFor();
    assert.equal(await finish.isDisabled(), true);
  } finally { await browser.close(); }
});

test("завершённый ручной отдых без перехода только возвращает к подходу", { timeout: 30000 }, async () => {
  const browser = await chromium.launch();
  try {
    const page = await openTimer(browser);
    await page.evaluate(() => window.renderTimer({ restCompleted: true, running: false, seconds: 0, showCompletionAction: false }));
    const dialog = page.getByRole("dialog", { name: "Таймер отдыха", exact: true });
    await dialog.getByRole("button", { name: "Вернуться к подходу", exact: true }).click();
    assert.deepEqual(await page.evaluate(() => window.timerCalls), { start: [], seconds: [], running: [], completion: 0, minimize: 1 });
    assert.equal(await dialog.getByTestId("workout-rest-timer-completion-action").count(), 0);
    assert.equal(await dialog.getByRole("button", { name: "Запустить таймер отдыха", exact: true }).count(), 0);
  } finally { await browser.close(); }
});

test("строка отдыха имеет одно понятное действие и открывает таймер без самостоятельного старта или паузы", { timeout: 30000 }, async () => {
  const browser = await chromium.launch();
  try {
    const page = await openTimer(browser);
    const states = [
      { running: false, seconds: 0, restCompleted: false, time: "1:30", action: "Запустить", aria: "Запустить таймер отдыха", idle: true },
      { running: true, seconds: 30, restCompleted: false, time: "0:30", action: "Открыть", aria: "Открыть таймер отдыха" },
      { running: false, seconds: 12, restCompleted: false, time: "0:12", action: "Открыть", aria: "Открыть таймер отдыха" },
      { running: false, seconds: 0, restCompleted: true, time: "0:00", action: "Открыть", aria: "Открыть таймер отдыха" }
    ];
    for (const [index, state] of states.entries()) {
      await page.evaluate(({ running, seconds, restCompleted }) => window.renderTimer({ expanded: false, docked: true, running, seconds, restCompleted }), state);
      const timer = page.getByTestId("workout-rest-timer");
      await timer.getByText(state.time, { exact: true }).waitFor();
      assert.equal(await timer.getByRole("button").count(), 1);
      const action = timer.getByRole("button", { name: state.aria, exact: true });
      assert.equal(await action.locator(".dockedAction").textContent(), state.action);
      assert.equal(await timer.getAttribute("data-rest-completed"), String(state.restCompleted));
      assert.equal(await timer.getByTestId("workout-rest-timer-start").count(), state.idle ? 1 : 0);
      assert.equal(await timer.getByText("Отдых завершён", { exact: true }).count(), state.restCompleted ? 1 : 0);
      if (!state.running && state.seconds > 0) {
        assert.equal(await timer.getByText("Отдых на паузе", { exact: true }).count(), 1);
        assert.match(await action.getAttribute("aria-description"), /На паузе/);
      }
      const bounds = await action.boundingBox();
      assert.ok(bounds.width >= 44 && bounds.height >= 44);
      assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= 375);
      if (index === 2) {
        await action.focus();
        await page.keyboard.press("Enter");
      } else await action.click();
      assert.equal(await page.evaluate(() => window.timerExpandCalls), index + 1);
      assert.deepEqual(await page.evaluate(() => window.timerCalls), { start: [], seconds: [], running: [], completion: 0, minimize: 0 });
    }
    await page.setViewportSize({ width: 320, height: 568 });
    await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
    const action = page.getByRole("button", { name: "Открыть таймер отдыха", exact: true });
    const bounds = await action.boundingBox();
    assert.ok(bounds.height >= 44 && bounds.x >= 0 && bounds.x + bounds.width <= 320);
    assert.equal(await page.getByTestId("workout-rest-timer").evaluate(el => el.scrollWidth > el.clientWidth), false);
  } finally { await browser.close(); }
});
