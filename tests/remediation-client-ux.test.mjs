import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { rolldown } from "rolldown";
import { createRequire } from "node:module";
import { buildWeightChart, getPeriodMeasurements, progressPeriodRange } from "../src/features/client/profile/profileProgressChart.js";

const root = fileURLToPath(new URL("../src/", import.meta.url)).replaceAll("\\", "/");
const imports = [
  ["ActionBar", "features/client/nutrition/FoodProductActionBar.jsx"],
  ["SearchResults", "features/client/nutrition/FoodSearchResults.jsx"],
  ["Meal", "features/client/nutrition/NutritionMealModal.jsx"],
  ["Panel", "features/client/profile/ProfileMeasurementWizardPanel.jsx"],
  ["Summary", "features/client/profile/ProfileSummaryDashboard.jsx"],
  ["Overview", "features/client/workouts/WorkoutRenderOverview.jsx"],
  ["Orbit", "features/client/nutrition/NutritionOrbit.jsx"],
  ["WorkoutList", "features/client/workouts/WorkoutListPage.jsx"],
  ["Router", "app/AppRouter.jsx"]
];
const bundle = await rolldown({ input: "client-ux-ssr", platform: "node", transform: { jsx: { runtime: "automatic" } }, plugins: [{
  name: "client-ux-ssr", resolveId: id => id === "client-ux-ssr" ? id : /\/firebase(?:\.js)?$/.test(id) ? "client-ux-firebase" : null,
  load(id) {
    if (id === "client-ux-firebase") return "export const app={options:{}};export const auth={currentUser:null};export const db={};";
    if (id.endsWith(".css")) return { code: "export default {};", moduleType: "js" };
    if (id !== "client-ux-ssr") return null;
    return { moduleType: "jsx", code: `import React from 'react';import{renderToStaticMarkup}from'react-dom/server';
      ${imports.map(([name, path]) => `import ${name} from ${JSON.stringify(root + path)};`).join("\n")}
      import{IndividualWorkoutHistoryDialog as History}from ${JSON.stringify(root + "features/client/workouts/WorkoutListDialogs.jsx")};
      const components={${imports.map(([name]) => name).join(",")},History};
      export const render=(name,props)=>renderToStaticMarkup(React.createElement(components[name],props));` };
  }
}] });
const generated = await bundle.generate({ format: "cjs", codeSplitting: false });
await bundle.close();
const compiled = { exports: {} };
new Function("require", "module", "exports", generated.output[0].code)(createRequire(import.meta.url), compiled, compiled.exports);
const { render } = compiled.exports;

test("П06: real lazy route accepts the boolean role contract and keeps the active client dock", () => {
  const html = render("Router", { page: "workouts", canUseTrainerFeatures: false,
    canUseAdminFeatures: () => false, workoutListProps: {}, renderClientMainBottomBar: tab => `Navigation:${tab}` });
  assert.match(html, /data-testid="route-loading"/);
  assert.match(html, /Тренировки/);
  assert.match(html, /Navigation:workouts/);
});

test("К06: unequal date gaps retain their true ratio on the chart", () => {
  const chart = buildWeightChart([1, 2, 30].map(day => ({ date: `2026-10-${String(day).padStart(2, "0")}`, weight: 80 - day / 10 })));
  assert.equal(chart.points[0].x, 8);
  assert.equal(chart.points[2].x, 312);
  assert.ok(Math.abs((chart.points[1].x - 8) / (312 - 8) - 1 / 29) < 1e-8);
  assert.match(chart.path, /^M8\.0 /);
});

test("К07: month is 30 calendar days from now, stale and future observations do not fill it", () => {
  const now = new Date(2026, 9, 19, 12);
  const range = progressPeriodRange("month", now);
  assert.equal(range.from.getDate(), 20);
  assert.equal(range.from.getMonth(), 8);
  const list = [{ date: "2026-06-22", weight: 80 }, { date: "2026-09-19", weight: 79 }, { date: "2026-09-20", weight: 78 }, { date: "2026-10-19", weight: 77 }, { date: "2026-10-20", weight: 76 }];
  assert.deepEqual(getPeriodMeasurements(list, "month", now).map(item => item.weight), [78, 77]);
  const html = render("Panel", { visible: true, now, measurements: list.slice(0, 1), latestMeasurement: list[0], measurementFields: [{ id: "weight" }], formatMeasurementDate: item => item.date });
  assert.match(html, /Последние 30 дней/);
  assert.match(html, /За выбранный период свежих замеров веса нет/);
  assert.match(html, /Последний вес: 2026-06-22/);
  assert.doesNotMatch(html, /<svg[^>]*viewBox="0 0 320 105"/);
});

test("К02: without verified all-time history only the current programme is labelled, with 12 initial rows", () => {
  const historyItems = Array.from({ length: 16 }, (_, i) => ({ id: `record-${i}`, workout: `Workout ${i}`, date: "2026-10-01", durationSeconds: 60, exercises: [{ sets: [{ weight: i === 15 ? 150 : 10 }] }] }));
  const html = render("History", { open: true, historyItems });
  assert.match(html, /Полная история пока недоступна/);
  assert.match(html, /В текущей программе: 16 тренировок/);
  assert.doesNotMatch(html, /150 кг/);
  assert.match(html, /осталось 4/);
  assert.equal((html.match(/data-testid="workout-history-dialog-item"/g) || []).length, 12);
});

