import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { rolldown } from "rolldown";
import { chromium } from "playwright";
import { getClientWorkoutProgramItems } from "../src/utils/clientWorkoutProgramOrder.js";

const orders = [33, 34, 35, 4, 37, 38, 39, 40];
const ids = rows => rows.map(row => row.id);

function fixture() {
  const workouts = orders.map((order, index) => ({
    id: `day-${index + 1}`,
    name: `Тренировка ${index + 1}`,
    order,
    sortOrder: order,
    assignedProgramId: "program-a",
    assignedProgramAddedAt: "assignment-a",
    assignedProgramUpdatedAt: "queue-v1",
    status: index < 3 ? "completed" : "planned",
    scheduledDate: `2026-10-${10 + index * 2}`,
    exercises: [{ id: `exercise-${index + 1}`, name: `Упражнение ${index + 1}`, sets: [{ reps: 10, weight: 20 }] }]
  }));
  const calendar = {
    assignedProgramUpdatedAt: "queue-v1",
    plannedWorkouts: workouts.map((workout, index) => ({
      workoutId: workout.id,
      order: index + 1,
      index,
      assignedProgramId: "program-a",
      assignedProgramAddedAt: "assignment-a",
      assignedProgramUpdatedAt: "queue-v1",
      date: workout.scheduledDate,
      dateOrderPolicy: "workout_identity",
      status: workout.status
    }))
  };
  const executionWorkouts = [...workouts].sort((left, right) => left.order - right.order);
  const items = executionWorkouts.map((workout, index) => ({
    id: workout.id,
    index,
    name: workout.name,
    date: workout.scheduledDate,
    completed: workout.status === "completed",
    active: workout.id === "day-4",
    exerciseCount: workout.exercises.length,
    exercises: workout.exercises.map(exercise => ({ name: exercise.name, detail: "1 подх. · 10 повт." }))
  }));
  return { workouts, executionWorkouts, calendar, items };
}

