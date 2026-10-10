import assert from "node:assert/strict";
import { after, afterEach, beforeEach, test } from "node:test";
import { registerHooks } from "node:module";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { transformWithOxc } from "vite";
import { installRuntimeImports } from "./helpers/runtime-imports.mjs";

let runtime;
const equalDeps = (left, right) => left && right && left.length === right.length && left.every((value, index) => Object.is(value, right[index]));
const slot = () => runtime.cursor++;
const react = {
  useState(initial) {
    const index = slot();
    if (!runtime.slots[index]) runtime.slots[index] = { value: typeof initial === "function" ? initial() : initial };
    const owner = runtime;
    return [owner.slots[index].value, update => owner.updates.push(() => {
      owner.slots[index].value = typeof update === "function" ? update(owner.slots[index].value) : update;
    })];
  },
  useRef(initial) {
    const index = slot();
    if (!runtime.slots[index]) runtime.slots[index] = { current: initial };
    return runtime.slots[index];
  },
  useMemo(factory, deps) {
    const index = slot();
    if (!equalDeps(runtime.slots[index]?.deps, deps)) runtime.slots[index] = { deps, value: factory() };
    return runtime.slots[index].value;
  },
  useCallback(callback, deps) { return react.useMemo(() => callback, deps); },
  useEffect(callback, deps) {
    const index = slot();
    if (!equalDeps(runtime.slots[index]?.deps, deps)) {
      const previous = runtime.slots[index];
      runtime.slots[index] = { deps };
      const owner = runtime;
      owner.effects.push(() => { previous?.cleanup?.(); owner.slots[index].cleanup = callback(); });
    }
  }
};
const jsx = (type, props) => ({ type, props });
const cleanupImports = installRuntimeImports({
  react, "react/jsx-runtime": { jsx, jsxs: jsx, Fragment: "fragment" },
  "lucide-react": { Check: () => null, Pencil: () => null },
  lucide: { Pause: () => null, Play: () => null }
});
const componentUrl = new URL("../src/features/client/workouts/WorkoutExerciseSets.jsx", import.meta.url).href;
const componentCode = (await transformWithOxc(readFileSync(fileURLToPath(componentUrl), "utf8"), fileURLToPath(componentUrl), { jsx: { runtime: "automatic" } })).code;
const cleanupTransform = registerHooks({
  resolve(specifier, context, next) {
    if (specifier.endsWith(".module.css")) return { url: "data:text/javascript,export default {}", shortCircuit: true };
    if (specifier.endsWith("/MorphingIcon")) return { url: "data:text/javascript,export default function MorphingIcon(){return null}", shortCircuit: true };
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url === componentUrl) {
      // Actual component source; React lifecycle/JSX rendering are the explicit
      // I/O boundary. No extracted function strings or copied timer algorithm.
      return { format: "module", source: componentCode, shortCircuit: true };
    }
    return next(url, context);
  }
});
after(() => { cleanupTransform.deregister(); cleanupImports(); });
const { default: WorkoutExerciseSets } = await import(componentUrl);
const originalNow = Date.now;
const originalWindow = globalThis.window;
const originalDocument = globalThis.document;
const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");
let now;
let intervals;

beforeEach(() => {
  now = 100000;
  intervals = new Map();
  runtime = { cursor: 0, slots: [], updates: [], effects: [] };
  Date.now = () => now;
  const events = { addEventListener() {}, removeEventListener() {} };
  let nextInterval = 1;
  globalThis.window = { ...events, setInterval(callback) { const id = nextInterval++; intervals.set(id, callback); return id; }, clearInterval(id) { intervals.delete(id); } };
  globalThis.document = events;
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: { vibrate() {} } });
});
afterEach(() => {
  runtime.slots.forEach(value => value?.cleanup?.());
  Date.now = originalNow;
  globalThis.window = originalWindow;
  globalThis.document = originalDocument;
  if (originalNavigator) Object.defineProperty(globalThis, "navigator", originalNavigator);
  else delete globalThis.navigator;
});

