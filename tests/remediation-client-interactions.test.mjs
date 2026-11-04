import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { rolldown } from "rolldown";

const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL("../src/", import.meta.url)).replaceAll("\\", "/");
const react = require.resolve("react").replaceAll("\\", "/");
const bundle = await rolldown({ input: "client-interaction", platform: "node", transform: { jsx: { runtime: "automatic" } }, plugins: [{
  name: "actual-component-hook-runner",
  resolveId(id) {
    if (["client-interaction", "interaction-react", "interaction-photo-loader", "interaction-back"].includes(id)) return id;
    if (id === "react") return "interaction-react";
    if (id.endsWith("/privateProgressPhoto.js")) return "interaction-photo-loader";
    if (id.endsWith("/useModalBackNavigation.js")) return "interaction-back";
    return null;
  },
  load(id) {
    if (id.endsWith(".css")) return { code: "export default {};", moduleType: "js" };
    if (id === "interaction-react") return `export * from ${JSON.stringify(react)};export {default}from ${JSON.stringify(react)};export const useState=v=>globalThis.__clientHooks.state(v);export const useRef=v=>globalThis.__clientHooks.ref(v);export const useEffect=(fn,deps)=>globalThis.__clientHooks.effect(fn,deps);export const useMemo=fn=>fn();`;
    if (id === "interaction-back") return "export const useModalBackNavigation=options=>{globalThis.__clientBack=options};";
    if (id === "interaction-photo-loader") return "export const startPrivateProgressPhotoLoad=options=>globalThis.__clientPhotoStart(options);";
    if (id !== "client-interaction") return null;
    return `import Wizard from ${JSON.stringify(root + "features/client/measurements/MeasurementWizardPage.jsx")};import Photo from ${JSON.stringify(root + "components/media/PrivateProgressPhoto.jsx")};import Meal from ${JSON.stringify(root + "features/client/nutrition/NutritionMealModal.jsx")};import ActionBar from ${JSON.stringify(root + "features/client/nutrition/FoodProductActionBar.jsx")};import{IndividualWorkoutHistoryDialog as History}from ${JSON.stringify(root + "features/client/workouts/WorkoutListDialogs.jsx")};import{createNutritionDiaryFoodHandlers as DiaryHandlers}from ${JSON.stringify(root + "features/client/nutrition/nutritionDiaryFoodHandlers.js")};export{Wizard,Photo,Meal,ActionBar,History,DiaryHandlers};`;
  }
}] });
const generated = await bundle.generate({ format: "cjs", codeSplitting: false }); await bundle.close();
const compiled = { exports: {} };
new Function("require", "module", "exports", generated.output[0].code)(require, compiled, compiled.exports);
const { Wizard, Photo, Meal, ActionBar, History, DiaryHandlers } = compiled.exports;

function hookRunner(Component, props) {
  const slots = [], pending = [];
  let index = 0;
  const runner = {
    state(initial) { const key = index++; if (!(key in slots)) slots[key] = typeof initial === "function" ? initial() : initial; return [slots[key], update => { slots[key] = typeof update === "function" ? update(slots[key]) : update; }]; },
    ref(initial) { const key = index++; if (!(key in slots)) slots[key] = { current: initial }; return slots[key]; },
    effect(fn, deps) { const key = index++, old = slots[key]; if (!old || !deps || deps.some((value, i) => value !== old.deps[i])) { pending.push(() => { old?.cleanup?.(); slots[key] = { deps, cleanup: fn() }; }); } },
    render() { index = 0; globalThis.__clientHooks = runner; const tree = Component(props); pending.splice(0).forEach(fn => fn()); return tree; },
    dispose() { slots.forEach(slot => slot?.cleanup?.()); }
  };
  return runner;
}
function elements(tree) {
  if (!tree || typeof tree !== "object") return [];
  if (Array.isArray(tree)) return tree.flatMap(elements);
  return [tree, ...elements(tree.props?.children), ...elements(tree.props?.actions)];
}
const find = (tree, predicate) => elements(tree).find(predicate);
const text = tree => typeof tree === "string" || typeof tree === "number" ? String(tree) : Array.isArray(tree) ? tree.map(text).join("") : text(tree?.props?.children || "");

test("К03: modified wizard draft survives close cancellation; explicit discard clears draft only", () => {
  const history = [{ id: "saved", weight: 80 }];
  let draft = { weight: "", note: "" }, closed = false;
  const props = { aiNutritionProfile: {}, aiNutritionProfileDraft: {}, profileMeasurements: history, profileMeasurementWizardStep: 0, profileMeasurementDraft: draft, profileMeasurementStatus: "", profileMeasurementSaving: false, profileMeasurementReturnTab: "progress", setProfileMeasurementDraft: value => { draft = value; }, setProfileMeasurementStatus() {}, setProfileMeasurementWizardStep() {}, setProfileMeasurementOpen: value => { closed = !value; }, setProfileActiveTab() {}, setPage() {} };
  const runner = hookRunner(Wizard, props); runner.render();
  props.profileMeasurementDraft = { weight: "79", note: "Новый замер" };
  let tree = runner.render();
  find(tree, item => item.type === "button" && item.props["aria-label"] === "Закрыть замеры").props.onClick();
  tree = runner.render();
  assert.ok(find(tree, item => item.props?.role === "alertdialog"));
  assert.equal(closed, false);
  find(tree, item => item.type === "button" && /Продолжить/.test(text(item))).props.onClick();
  assert.equal(find(runner.render(), item => item.props?.role === "alertdialog"), undefined);
  assert.equal(props.profileMeasurementDraft.weight, "79");
  tree = runner.render(); find(tree, item => item.type === "button" && item.props["aria-label"] === "Закрыть замеры").props.onClick();
  tree = runner.render(); find(tree, item => item.type === "button" && /Удалить черновик/.test(text(item))).props.onClick();
  assert.equal(closed, true); assert.equal(draft.weight, ""); assert.equal(draft.note, "");
  assert.deepEqual(history, [{ id: "saved", weight: 80 }]);
});

