import assert from "node:assert/strict";
import test, { after, beforeEach } from "node:test";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { rolldown } from "rolldown";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { installRuntimeImports } from "./helpers/runtime-imports.mjs";

let monthlyCalls = 0, analysisCalls = 0, memoEntry;
const goals = { calories: 2000, protein: 120, fat: 70, carbs: 220 };
const plan = { profile: { goal: "maintain", trainingDays: [] }, weeks: [goals], createdAt: "2026-10-01" };
const cleanup = installRuntimeImports({
  react: { useMemo: (factory, dependencies) => {
    if (!memoEntry || dependencies.some((value, index) => !Object.is(value, memoEntry.dependencies[index]))) {
      memoEntry = { dependencies, value: factory() };
    }
    return memoEntry.value;
  } },
  "/src/utils/aiNutritionPlanBuilder.js": { buildAiNutritionMonthlyPlan: () => { monthlyCalls++; return plan; } },
  "/src/utils/aiNutritionAnalysis.js": { buildAiNutritionDayModel: () => { analysisCalls++; return { collapsedText: "История проверена", score: 80 }; } }
});
after(cleanup);
const { buildNutritionPageModel } = await import("../src/features/client/nutrition/nutritionPageModel.js");
const { useNutritionPageData } = await import("../src/features/client/nutrition/useNutritionPageData.js");
beforeEach(() => { monthlyCalls = 0; analysisCalls = 0; memoEntry = null; });
const input = () => ({ aiNutritionProfile: { goal: "maintain", trainingDays: [] }, aiNutritionProfileDraft: {},
  nutrition: { goals, days: {} }, history: [], nutritionTotals: { calories: 500, protein: 30, fat: 20, carbs: 50 },
  nutritionDateKey: "2026-10-26", isNutritionToday: true, nutritionToday: { foods: [] },
  nutritionMeals: [], expandedNutritionMeals: {}, nutritionWeekDates: [], nutritionCurrentStreak: 12 });

test("partial day never invokes monthly plan or day analysis and never advertises a partial streak", () => {
  const model = buildNutritionPageModel({ ...input(), nutritionHistoryReady: false });
  assert.equal(monthlyCalls, 0); assert.equal(analysisCalls, 0); assert.equal(model.aiNutritionDay, null);
  assert.equal(model.nutritionStreakText, "");
  assert.equal(model.nutritionSummaryCollapsedText, "Анализ появится после загрузки истории");
  assert.equal(model.caloriesConsumed, 500); assert.equal(model.effectiveNutritionGoals.calories, 2000);
});

test("saved plan targets remain available on a partial day without analysis", () => {
  const model = buildNutritionPageModel({ ...input(), aiNutritionSavedPlan: { ...plan, weeks: [{ ...goals, calories: 2300 }] }, nutritionHistoryReady: false });
  assert.equal(model.effectiveNutritionGoals.calories, 2300); assert.equal(monthlyCalls, 0); assert.equal(analysisCalls, 0);
});

test("omitted readiness preserves the existing ready model exactly", () => {
  assert.deepEqual(buildNutritionPageModel(input()), buildNutritionPageModel({ ...input(), nutritionHistoryReady: true }));
  assert.equal(analysisCalls, 2); assert.equal(monthlyCalls, 2);
});

test("real route data hook forwards readiness and invalidates its memo when coverage becomes complete", () => {
  const props = input();
  const partial = useNutritionPageData({ ...props, nutritionHistoryReady: false });
  assert.equal(monthlyCalls, 0); assert.equal(analysisCalls, 0); assert.equal(partial.aiNutritionDay, null);
  assert.equal(useNutritionPageData({ ...props, nutritionHistoryReady: false }), partial);
  const complete = useNutritionPageData({ ...props, nutritionHistoryReady: true });
  assert.notEqual(complete, partial); assert.equal(monthlyCalls, 1); assert.equal(analysisCalls, 1);
  assert.equal(complete.nutritionSummaryCollapsedText, "История проверена");
});