function findButton(tree, predicate) {
  if (Array.isArray(tree)) return tree.map(value => findButton(value, predicate)).find(Boolean);
  if (!tree || typeof tree !== "object") return null;
  if (tree.type === "button" && predicate(tree.props)) return tree;
  return findButton(tree.props?.children, predicate);
}
function harness() {
  const calls = [];
  let sets = Array.from({ length: 3 }, () => ({ durationSeconds: 30, completed: false }));
  let tree;
  function render({ flush = false, replaceCallback = false } = {}) {
    if (flush) runtime.updates.splice(0).forEach(apply => apply());
    runtime.cursor = 0;
    // Changing this callback models the real harness's parent rest-timer tick.
    if (replaceCallback || !render.callback) render.callback = (exerciseId, index) => calls.push({ exerciseId, index });
    tree = WorkoutExerciseSets({ exercise: { id: "plank", name: "Планка", sets }, hasExternalWeight: false, onToggleSetCompleted: render.callback });
    runtime.effects.splice(0).forEach(run => run());
  }
  render();
  const timer = () => findButton(tree, props => props["data-testid"] === "workout-timed-set-timer");
  const confirm = () => findButton(tree, props => /^(Выполнить подход 1|Подход 1 выполнен)$/.test(props["aria-label"] || ""));
  function start() { timer().props.onClick({ stopPropagation() {} }); render({ flush: true }); return [...intervals.values()].at(-1); }
  return { calls, render, start, timer, confirm, replaceSets: next => { sets = next; } };
}

test("one expired timer completes at most once across parent effect restarts before deferred state commits", () => {
  const h = harness();
  const oldTick = h.start();
  now += 31000;
  oldTick();
  assert.equal(h.calls.length, 1);
  // Parent commits a new callback while the child completion updates are still
  // pending. The actual timer effect reruns and immediately sees expiry again.
  h.render({ replaceCallback: true });
  assert.equal(h.calls.length, 1);
  oldTick(); // A browser callback already queued before effect cleanup.
  assert.equal(h.calls.length, 1);
  h.render({ flush: true });
  assert.equal(h.timer().props["data-running"], false);
});

test("manual confirmation at expiry cannot be toggled off by the old timer callback", () => {
  const h = harness();
  const oldTick = h.start();
  now += 30000;
  h.confirm().props.onClick({ stopPropagation() {} });
  oldTick();
  assert.deepEqual(h.calls, [{ exerciseId: "plank", index: 0 }]);
});

test("an old manual confirmation after expiry cannot duplicate completion but committed undo stays available", () => {
  const h = harness();
  const oldTick = h.start();
  now += 31000;
  oldTick();
  h.confirm().props.onClick({ stopPropagation() {} });
  assert.equal(h.calls.length, 1);
  h.render({ flush: true });
  h.replaceSets([{ durationSeconds: 30, completed: true }, { durationSeconds: 30, completed: false }, { durationSeconds: 30, completed: false }]);
  h.render();
  // The committed button is the real undo action and must remain available.
  assert.equal(h.confirm().props["aria-label"], "Подход 1 выполнен");
  h.confirm().props.onClick({ stopPropagation() {} });
  assert.equal(h.calls.length, 2);
});

test("an expired pause click cannot duplicate completion and a newly started timer can complete again", () => {
  const h = harness();
  const oldTick = h.start();
  now += 31000;
  oldTick();
  h.timer().props.onClick({ stopPropagation() {} }); // Expired pause handler from before child updates.
  assert.equal(h.calls.length, 1);
  h.render({ flush: true });
  // The set is undone by the parent; starting a new timer resets the completed
  // cycle guard without blocking the next legitimate completion.
  h.replaceSets(Array.from({ length: 3 }, () => ({ durationSeconds: 30, completed: false })));
  h.render();
  const newTick = h.start();
  now += 31000;
  newTick();
  h.render({ replaceCallback: true });
  assert.equal(h.calls.length, 2);
});