test("К08: actual photo component offers retry, disposes failed attempt and clears stale state", () => {
  const requests = [];
  globalThis.__clientPhotoStart = options => { const request = { options, disposed: false }; requests.push(request); options.onState({ status: "loading", url: "" }); return { dispose: () => { request.disposed = true; } }; };
  const props = { source: "gs://own/progress-photos/owner/session/front.png", alt: "Спереди", width: 100, height: 140 };
  const runner = hookRunner(Photo, props); runner.render();
  requests[0].options.onState({ status: "error", url: "", accessDenied: false });
  let tree = runner.render(); assert.match(text(tree), /Не удалось загрузить фото/);
  find(tree, item => item.type === "button" && item.props["aria-label"] === "Повторить загрузку: Спереди").props.onClick({ preventDefault() {}, stopPropagation() {} });
  tree = runner.render(); assert.equal(requests.length, 2); assert.equal(requests[0].disposed, true);
  const session = { isCurrent: () => true };
  requests[0].options.onState({ status: "ready", url: "blob:obsolete", session });
  requests[1].options.onState({ status: "ready", url: "blob:current", session });
  tree = runner.render(); const image = find(tree, item => item.type === "img");
  assert.equal(image.props.src, "blob:current"); assert.equal(image.props.width, 100); assert.equal(image.props.height, 140);
  assert.doesNotMatch(text(tree), /Не удалось/);
  requests[1].options.onState({ status: "idle", url: "" });
  assert.equal(find(runner.render(), item => item.type === "img").props.src, undefined);
  runner.dispose(); assert.equal(requests[1].disposed, true);
});

test("К08: access denial is explicit and does not offer a network retry", () => {
  let state;
  globalThis.__clientPhotoStart = options => { state = options.onState; return { dispose() {} }; };
  const runner = hookRunner(Photo, { source: "gs://own/progress-photos/owner/session/front.png" }); runner.render();
  state({ status: "error", url: "", accessDenied: true }); const tree = runner.render();
  assert.match(text(tree), /Нет доступа к фото/);
  assert.equal(find(tree, item => item.type === "button"), undefined);
  assert.equal(find(tree, item => item.type === "img").props.src, undefined);
  runner.dispose();
});

test("К02: load-more exposes all rows while preserving full summary", () => {
  globalThis.window = { addEventListener() {}, removeEventListener() {} };
  const historyItems = Array.from({ length: 16 }, (_, i) => ({ id: `r-${i}`, date: "2026-10-19", workout: `Workout ${i}` }));
  const runner = hookRunner(History, { open: true, historyItems }); let tree = runner.render();
  assert.equal(elements(tree).filter(item => item.props?.["data-testid"] === "workout-history-dialog-item").length, 12);
  find(tree, item => item.type === "button" && /Показать ещё/.test(text(item))).props.onClick(); tree = runner.render();
  assert.equal(elements(tree).filter(item => item.props?.["data-testid"] === "workout-history-dialog-item").length, 16);
  runner.dispose(); delete globalThis.window;
});

test("К04 and К05: native action dispatches only selected row and edit commit exactly once", () => {
  const removed = [], saved = [];
  const tree = Meal({ activeMeal: { id: "lunch", name: "Обед" }, foods: [{ id: "chosen", name: "Рис", amount: 100 }, { id: "other", name: "Суп", amount: 200 }], stats: { calories: 250 }, swipeOffsets: {}, getFoodIcon: () => "", onRemoveFood: id => removed.push(id) });
  find(tree, item => item.type === "button" && item.props["aria-label"] === "Удалить запись: Рис").props.onClick();
  assert.deepEqual(removed, ["chosen"]);
  const bar = ActionBar({ isEditing: true, onAdd: () => saved.push("updated") });
  const primary = find(bar, item => item.type === "button" && /Сохранить изменения/.test(text(item)));
  primary.props.onClick(); assert.deepEqual(saved, ["updated"]);
});

test("К04: actual diary delete and undo preserve selected day, other foods and other days", () => {
  const oldWindow = globalThis.window;
  globalThis.window = { setTimeout: () => 1, clearTimeout() {} };
  try {
    const selectedDay = "2026-10-18", otherDay = "2026-10-19";
    let nutrition = { days: { [selectedDay]: { foods: [{ id: "a", name: "Яблоко" }, { id: "b", name: "Рис" }] }, [otherDay]: { foods: [{ id: "c", name: "Суп" }] } } };
    const untouchedDay = nutrition.days[otherDay]; let undo;
    const context = () => ({ auth: { currentUser: null }, nutrition, nutritionDateKey: selectedDay, nutritionUndoDelete: undo, nutritionUndoTimerRef: { current: null }, updateNutritionDay: update => { nutrition = { ...nutrition, days: { ...nutrition.days, [selectedDay]: update(nutrition.days[selectedDay]) } }; }, setNutritionUndoDelete: value => { undo = value; }, setNutrition: update => { nutrition = update(nutrition); } });
    DiaryHandlers(context()).removeNutritionFood("a");
    assert.deepEqual(nutrition.days[selectedDay].foods.map(item => item.id), ["b"]);
    assert.equal(undo.dateKey, selectedDay);
    DiaryHandlers(context()).restoreNutritionFood();
    assert.deepEqual(nutrition.days[selectedDay].foods.map(item => item.id), ["a", "b"]);
    assert.equal(nutrition.days[otherDay], untouchedDay);
    assert.equal(undo, null);
  } finally { globalThis.window = oldWindow; }
});
