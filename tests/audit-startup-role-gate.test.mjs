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
const renderWithTelegramContext = (search, initData, overrides = {}) => {
  const previousWindow = globalThis.window;
  const hadWindow = Object.hasOwn(globalThis, "window");
  globalThis.window = { location: { search }, Telegram: { WebApp: { initData } } };
  try { return render("pending-client", { handleTelegramMiniAppAuth() {}, ...overrides }); }
  finally {
    if (hadWindow) globalThis.window = previousWindow;
    else delete globalThis.window;
  }
};

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

test("a waiting client sees the restricted access placeholder instead of onboarding", () => {
  const html = render("pending-client");
  assert.match(html, /Ждём назначения тренера/);
  assert.match(html, /Проверить доступ/);
  assert.match(html, /Тренировки/);
  assert.doesNotMatch(html, /Добро пожаловать!/);
});

test("уже вошедший Telegram-клиент может явно принять приглашение, не выходя из аккаунта", () => {
  let operations = 0;
  const html = renderWithTelegramContext("?telegramInvite=synthetic_invite_token_123456", "synthetic-init-data", {
    user: { uid: "own-pending-account" }, handleTelegramMiniAppAuth() { operations++; }, logout() { operations++; }
  });
  assert.match(html, /Принять приглашение тренера/);
  assert.match(html, /<button[^>]*>.*?Принять приглашение<\/button>/);
  assert.match(html, /Проверить доступ/);
  assert.match(html, /own-pending-account/);
  assert.match(html, /Скопировать идентификатор аккаунта/);
  assert.match(html, /Выйти/);
  assert.doesNotMatch(html, /Ждём назначения тренера|Добро пожаловать!|Разделы пока закрыты/);
  assert.equal(operations, 0, "render never accepts an invite or logs out automatically");
});

test("вход нижней кнопкой Telegram позволяет проверить приглашение без токена в URL", () => {
  const html = renderWithTelegramContext("", "synthetic-init-data");
  assert.match(html, /Ждём назначения тренера/);
  assert.match(html, /Проверить приглашение/);
  assert.match(html, /Проверить доступ/);
  assert.doesNotMatch(html, /start=invite_/);
});

test("вне Telegram приглашение сохраняется в ссылке бота, а подтверждение не имитируется", () => {
  const token = "synthetic_invite_token_123456";
  const html = renderWithTelegramContext(`?telegramInvite=${token}`, "");
  assert.match(html, new RegExp(`href="https://t.me/zmena_teleg_bot\\?start=invite_${token}"`));
  assert.match(html, /Открыть приглашение в Telegram/);
  assert.doesNotMatch(html, /<button[^>]*>.*?Принять приглашение<\/button>/);
  assert.match(html, /Проверить доступ/);
});

test("некорректный токен не попадает в Telegram-ссылку", () => {
  for (const token of ["short", "x".repeat(61), "invalid%3Cscript%3E"]) {
    const html = renderWithTelegramContext(`?telegramInvite=${token}`, "");
    assert.doesNotMatch(html, /start=invite_/);
    assert.match(html, /Ждём назначения тренера/);
  }
});

test("проверка приглашения показывает ошибку и блокирует повторные действия во время запроса", () => {
  const html = renderWithTelegramContext("?telegramInvite=synthetic_invite_token_123456", "synthetic-init-data", {
    loginSubmitting: true, loginError: "Срок приглашения истёк", loginNotice: "Попросите тренера прислать новое"
  });
  assert.match(html, /aria-busy="true"/);
  assert.match(html, /<button[^>]*disabled=""[^>]*>.*?Проверяем приглашение…<\/button>/);
  assert.match(html, /role="alert">Срок приглашения истёк/);
  assert.match(html, /role="status">Попросите тренера прислать новое/);
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
