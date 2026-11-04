import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { rolldown } from "rolldown";
import { transform } from "lightningcss";
import { captureAuthSession, advanceAuthSession } from "../src/utils/authSession.js";
import { EMPTY_TRAINER_LIBRARY_ITEMS, getCurrentTrainerLibraryLoadState, getTrainerLibraryViewState } from "../src/utils/trainerLibraryLoadState.js";

test("library knowledge belongs to the exact auth session, including a same-UID re-login", () => {
  const auth = { currentUser: { uid: "trainer" } };
  const record = { session: captureAuthSession(auth), templates: "ready", cards: "ready", templatesKnown: true, cardsKnown: true };
  assert.deepEqual(getCurrentTrainerLibraryLoadState(record), { templates: "ready", cards: "ready", templatesKnown: true, cardsKnown: true });
  advanceAuthSession(auth, auth.currentUser);
  const stale = getCurrentTrainerLibraryLoadState(record);
  assert.deepEqual(stale, { templates: "idle", cards: "idle", templatesKnown: false, cardsKnown: false });
  assert.equal(stale, getCurrentTrainerLibraryLoadState(null));
  assert.equal(Object.isFrozen(EMPTY_TRAINER_LIBRARY_ITEMS), true);
});

test("known snapshots survive a same-session refresh but idle never claims a known library", () => {
  const auth = { currentUser: { uid: "trainer" } };
  const session = captureAuthSession(auth);
  assert.deepEqual(getCurrentTrainerLibraryLoadState({ session, templates: "loading", cards: "error", templatesKnown: true, cardsKnown: true }),
    { templates: "loading", cards: "error", templatesKnown: true, cardsKnown: true });
  assert.deepEqual(getCurrentTrainerLibraryLoadState({ session, templates: "idle", cards: "invalid", templatesKnown: true, cardsKnown: true }),
    { templates: "idle", cards: "idle", templatesKnown: false, cardsKnown: false });
  auth.currentUser = { uid: "other" };
  assert.equal(getCurrentTrainerLibraryLoadState({ session, templates: "ready", cards: "ready" }).templatesKnown, false);
});

test("legacy undefined is ready; explicit idle and incomplete sources are not a confirmed empty", () => {
  assert.deepEqual(getTrainerLibraryViewState(undefined), { complete: true, loading: false, error: false });
  for (const state of [null, {}, { templates: "idle", cards: "idle" }, { templates: "loading", cards: "ready" }]) {
    assert.deepEqual(getTrainerLibraryViewState(state), { complete: false, loading: true, error: false });
  }
  assert.equal(getTrainerLibraryViewState({ templates: "ready", cards: "loading" }).complete, true);
  assert.equal(getTrainerLibraryViewState({ templates: "ready", cards: "loading" }, "exercises").loading, true);
  assert.equal(getTrainerLibraryViewState({ templates: "ready", cards: "ready" }, "exercises").complete, true);
});

test("an exercise library requires both sources; a partial failure is an error rather than empty or success", () => {
  for (const state of [{ templates: "error", cards: "ready" }, { templates: "ready", cards: "error" }, { templates: "loading", cards: "error" }]) {
    assert.deepEqual(getTrainerLibraryViewState(state, "exercises"), { complete: false, loading: false, error: true });
  }
  assert.equal(getTrainerLibraryViewState({ templates: "ready", cards: "error" }, "templates").complete, true);
});

const componentPath = fileURLToPath(new URL("../src/components/trainer/TrainerLibraryLoadNotice.jsx", import.meta.url));
const bundle = await rolldown({ input: componentPath, platform: "node", external: ["react", "react/jsx-runtime"],
  transform: { jsx: { runtime: "automatic" } }, plugins: [{ name: "library-load-notice-styles", load(id) {
    if (id.endsWith(".module.css")) return { code: "export default new Proxy({}, {get:(_,key)=>key});", moduleType: "js" };
  } }] });
const generated = await bundle.generate({ format: "cjs", exports: "named" });
await bundle.close();
const module = { exports: {} };
new Function("require", "module", "exports", generated.output[0].code)(createRequire(import.meta.url), module, module.exports);
const Notice = module.exports.default;

test("real notice distinguishes first load, refresh and failure without any empty-state assertion", () => {
  const pending = { templates: "loading", cards: "loading" };
  const html = props => renderToStaticMarkup(React.createElement(Notice, props));
  const first = html({ state: pending });
  assert.match(first, /Загружаем шаблоны…/);
  assert.match(first, /role="status"/);
  assert.match(first, /aria-busy="true"/);
  assert.doesNotMatch(first, /пока нет|Найдено: 0|Создайте первый/);
  assert.match(html({ state: pending, kind: "exercises", hasItems: true }), /Обновляем упражнения…/);
  const failed = html({ state: { templates: "ready", cards: "error" }, kind: "exercises", onRetry() {} });
  assert.match(failed, /Не удалось загрузить упражнения/);
  assert.match(failed, /role="alert"/);
  assert.match(failed, /aria-busy="false"/);
  assert.match(failed, /Повторить загрузку/);
  assert.equal(html({ state: { templates: "ready", cards: "ready" }, kind: "exercises" }), "");
  assert.equal(html({}), "");
});

test("retry invokes the supplied action without bubbling into template selection", () => {
  let calls = 0, stopped = false;
  const node = Notice({ state: { templates: "error" }, onRetry: () => calls++ });
  const retry = node.props.children.at(-1);
  retry.props.onClick({ stopPropagation() { stopped = true; } });
  assert.equal(calls, 1);
  assert.equal(stopped, true);
});

test("notice CSS parses and its retry action has a real touch target", async () => {
  const css = await readFile(new URL("../src/components/trainer/TrainerLibraryLoadNotice.module.css", import.meta.url));
  const result = transform({ filename: "TrainerLibraryLoadNotice.module.css", code: css, cssModules: true });
  assert.deepEqual(result.warnings, []);
  assert.match(css.toString(), /min-height: 44px/);
  assert.match(css.toString(), /prefers-reduced-motion/);
});
