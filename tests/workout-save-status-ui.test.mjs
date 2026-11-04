import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { rolldown } from "rolldown";
import { chromium } from "playwright";

const source = file => fileURLToPath(new URL(`../src/${file}`, import.meta.url)).replaceAll("\\", "/");
const bundle = await rolldown({
  input: "workout-save-status-ui",
  platform: "browser",
  transform: { jsx: { runtime: "automatic" } },
  plugins: [{
    name: "workout-save-status-ui",
    resolveId: id => id === "workout-save-status-ui" ? id : null,
    load(id) {
      if (id.endsWith(".css")) return { moduleType: "js", code: "export default {};" };
      if (id !== "workout-save-status-ui") return null;
      return { moduleType: "jsx", code: `
        import React from 'react';
        import {createRoot} from 'react-dom/client';
        import {flushSync} from 'react-dom';
        import Finish from ${JSON.stringify(source("features/client/workouts/WorkoutFinishStage.jsx"))};
        import Overview from ${JSON.stringify(source("features/client/workouts/WorkoutRenderOverview.jsx"))};
        import {buildWorkoutFinishSummary} from ${JSON.stringify(source("domain/workoutPresentation.js"))};
        const root=createRoot(document.getElementById('root'));
        let finish={completedExercisesCount:1,exerciseCount:1,finishPresentation:{day:'День 1'},
          finishStats:[],incompleteExerciseNames:[],workoutClientComment:'',isSaving:false,isWorkoutSaved:false};
        let overview={workout:{name:'День 1',exercises:[]},renderBottomBar:()=>null,pendingSyncCount:2,localOnlyPlan:true};
        window.workoutUi={saveCalls:0,retryCalls:0,retries:[],rescheduleCalls:[],reschedules:[],unhandled:[]};
        window.addEventListener('unhandledrejection',event=>{
          window.workoutUi.unhandled.push(String(event.reason));event.preventDefault();
        });
        window.workoutUi.finish=patch=>{
          finish={...finish,...patch};
          const summary=buildWorkoutFinishSummary(finish);
          flushSync(()=>root.render(<Finish {...finish} finishSyncText={summary.syncText}
            onFinishWorkout={()=>window.workoutUi.saveCalls++}/>));
        };
        window.workoutUi.overview=patch=>{
          overview={...overview,...patch};
          flushSync(()=>root.render(<Overview {...overview} onRetrySync={()=>{
            window.workoutUi.retryCalls++;
            return new Promise((resolve,reject)=>window.workoutUi.retries.push({resolve,reject}));
          }} onReschedule={date=>{
            window.workoutUi.rescheduleCalls.push(date);
            return new Promise((resolve,reject)=>window.workoutUi.reschedules.push({resolve,reject}));
          }}/>));
        };
        window.workoutUi.resolveRetry=()=>window.workoutUi.retries.shift().resolve();
        window.workoutUi.rejectRetry=()=>window.workoutUi.retries.shift().reject(new Error('synthetic offline'));
        window.workoutUi.resolveReschedule=value=>window.workoutUi.reschedules.shift().resolve(value);
        window.workoutUi.rejectReschedule=()=>window.workoutUi.reschedules.shift().reject(new Error('synthetic reschedule failure'));
      ` };
    }
  }]
});
const generated = await bundle.generate({ format: "iife", codeSplitting: false });
await bundle.close();

async function openProbe(browser) {
  const page = await browser.newPage();
  await page.setContent('<main id="root"></main>');
  await page.addScriptTag({ content: generated.output[0].code });
  return page;
}

