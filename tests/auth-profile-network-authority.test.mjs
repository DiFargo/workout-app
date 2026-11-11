import assert from "node:assert/strict";
import { after, afterEach, beforeEach, test } from "node:test";
import { installRuntimeImports } from "./helpers/runtime-imports.mjs";
import { advanceAuthSession } from "../src/utils/authSession.js";

let effects = [];
let subscriptions = [];
let writes = [];
const firebaseAuth = { currentUser: null };
const cleanupImports = installRuntimeImports({
  react: {
    useEffect: (effect, dependencies) => effects.push({ effect, dependencies }),
    useEffectEvent: callback => callback
  },
  "/features/client/appearance/clientAppearance.js": { useClientAppearance() {} },
  "/firebase.js": { auth: firebaseAuth, db: {} },
  "firebase/firestore": {
    doc: (_, ...parts) => parts.join("/"),
    setDoc: async (path, data, options) => { writes.push({ path, data, options }); },
    onSnapshot: (path, options, callback) => {
      const subscription = { path, options, callback, unsubscribed: false };
      subscriptions.push(subscription);
      return () => { subscription.unsubscribed = true; };
    }
  }
});
after(cleanupImports);
const { useAppRuntimeEffects } = await import("../src/app/useAppRuntimeEffects.js");

const localStorageDescriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
const disposers = [];
beforeEach(() => {
  effects = [];
  subscriptions = [];
  writes = [];
  const values = new Map();
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key)
  } });
});
afterEach(() => {
  disposers.splice(0).forEach(dispose => dispose?.());
  if (localStorageDescriptor) Object.defineProperty(globalThis, "localStorage", localStorageDescriptor);
  else delete globalThis.localStorage;
});

function snapshot({ exists = true, fromCache = false, hasPendingWrites = false, data = {} } = {}) {
  return {
    exists: () => exists,
    data: () => exists ? { role: "client", active: true, appTheme: "warm-light", ...data } : undefined,
    metadata: { fromCache, hasPendingWrites }
  };
}

function harness() {
  const auth = { currentUser: { uid: "network-authority-client" } };
  advanceAuthSession(auth);
  const db = {};
  const state = { theme: "local-unconfirmed-theme", cloudReady: false };
  const themeUpdates = [];
  const readyUpdates = [];
  const setAppTheme = update => {
    themeUpdates.push(update);
    state.theme = typeof update === "function" ? update(state.theme) : update;
  };
  const setAppThemeCloudReady = value => { readyUpdates.push(value); state.cloudReady = value; };
  const setCurrentUserRole = () => assert.fail("theme authority must not change the role for this active client");

  function registerEffects() {
    effects = [];
    useAppRuntimeEffects({
      APP_PAGES: { ADMIN: "trainer" }, auth, user: auth.currentUser, db,
      appLoading: true, appTheme: state.theme, appThemeCloudReady: state.cloudReady,
      currentUserRole: "unresolved", isLoggedIn: true,
      setAppTheme, setAppThemeCloudReady, setCurrentUserRole
    });
    return effects;
  }

  // Run the production subscription and cloud-write effect. React scheduling,
  // appearance DOM work and Firebase I/O are boundaries, not copied logic.
  function commitCloudTheme() {
    const registered = registerEffects();
    const persistence = registered.find(({ dependencies }) => dependencies.length === 4 &&
      dependencies[0] === state.theme && dependencies[1] === state.cloudReady &&
      dependencies[2] === db && dependencies[3] === auth.currentUser?.uid);
    assert.ok(persistence, "the real theme persistence effect must be registered");
    persistence.effect();
  }
  const registered = registerEffects();
  const profile = registered.find(({ dependencies }) => dependencies.includes(setCurrentUserRole));
  assert.ok(profile, "the real profile subscription must be registered");
  const dispose = profile.effect();
  disposers.push(dispose);
  const subscription = subscriptions.at(-1);
  assert.ok(subscription);
  commitCloudTheme();
  return { auth, state, themeUpdates, readyUpdates, subscription, dispose, commitCloudTheme };
}

for (const [name, options] of [
  ["empty initial cache", { exists: false, fromCache: true }],
  ["existing cached profile", { fromCache: true, data: { appTheme: "cached-theme" } }],
  ["missing server document", { exists: false }],
  ["unconfirmed local write", { hasPendingWrites: true, data: { appTheme: "pending-theme" } }],
  ["cached pending local write", { fromCache: true, hasPendingWrites: true }]
]) {
  test(`${name} cannot enable theme cloud persistence before profile authority is confirmed`, () => {
    const h = harness();
    h.subscription.callback(snapshot(options));
    h.commitCloudTheme();
    assert.equal(h.state.cloudReady, false);
    assert.equal(h.state.theme, "local-unconfirmed-theme");
    assert.deepEqual(h.readyUpdates, []);
    assert.deepEqual(h.themeUpdates, []);
    assert.deepEqual(writes, [], "no partial users/{uid} document may be created by theme sync");
  });
}

test("a confirmed existing server profile enables theme sync only after cache and pending snapshots are ignored", () => {
  const h = harness();
  assert.deepEqual(h.subscription.options, { includeMetadataChanges: true });
  h.subscription.callback(snapshot({ exists: false, fromCache: true }));
  h.subscription.callback(snapshot({ fromCache: true, hasPendingWrites: true, data: { appTheme: "local-overlay" } }));
  h.commitCloudTheme();
  assert.deepEqual(writes, []);
  assert.equal(h.state.cloudReady, false);

  h.subscription.callback(snapshot());
  assert.equal(h.state.cloudReady, true);
  assert.equal(h.state.theme, "warm-light");
  h.commitCloudTheme();
  assert.equal(writes.length, 1);
  assert.equal(writes[0].path, "users/network-authority-client");
  assert.deepEqual(writes[0].options, { merge: true });
  assert.deepEqual(Object.keys(writes[0].data).sort(), ["appTheme", "appThemeUpdatedAt"]);
  assert.equal(writes[0].data.appTheme, "warm-light");
  assert.ok(Number.isFinite(Date.parse(writes[0].data.appThemeUpdatedAt)));
});

test("a late server snapshot after subscription cleanup cannot enable theme persistence", () => {
  const h = harness();
  h.dispose();
  assert.equal(h.subscription.unsubscribed, true);
  h.subscription.callback(snapshot());
  h.commitCloudTheme();
  assert.equal(h.state.cloudReady, false);
  assert.deepEqual(h.readyUpdates, []);
  assert.deepEqual(writes, []);
});

for (const sameUid of [false, true]) {
  test(`a server snapshot from a previous ${sameUid ? "same-UID login" : "account"} cannot enable the next session's theme persistence`, () => {
    const h = harness();
    h.auth.currentUser = { uid: sameUid ? "network-authority-client" : "another-client" };
    advanceAuthSession(h.auth);
    h.subscription.callback(snapshot());
    h.commitCloudTheme();
    assert.equal(h.state.cloudReady, false);
    assert.deepEqual(h.readyUpdates, []);
    assert.deepEqual(h.themeUpdates, []);
    assert.deepEqual(writes, []);
  });
}