test("программа 8 дней/3 выполнены восстанавливает DISPLAY-порядок, не меняя execution index, даты и завершение", () => {
  const { executionWorkouts, calendar, items } = fixture();
  const before = JSON.stringify({ executionWorkouts, calendar, items });
  items.forEach(Object.freeze);
  executionWorkouts.forEach(Object.freeze);
  calendar.plannedWorkouts.forEach(Object.freeze);
  Object.freeze(items);
  Object.freeze(executionWorkouts);
  Object.freeze(calendar.plannedWorkouts);
  const result = getClientWorkoutProgramItems(items, executionWorkouts, calendar);
  assert.deepEqual(ids(result), Array.from({ length: 8 }, (_, index) => `day-${index + 1}`));
  assert.deepEqual(result.map(item => item.programOrder), [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.equal(result.find(item => item.active)?.id, "day-4");
  assert.equal(result.find(item => item.active)?.index, 0, "следующая незавершённая сохраняет исходный исполнительный индекс");
  assert.deepEqual(result.filter(item => item.completed).map(item => item.id), ["day-1", "day-2", "day-3"]);
  for (const item of result) {
    const source = items.find(candidate => candidate.id === item.id);
    assert.equal(item.date, source.date, item.id);
    assert.equal(item.index, source.index, item.id);
    assert.equal(item.completed, source.completed, item.id);
    assert.equal(item.exercises, source.exercises, item.id);
  }
  assert.equal(JSON.stringify({ executionWorkouts, calendar, items }), before);
});

test("непрерывный ручной порядок остаётся главным, даже если названия и календарь предлагают другой", () => {
  const { workouts, calendar } = fixture();
  const manualIds = ["day-3", "day-1", "day-4", "day-2", "day-8", "day-7", "day-6", "day-5"];
  const manual = manualIds.map((id, index) => ({ ...workouts.find(workout => workout.id === id), order: index + 1, sortOrder: index + 1 }));
  const items = manual.map((workout, index) => ({ id: workout.id, index, name: workout.name, date: workout.scheduledDate, active: workout.id === "day-4" }));
  const result = getClientWorkoutProgramItems(items, manual, calendar);
  assert.deepEqual(ids(result), manualIds);
  assert.deepEqual(result.map(item => item.programOrder), [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.equal(result.find(item => item.active)?.index, 2);
});

test("неполный календарь не позволяет угадывать порядок по имени или выполнению", () => {
  const { executionWorkouts, calendar, items } = fixture();
  const result = getClientWorkoutProgramItems(items, executionWorkouts, { ...calendar, plannedWorkouts: calendar.plannedWorkouts.slice(0, -1) });
  assert.deepEqual(ids(result), ids(items));
  assert.equal(result[0].id, "day-4");
  assert.equal(result[0].index, 0);
  assert.deepEqual(result.map(item => item.date), items.map(item => item.date));
});

const pagePath = fileURLToPath(new URL("../src/features/client/workouts/WorkoutListPage.jsx", import.meta.url)).replaceAll("\\", "/");
const browserFixture = fixture();
const bundle = await rolldown({
  input: "client-program-order",
  platform: "browser",
  transform: { jsx: { runtime: "automatic" }, define: { "import.meta.env": JSON.stringify({ MODE: "test", DEV: false }) } },
  plugins: [{
    name: "client-program-order",
    resolveId(id) {
      if (id === "client-program-order" || id === "program-order-firebase") return id;
      if (/\/firebase(?:\.js)?$/.test(id)) return "program-order-firebase";
      return null;
    },
    load(id) {
      if (id === "program-order-firebase") return "export const app={options:{}};export const auth={currentUser:null,onAuthStateChanged:()=>()=>{},onIdTokenChanged:()=>()=>{}};export const db={};export const storage={};export const functions={};";
      if (id.endsWith(".css")) return { moduleType: "js", code: "export default {};" };
      if (id !== "client-program-order") return null;
      return { moduleType: "jsx", code: `
        import React from 'react';
        import {createRoot} from 'react-dom/client';
        import {flushSync} from 'react-dom';
        import WorkoutListPage from ${JSON.stringify(pagePath)};
        const fixture=${JSON.stringify(browserFixture)};
        window.programProbe={errors:[],opened:[]};
        class Boundary extends React.Component {
          state={failed:false};
          static getDerivedStateFromError(){return{failed:true};}
          componentDidCatch(error){window.programProbe.errors.push(error.message);}
          render(){return this.state.failed?<output data-testid="program-render-error">Ошибка экрана</output>:this.props.children;}
        }
        const noop=()=>{};
        const props={appVersion:'test',initialLoadState:'ready',
          plan:{assignedProgramId:'program-a',assignedProgramName:'Индивидуальная программа',assignedProgramUpdatedAt:'queue-v1',workouts:fixture.workouts},
          history:[],workoutCalendar:fixture.calendar,currentUserId:'',workoutModePreference:{mode:'individual'},
          individualWorkoutIndex:0,individualWorkoutIndexInitialized:false,
          setIndividualWorkoutIndex:noop,setIndividualWorkoutIndexInitialized:noop,
          workoutHistoryModalOpen:false,setWorkoutHistoryModalOpen:noop,historyLoading:false,
          renderClientMainBottomBar:()=>null,loadHistory:noop,
          openWorkout:id=>window.programProbe.opened.push(id),handleWorkoutDraftChoice:noop,
          onOpenBasicMode:noop,onOpenBasicSettings:noop,onOpenBasicToday:noop};
        flushSync(()=>createRoot(document.getElementById('root')).render(<Boundary><WorkoutListPage {...props}/></Boundary>));
      ` };
    }
  }]
});
const generated = await bundle.generate({ format: "iife", codeSplitting: false });
await bundle.close();

test("полный WorkoutListPage показывает программу 1–8, держит день 4 под номером 04 и запускает именно day-4", { timeout: 30000 }, async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.clock.install({ time: new Date("2026-10-30T12:00:00Z") });
    await page.setContent('<main id="root"></main>');
    await page.addScriptTag({ content: generated.output[0].code });
    assert.deepEqual(await page.evaluate(() => window.programProbe.errors), []);
    await page.getByRole("button", { name: "Открыть программу", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Программа тренировок", exact: true });
    const rows = dialog.getByTestId("workout-program-dialog-item");
    assert.deepEqual(await rows.locator("strong").allTextContents(), browserFixture.workouts.map(workout => workout.name));
    assert.match(await dialog.textContent(), /8 тренировок · 3 выполнено/);
    for (const workout of browserFixture.workouts) {
      const row = rows.filter({ has: page.getByText(workout.name, { exact: true }) });
      const expectedDate = new Date(`${workout.scheduledDate}T12:00:00`).toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
      assert.match(await row.locator("small").textContent(), new RegExp(expectedDate), workout.id);
      assert.equal(await row.locator(":scope > span").first().locator("svg").count(), workout.status === "completed" ? 1 : 0, workout.id);
    }
    const day4 = rows.filter({ has: page.getByText("Тренировка 4", { exact: true }) });
    const day5 = rows.filter({ has: page.getByText("Тренировка 5", { exact: true }) });
    assert.equal(await day4.locator(":scope > span").first().textContent(), "04");
    assert.equal(await day4.getAttribute("aria-expanded"), "true");
    assert.match(await dialog.getByTestId("workout-program-exercise-list").textContent(), /Упражнение 4/);
    await day4.click();
    assert.equal(await day4.getAttribute("aria-expanded"), "false");
    assert.equal(await dialog.getByTestId("workout-program-exercise-list").count(), 0);
    await day5.click();
    assert.equal(await day5.getAttribute("aria-expanded"), "true");
    assert.equal(await day4.getAttribute("aria-expanded"), "false");
    assert.match(await dialog.getByTestId("workout-program-exercise-list").textContent(), /Упражнение 5/);
    await dialog.getByRole("button", { name: "Закрыть программу тренировок", exact: true }).click();
    assert.match(await page.getByTestId("workout-today-card").textContent(), /Тренировка 4/);
    await page.getByTestId("workout-start-button").click();
    assert.deepEqual(await page.evaluate(() => window.programProbe.opened), ["day-4"]);
    assert.deepEqual(await page.evaluate(() => window.programProbe.errors), []);
    assert.equal(await page.getByTestId("program-render-error").count(), 0);
  } finally {
    await browser.close();
  }
});