test("экран завершения различает ожидание, локальное сохранение, подтверждённое облако и отказ", { timeout: 30000 }, async () => {
  const browser = await chromium.launch();
  try {
    const page = await openProbe(browser);
    const status = page.getByTestId("workout-finish-save-status");
    await page.evaluate(() => window.workoutUi.finish({ workoutHistorySyncState: "saving", isSaving: true }));
    assert.match(await status.textContent(), /Дождитесь подтверждения/);
    assert.equal(await status.evaluate(node => node.parentElement.children[1] === node), true, "ожидание сохранения сразу после строки дня");
    assert.equal(await status.count(), 1);
    assert.equal(await page.getByRole("button", { name: "Сохраняем…", exact: true }).isDisabled(), true);
    assert.doesNotMatch(await page.locator("body").textContent(), /Сохранено в облаке/);

    await page.evaluate(() => window.workoutUi.finish({ workoutHistorySyncState: "local", isSaving: false, isWorkoutSaved: true, showWorkoutSavedCard: true }));
    assert.match(await status.textContent(), /Сохранено на устройстве/);
    assert.match(await status.textContent(), /ещё не подтверждена/);
    assert.match(await status.textContent(), /Не очищайте данные/);
    assert.equal(await status.evaluate(node => node.parentElement.lastElementChild === node), true, "локальный статус остаётся внизу итогов");
    assert.doesNotMatch(await page.locator("body").textContent(), /Сохранено в облаке/);
    assert.equal(await page.getByRole("button", { name: "Вернуться в меню", exact: true }).count(), 1);

    // A replay of an older queued workout must not confirm the unsaved run.
    await page.evaluate(() => window.workoutUi.finish({ workoutHistorySyncState: "synced", isWorkoutSaved: false }));
    assert.equal(await status.count(), 0);
    assert.doesNotMatch(await page.locator("body").textContent(), /Сохранено в облаке/);

    await page.evaluate(() => window.workoutUi.finish({ workoutHistorySyncState: "synced", isWorkoutSaved: true, showWorkoutSavedCard: false }));
    assert.match(await status.textContent(), /Сохранено в облаке/);
    assert.equal(await status.getAttribute("role"), "status");

    await page.evaluate(() => window.workoutUi.finish({ workoutHistorySyncState: "error", isWorkoutSaved: false }));
    assert.equal(await status.getAttribute("role"), "alert");
    assert.match(await status.textContent(), /Не удалось сохранить результат/);
    assert.equal(await status.evaluate(node => node.parentElement.children[1] === node), true, "ошибка до показателей и комментария");
    assert.equal(await page.getByRole("alert").count(), 1, "ошибка не дублируется для screen reader");
    assert.doesNotMatch(await page.locator("body").textContent(), /Сохранено в облаке|Сохранено на устройстве/);
    await page.getByRole("button", { name: "Повторить сохранение", exact: true }).click();
    assert.equal(await page.evaluate(() => window.workoutUi.saveCalls), 1);
  } finally {
    await browser.close();
  }
});

test("повтор отправки не объявляет облачный успех до обновления pending и не маскирует локальный план", { timeout: 30000 }, async () => {
  const browser = await chromium.launch();
  try {
    const page = await openProbe(browser);
    await page.evaluate(() => window.workoutUi.overview({}));
    const notice = page.getByTestId("workout-plan-cloud-save-notice");
    assert.match(await notice.textContent(), /План пока не подтверждён в облаке/);
    assert.match(await notice.textContent(), /2 тренировки сохранены на устройстве/);
    await notice.getByRole("button", { name: "Повторить отправку", exact: true }).click();
    assert.equal(await notice.getByRole("button", { name: "Отправляем результаты…", exact: true }).isDisabled(), true);
    assert.equal(await page.evaluate(() => window.workoutUi.retryCalls), 1);

    await page.evaluate(() => window.workoutUi.resolveRetry());
    await notice.getByText(/Ожидаем подтверждения облачной записи/).waitFor();
    assert.doesNotMatch(await notice.textContent(), /Сохранено в облаке|Синхронизировано/);
    assert.equal(await notice.getByRole("button", { name: "Повторить отправку", exact: true }).isEnabled(), true);

    await page.evaluate(() => window.workoutUi.overview({ pendingSyncCount: 0 }));
    assert.match(await notice.textContent(), /План пока не подтверждён в облаке/);
    assert.equal(await notice.getByRole("button").count(), 0);
    assert.doesNotMatch(await notice.textContent(), /результат|Ожидаем подтверждения/);

    await page.evaluate(() => window.workoutUi.overview({ pendingSyncCount: 1, localOnlyPlan: false }));
    await notice.getByRole("button", { name: "Повторить отправку", exact: true }).click();
    await page.evaluate(() => window.workoutUi.rejectRetry());
    await notice.getByText(/Не удалось отправить результаты/).waitFor();
    assert.match(await notice.textContent(), /Они остаются на устройстве/);
    assert.equal(await notice.getByRole("button", { name: "Повторить отправку", exact: true }).isEnabled(), true);

    await page.evaluate(() => window.workoutUi.overview({ pendingSyncCount: 0 }));
    assert.equal(await notice.count(), 0);
  } finally {
    await browser.close();
  }
});

