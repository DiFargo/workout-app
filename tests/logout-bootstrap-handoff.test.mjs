import assert from "node:assert/strict";
import { after, test } from "node:test";
import { installRuntimeImports } from "./helpers/runtime-imports.mjs";
import { advanceAuthSession } from "../src/utils/authSession.js";

let signOutIo;
const cleanup = installRuntimeImports({ "firebase/auth": { signOut: auth => signOutIo(auth) } });
after(cleanup);
const { performAppLogout } = await import("../src/app/appSessionNavigationHandlers.js");

function fixture(role) {
  const auth = { currentUser: { uid: "synthetic-A" } };
  const state = { setAppLoading: false, setIsLoggedIn: true, setUser: auth.currentUser, setCurrentUserRole: role };
  const notifications = [];
  const events = [];
  const deps = new Proxy({ auth, APP_PAGES: { MAIN: "main" }, defaultNutritionState: { meals: [] },
    createEmptyAiNutritionProfileDraft: () => ({}), createEmptyTelegramProfile: () => ({}),
    onLogoutError: message => notifications.push(message) }, {
    get(target, key) {
      if (typeof key === "string" && /^set[A-Z]/.test(key)) return value => { events.push([key, value]); state[key] = value; };
      return target[key];
    }
  });
  return { deps, auth, state, events, notifications };
}

for (const role of ["client", "trainer", "admin"]) test(`logout keeps the ${role} login handoff gated until Firebase sign-out resolves`, async () => {
  const f = fixture(role);
  let resolve;
  signOutIo = auth => { assert.equal(auth, f.auth); return new Promise(done => { resolve = done; }); };
  const pending = performAppLogout(f.deps);
  assert.deepEqual(f.events, [["setAppLoading", true]]);
  assert.equal(f.state.setIsLoggedIn, true);
  assert.equal(f.state.setUser.uid, "synthetic-A");
  f.auth.currentUser = null;
  resolve();
  assert.equal(await pending, true);
  assert.equal(f.state.setIsLoggedIn, false);
  assert.equal(f.state.setUser, null);
  assert.deepEqual(f.state.setPlan, { workouts: [] });
  assert.deepEqual(f.state.setHistory, []);
  assert.equal(f.state.setRestTimerRunning, false);
  assert.equal(f.state.setIsAdminClaim, false);
  // Only the existing onAuthStateChanged bootstrap may reveal the login page.
  assert.equal(f.state.setAppLoading, true);
  assert.equal(f.events.some(([key, value]) => key === "setAppLoading" && value === false), false);
});

test("a failed Firebase sign-out preserves the current account and releases the loading gate", async () => {
  const f = fixture("client");
  signOutIo = async () => { throw new Error("synthetic sign-out rejection"); };
  assert.equal(await performAppLogout(f.deps), false);
  assert.equal(f.state.setAppLoading, false);
  assert.equal(f.state.setIsLoggedIn, true);
  assert.equal(f.state.setUser.uid, "synthetic-A");
  assert.equal(f.auth.currentUser.uid, "synthetic-A");
  assert.match(f.state.setProfileAccountStatus, /Не удалось завершить выход/);
  assert.equal(f.events.some(([key]) => key === "setPlan" || key === "setHistory"), false);
  assert.deepEqual(f.notifications, ["Не удалось завершить выход. Аккаунт остаётся открыт. Попробуй выйти ещё раз."]);
});

for (const role of ["pending-client", "trainer", "admin"]) test(`preserved ${role} logout rejection reports a visible common error without clearing account data`, async () => {
  const f = fixture(role);
  signOutIo = async () => { throw new Error("synthetic sign-out rejection"); };
  assert.equal(await performAppLogout(f.deps), false);
  assert.equal(f.notifications.length, 1);
  assert.match(f.notifications[0], /Аккаунт остаётся открыт/);
  assert.equal(f.state.setCurrentUserRole, role);
  assert.equal(f.state.setUser.uid, "synthetic-A");
});

for (const reject of [false, true]) test(`an old logout does not reset a later account (rejected=${reject})`, async () => {
  const f = fixture("client");
  let complete;
  signOutIo = () => new Promise((resolve, fail) => { complete = reject ? fail : resolve; });
  const pending = performAppLogout(f.deps);
  f.auth.currentUser = { uid: "synthetic-B" };
  complete(reject ? new Error("old rejection") : undefined);
  assert.equal(await pending, false);
  assert.deepEqual(f.events, [["setAppLoading", true]]);
  assert.equal(f.auth.currentUser.uid, "synthetic-B");
  assert.deepEqual(f.notifications, []);
});

test("an old rejected logout cannot notify or release the gate of a later same-UID login even if the User object is reused", async () => {
  const f = fixture("admin"), originalUser = f.auth.currentUser;
  let reject;
  signOutIo = () => new Promise((_, fail) => { reject = fail; });
  const pending = performAppLogout(f.deps);
  f.auth.currentUser = null; advanceAuthSession(f.auth);
  f.auth.currentUser = originalUser; advanceAuthSession(f.auth);
  reject(new Error("old rejection"));
  assert.equal(await pending, false);
  assert.deepEqual(f.events, [["setAppLoading", true]]);
  assert.deepEqual(f.notifications, []);
});

test("already signed-out calls do not install a loading gate with no Auth transition to release it", async () => {
  const f = fixture("client");
  f.auth.currentUser = null;
  signOutIo = () => { throw new Error("Must not repeat sign-out"); };
  assert.equal(await performAppLogout(f.deps), true);
  assert.deepEqual(f.events, []);
});

test("a persistence rejection after Auth clears the user resets local data without waiting forever for bootstrap", async () => {
  const f = fixture("admin");
  signOutIo = async () => {
    f.auth.currentUser = null;
    throw new Error("synthetic persistence rejection before auth notification");
  };
  assert.equal(await performAppLogout(f.deps), true);
  assert.equal(f.state.setIsLoggedIn, false);
  assert.equal(f.state.setUser, null);
  assert.equal(f.state.setIsAdminClaim, false);
  assert.deepEqual(f.state.setPlan, { workouts: [] });
  assert.deepEqual(f.state.setHistory, []);
  assert.equal(f.state.setRestTimerRunning, false);
  assert.equal(f.state.setAppLoading, false);
  assert.match(f.state.setLoginError, /Не удалось полностью очистить сохранённый вход/);
  assert.deepEqual(f.events.at(-1), ["setAppLoading", false]);
  assert.deepEqual(f.notifications, [], "the null-user persistence fallback uses its existing login error, not a stale account toast");
});
