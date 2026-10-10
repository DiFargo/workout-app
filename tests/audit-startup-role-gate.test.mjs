import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { rolldown } from "rolldown";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { getRoleAccessGateState } from "../src/app/appStartupGateState.js";

// Render the actual gate and its real onboarding/auth children. CSS is the
// only replaced asset; bundling and rendering emit no application files.
const bundle = await rolldown({
  input: fileURLToPath(new URL("../src/app/appStartupGate.jsx", import.meta.url)),
  platform: "node", transform: { jsx: { runtime: "automatic" } },
  plugins: [{ name: "test-css-boundary", load: (id) => id.endsWith(".css") ? { code: "export default {};", moduleType: "js" } : null }],
  external: ["react", "react/jsx-runtime", "lucide-react"]
});
const generated = await bundle.generate({ format: "cjs", exports: "named" });
await bundle.close();
const module = { exports: {} };
new Function("require", "module", "exports", generated.output[0].code)(createRequire(import.meta.url), module, module.exports);
const { AppStartupGate } = module.exports;
const render = (role, overrides = {}) => renderToStaticMarkup(React.createElement(AppStartupGate, {
  appLoading: false, currentUserRole: role, roleAccessGateState: getRoleAccessGateState({ isLoggedIn: true, currentUserRole: role }),
  firstSetupStillResolving: false, showFirstSetupOnboarding: true, firstSetupRequiredNow: false, isLoggedIn: true,
  onboardingStep: 0, aiNutritionProfileDraft: {}, firstSetupSaveStatus: "", login: "", password: "", loginFieldErrors: {},
  setOnboardingStep() {}, setAiNutritionProfileDraft() {}, handleFirstSetupSubmit() {}, logout() {}, ...overrides
}));

test("an incomplete client still sees the real onboarding", () => {
  assert.match(render("client"), /Добро пожаловать!/);
});

test("the required-now client flag opens onboarding even when the previous show flag is false", () => {
  assert.match(render("client", { showFirstSetupOnboarding: false, firstSetupRequiredNow: true }), /Добро пожаловать!/);
});

for (const role of ["trainer", "admin"]) {
  test(`stale client flags cannot overlay a ${role} dashboard`, () => {
    assert.equal(render(role, { firstSetupRequiredNow: true }), "");
  });
}

test("an unresolved role still shows the verification gate before any stale client flag", () => {
  const html = render("unresolved");
  assert.match(html, /Не удалось подтвердить роль аккаунта/);
  assert.doesNotMatch(html, /Добро пожаловать!/);
});

test("a resolving role still shows the real splash", () => {
  const html = render("resolving");
  assert.match(html, /Загрузка приложения/);
  assert.doesNotMatch(html, /Добро пожаловать!/);
});

test("signed-out users still see login rather than a stale client onboarding", () => {
  const html = render("client", { isLoggedIn: false, roleAccessGateState: "" });
  assert.doesNotMatch(html, /Добро пожаловать!/);
  assert.match(html, /Войти/);
});

test("a completed client proceeds to the application", () => {
  assert.equal(render("client", { showFirstSetupOnboarding: false }), "");
});