test("отказ переноса сохраняет выбранную дату, защищает запрос от закрытия и разрешает повтор", { timeout: 30000 }, async () => {
  const browser = await chromium.launch();
  try {
    const page = await openProbe(browser);
    await page.evaluate(() => window.workoutUi.overview({ todayState: "missed", localOnlyPlan: false, pendingSyncCount: 0 }));
    await page.getByRole("button", { name: "Перенести", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Перенести тренировку", exact: true });
    const dateInput = dialog.getByLabel("Новая дата", { exact: true });
    const chosenDate = await page.evaluate(() => {
      const date = new Date(); date.setDate(date.getDate() + 7);
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    });
    await dateInput.fill(chosenDate);
    await dialog.getByRole("button", { name: "Сохранить дату", exact: true }).click();
    assert.equal(await dateInput.isDisabled(), true);
    assert.equal(await dialog.getByRole("button", { name: "Закрыть", exact: true }).isDisabled(), true);
    assert.equal(await dialog.getByRole("button", { name: "Сохраняем…", exact: true }).isDisabled(), true);
    await page.getByTestId("workout-today-action-overlay").dispatchEvent("click");
    await page.keyboard.press("Escape");
    await dialog.getByRole("button", { name: "Закрыть", exact: true }).evaluate(button => button.click());
    assert.equal(await dialog.count(), 1);
    assert.equal(await dateInput.inputValue(), chosenDate);

    await page.evaluate(() => window.workoutUi.resolveReschedule(false));
    await dialog.getByRole("alert").waitFor();
    assert.match(await dialog.getByRole("alert").textContent(), /Не удалось подтвердить перенос/);
    assert.equal(await dateInput.inputValue(), chosenDate);
    assert.equal(await dateInput.isEnabled(), true);
    assert.equal(await dialog.getByRole("button", { name: "Закрыть", exact: true }).isEnabled(), true);
    await dialog.getByRole("button", { name: "Сохранить дату", exact: true }).click();
    await page.evaluate(() => window.workoutUi.resolveReschedule(true));
    await dialog.waitFor({ state: "detached" });
    assert.deepEqual(await page.evaluate(() => window.workoutUi.rescheduleCalls), [chosenDate, chosenDate]);
    assert.deepEqual(await page.evaluate(() => window.workoutUi.unhandled), []);
  } finally {
    await browser.close();
  }
});

test("ошибка Promise при переносе не зависает и успешный void-повтор закрывает ту же форму", { timeout: 30000 }, async () => {
  const browser = await chromium.launch();
  try {
    const page = await openProbe(browser);
    await page.evaluate(() => window.workoutUi.overview({ todayState: "missed", localOnlyPlan: false, pendingSyncCount: 0 }));
    await page.getByRole("button", { name: "Перенести", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Перенести тренировку", exact: true });
    const dateInput = dialog.getByLabel("Новая дата", { exact: true });
    const chosenDate = await dateInput.getAttribute("min");
    await dateInput.fill(chosenDate);
    await dialog.getByRole("button", { name: "Сохранить дату", exact: true }).click();
    await page.evaluate(() => window.workoutUi.rejectReschedule());
    await dialog.getByRole("alert").waitFor();
    assert.match(await dialog.getByRole("alert").textContent(), /Выбранная дата остаётся в форме/);
    assert.equal(await dateInput.inputValue(), chosenDate);
    assert.equal(await dialog.getByRole("button", { name: "Сохранить дату", exact: true }).isEnabled(), true);
    assert.equal(await dialog.getAttribute("aria-busy"), "false");
    assert.deepEqual(await page.evaluate(() => window.workoutUi.unhandled), []);

    await dialog.getByRole("button", { name: "Сохранить дату", exact: true }).click();
    await page.evaluate(() => window.workoutUi.resolveReschedule());
    await dialog.waitFor({ state: "detached" });
    assert.deepEqual(await page.evaluate(() => window.workoutUi.rescheduleCalls), [chosenDate, chosenDate]);
    assert.deepEqual(await page.evaluate(() => window.workoutUi.unhandled), []);
  } finally {
    await browser.close();
  }
});
