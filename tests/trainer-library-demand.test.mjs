import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { rolldown } from "rolldown";

// Execute the real route functions with only their child UI and hook transport
// stubbed. Repeated effects intentionally stress each route's request guard.
async function routeHarness(relativePath) {
  const entry = fileURLToPath(new URL(relativePath, import.meta.url));
  const bundle = await rolldown({ input: entry, platform: "node", external: id => id !== entry,
    transform: { jsx: { runtime: "automatic" } } });
  const generated = await bundle.generate({ format: "cjs", exports: "named" }); await bundle.close();
  const refs = []; let index = 0; const effects = [];
  const hooks = { useRef: initial => refs[index++] ||= { current: initial }, useEffect: effect => effects.push(effect) };
  const require = createRequire(import.meta.url), module = { exports: {} };
  new Function("require", "module", "exports", generated.output[0].code)(id => id === "react" ? hooks
    : id === "react/jsx-runtime" ? require(id)
      : { default: () => null, APP_PAGES: {}, BASIC_WORKOUT_PLANS: {}, BASIC_WORKOUT_EXERCISE_LIBRARY: [] }, module, module.exports);
  return async props => { index = 0; module.exports.default(props); effects.splice(0).forEach(effect => effect()); await new Promise(resolve => setImmediate(resolve)); };
}

test("admin library demands templates once per mounted user, including when callback arrives after mount", async () => {
  const render = await routeHarness("../src/app/AdminLibraryRoute.jsx"); let calls = 0;
  await render({ user: { uid: "admin" } });
  await render({ user: { uid: "admin" }, loadAdminTrainingTemplates: async () => { calls++; } });
  await render({ user: { uid: "admin" }, loadAdminTrainingTemplates: async () => { calls++; } });
  assert.equal(calls, 1);
  await render({ user: { uid: "other-admin" }, loadAdminTrainingTemplates: async () => { calls++; } });
  assert.equal(calls, 2);
});

test("legacy users list does not demand library; assignment/training screen does and rejection is handled", async () => {
  const render = await routeHarness("../src/features/trainer/TrainerUsersLegacyRoute.jsx"); let calls = 0;
  const props = { user: { uid: "trainer" }, APP_PAGES: {}, adminUsersSelectedTab: "training", selectedClient: { id: "client" },
    canUseAdminFeatures: () => false, renderTrainerWorkspaceBottomBar: () => null,
    loadAdminTrainingTemplates: async () => { calls++; } };
  await render(props); assert.equal(calls, 0);
  await render({ ...props, adminClientPageOpen: true }); assert.equal(calls, 1);
  await render({ ...props, adminClientPageOpen: true }); assert.equal(calls, 1);
  const originalWarn = console.warn; console.warn = () => {};
  try {
    await render({ ...props, user: { uid: "other-trainer" }, adminClientPageOpen: true,
      loadAdminTrainingTemplates: async () => { throw new Error("Denied"); } });
  } finally { console.warn = originalWarn; }
});