async function bundleModule(path) {
  const bundle = await rolldown({ input: fileURLToPath(new URL(path, import.meta.url)), platform: "node",
    transform: { jsx: { runtime: "automatic" } }, external: ["react", "react/jsx-runtime", "lucide-react"],
    plugins: [{ name: "css-stub", load: id => id.endsWith(".css") ? { code: "export default {};", moduleType: "js" } : null }] });
  const generated = await bundle.generate({ format: "cjs", exports: "named" }); await bundle.close();
  const module = { exports: {} };
  new Function("require", "module", "exports", generated.output[0].code)(createRequire(import.meta.url), module, module.exports);
  return module.exports;
}
const { default: Details } = await bundleModule("../src/features/client/nutrition/NutritionPlanDetails.jsx");
const { renderNutritionPageFromContext } = await bundleModule("../src/features/client/nutrition/renderNutritionPageFromContext.jsx");
const pending = { isExpanded: true, nutritionHistoryReady: false, goalText: "Поддержание" };
const render = props => renderToStaticMarkup(React.createElement(Details, props));
function findElement(element, predicate) {
  if (!element || typeof element !== "object") return null;
  if (predicate(element)) return element;
  for (const child of React.Children.toArray(element.props?.children)) { const found = findElement(child, predicate); if (found) return found; }
  return null;
}

test("expanded partial analysis has an accessible waiting state and no invented score or conclusions", () => {
  const html = render(pending);
  assert.match(html, /Анализ появится после загрузки истории/); assert.match(html, /role="status"/);
  assert.doesNotMatch(html, /Соответствие плану|Короткий вывод|Неделя|score-block/);
  assert.equal(render({ ...pending, isExpanded: false }), "");
});

test("ready details preserve the default complete-history rendering and daily values", () => {
  const props = { isExpanded: true, goalText: "Поддержание", todayPlanMacros: goals, effectiveGoals: goals,
    nutritionTotals: input().nutritionTotals, nutritionDay: { score: 80, summary: "Готовый анализ", adaptiveAdvice: "Сохранённый совет", badges: [] },
    scoreSegments: [], roundMacro: value => value, caloriesConsumed: 500, caloriePercent: 25, caloriesLeft: 1500,
    proteinPercent: 25, fatPercent: 28, carbsPercent: 23, currentWeek: 1 };
  const html = render(props);
  assert.equal(html, render({ ...props, nutritionHistoryReady: true }));
  assert.match(html, /Готовый анализ/); assert.match(html, /500/); assert.match(html, /Соответствие плану/);
});

test("history loading disables retry and does not display an authoritative score", () => {
  const html = render({ ...pending, nutritionHistoryLoading: true, onLoadNutritionHistory: () => {} });
  assert.match(html, /aria-busy="true"/); assert.match(html, /disabled=""/); assert.match(html, /Загружаем историю питания/);
  assert.doesNotMatch(html, /Соответствие плану/);
});

test("history error offers retry, invokes the supplied loader, and handles a rejected retry", async () => {
  let calls = 0;
  const props = { ...pending, nutritionHistoryError: new Error("private diagnostic"), onLoadNutritionHistory: async () => { calls++; throw new Error("Denied"); } };
  const html = render(props); assert.match(html, /role="alert"/); assert.match(html, /Повторить загрузку/); assert.doesNotMatch(html, /private diagnostic/);
  const button = findElement(Details(props), element => element.type === "button" && element.props.children === "Повторить загрузку");
  const originalWarn = console.warn; console.warn = () => {};
  try { await button.props.onClick(); } finally { console.warn = originalWarn; }
  assert.equal(calls, 1);
});

test("context rendering forwards readiness and load state to both model and existing details UI", () => {
  let modelArgs; const loader = () => {};
  const element = renderNutritionPageFromContext({ NutritionPageView: () => null,
    buildNutritionPageModel: args => { modelArgs = args; return {}; },
    nutritionHistoryReady: false, nutritionHistoryLoading: true, nutritionHistoryError: "failed", onLoadNutritionHistory: loader });
  assert.equal(modelArgs.nutritionHistoryReady, false);
  assert.equal(element.props.planDetailsProps.nutritionHistoryReady, false);
  assert.equal(element.props.planDetailsProps.nutritionHistoryLoading, true);
  assert.equal(element.props.planDetailsProps.nutritionHistoryError, "failed");
  assert.equal(element.props.planDetailsProps.onLoadNutritionHistory, loader);
});