test("К05: actual primary label distinguishes add from editing", () => {
  assert.match(render("ActionBar", { isEditing: true }), /Сохранить изменения/);
  assert.doesNotMatch(render("ActionBar", { isEditing: true }), />Добавить</);
  assert.match(render("ActionBar", {}), />Добавить</);
});

test("К09: filtered My Foods is not presented as an empty library", () => {
  const props = { search: "несуществующее", searchTab: "my", searchResults: [], visibleResults: [], fallbackSuggestions: [], nutrition: { myFoods: { a: { name: "Яблоко" } } } };
  const html = render("SearchResults", props);
  assert.match(html, /По запросу ничего не найдено/);
  assert.match(html, /Очистить поиск/);
  assert.doesNotMatch(html, /Пока нет своих продуктов/);
  assert.match(render("SearchResults", { ...props, search: "", nutrition: { myFoods: {} } }), /Пока нет своих продуктов/);
});

test("К04: each actual meal row has a separate named native delete button", () => {
  const html = render("Meal", { activeMeal: { id: "breakfast", name: "Завтрак" }, foods: [{ id: "a", name: "Яблоко", amount: 100 }], stats: { calories: 50 }, swipeOffsets: {}, getFoodIcon: () => "", onRemoveFood: () => {} });
  assert.match(html, /<button[^>]*aria-label="Удалить запись: Яблоко"/);
  assert.match(html, /data-testid="nutrition-meal-food"/);
});

test("К01 and К12: modern overview displays local-only/pending state and proper plural forms", () => {
  const html = render("Overview", { workout: { name: "Тренировка", exercises: [{ sets: [{}, {}] }, { sets: [] }] }, localOnlyPlan: true, pendingSyncCount: 2 });
  assert.match(html, /План только на этом устройстве/);
  assert.match(html, /2 тренировки сохранены на устройстве/);
  assert.match(html, /2 упражнения · 2 подхода/);
  assert.doesNotMatch(html, /Повторить синхронизацию/);
});

test("П05: summary does not claim missing program or offer workout start before loading", () => {
  for (const workoutLoadState of ["idle", "loading", "error"]) {
    const html = render("Summary", { workoutLoadState, workoutState: "empty", showProgressPhotoTask: false, onRetryWorkoutLoad: () => {} });
    assert.doesNotMatch(html, /Программы пока нет|Выбрать программу|Начать тренировку|Пока всё по плану/);
    assert.match(html, workoutLoadState === "error" ? /Не удалось загрузить план/ : /Загружаем план тренировок/);
    assert.match(html, /data-testid="profile-summary-workout-log" disabled=""/);
    if (workoutLoadState === "error") assert.match(html, /Повторить загрузку/);
  }
});

test("К11: historical date includes month and year and does not claim today", () => {
  const html = render("Orbit", { voiceEnabled: true, dateKey: "2020-12-31", dateTitle: "31 декабря", items: [{ amount: 200, target: 2000 }] });
  assert.match(html, /31 декабря 2020/);
  assert.match(html, /Остаток за выбранный день/);
  assert.doesNotMatch(html, /Осталось на сегодня/);
});

test("К12: exercise and set forms are correct for 1, 2, 5, 11 and 21", () => {
  for (const [count, exercise, set] of [[1, "упражнение", "подход"], [2, "упражнения", "подхода"], [5, "упражнений", "подходов"], [11, "упражнений", "подходов"], [21, "упражнение", "подход"]]) {
    const html = render("Overview", { workout: { exercises: Array.from({ length: count }, () => ({ sets: [{}] })) } });
    assert.ok(html.includes(`${count} ${exercise} · ${count} ${set}`));
  }
});

test("К01: local-only plan never exposes a history-only retry with misleading semantics", () => {
  const html = render("Overview", { localOnlyPlan: true, pendingSyncCount: 0, onRetrySync() {} });
  assert.match(html, /План пока не подтверждён в облаке/);
  assert.doesNotMatch(html, /Повторить синхронизацию|синхронизация результатов повторится/);
});

test("П05: actual list loading/error preserves header and bottom navigation without start action", () => {
  for (const initialLoadState of ["idle", "loading", "error"]) {
    let activeTab;
    const html = render("WorkoutList", { initialLoadState, plan: { workouts: [] }, history: [], workoutModePreference: { mode: "basic" }, renderClientMainBottomBar: tab => { activeTab = tab; return "Navigation"; }, onRetryLoad() {} });
    assert.equal(activeTab, "workouts");
    assert.match(html, /Тренировки/); assert.match(html, /Navigation/);
    assert.doesNotMatch(html, /data-testid="workout-start-button"/);
    assert.match(html, initialLoadState === "error" ? /Повторить загрузку/ : /Загружаем план тренировок/);
  }
});
