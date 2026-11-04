import assert from "node:assert/strict";
import { test, after } from "node:test";
import { installRuntimeImports } from "./helpers/runtime-imports.mjs";
import { advanceAuthSession } from "../src/utils/authSession.js";

let effects = [], subscriptions = [];
const cleanup = installRuntimeImports({
  react: { useEffect: (effect, dependencies) => effects.push({ effect, dependencies }), useEffectEvent: callback => callback },
  "/firebase.js": { auth: { currentUser: null }, db: {} },
  "firebase/firestore": {
    doc: (_, ...parts) => parts.join("/"), setDoc: async () => assert.fail("unrelated persistence effect must not execute"),
    onSnapshot: (path, options, callback) => {
      const subscription = { path, options, callback, unsubscribed: false }; subscriptions.push(subscription);
      return () => { subscription.unsubscribed = true; };
    }
  }
});
after(cleanup);
const { useAppRuntimeEffects } = await import("../src/app/useAppRuntimeEffects.js");

function harness({ defer = false } = {}) {
  effects = []; subscriptions = [];
  const auth = { currentUser: { uid: "client-A" } }; advanceAuthSession(auth);
  const state = { role: "client", theme: "warm-light", themeReady: false, history: [{ id: "preserved-history" }], plan: { workouts: [{ id: "preserved-workout" }] }, nutrition: { preserved: true } };
  const queued = [], mediaCalls = [], setters = [];
  const setter = key => update => {
    setters.push(key); const apply = () => { state[key] = typeof update === "function" ? update(state[key]) : update; };
    if (defer) queued.push(apply); else apply();
  };
  const setCurrentUserRole = setter("role");
  useAppRuntimeEffects({ APP_PAGES: { ADMIN: "trainer" }, auth, user: auth.currentUser, db: {}, currentUserRole: "client", setCurrentUserRole,
    setAppTheme: setter("theme"), setAppThemeCloudReady: setter("themeReady"),
    onMemberAccessRevoked: () => mediaCalls.push("revoke"),
    setHistory: () => assert.fail("history must not be reset"), setPlan: () => assert.fail("plan must not be reset"),
    setNutrition: () => assert.fail("nutrition must not be reset"), setClientProgressPhotos: () => assert.fail("photo history must not be reset")
  });
  const effect = effects.find(item => item.dependencies.includes(setCurrentUserRole)); assert.ok(effect);
  const dispose = effect.effect(), subscription = subscriptions.at(-1); assert.ok(subscription);
  return { auth, state, mediaCalls, setters, subscription, dispose, flush: () => queued.splice(0).forEach(apply => apply()) };
}

function snapshot(data = {}, metadata = {}) {
  return { exists: () => true, data: () => ({ role: "client", accountAccessStatus: "awaiting_trainer", trainerAssignmentState: "unassigned", ...data }), metadata: { fromCache: false, hasPendingWrites: false, ...metadata } };
}

for (const removal of [
  { accountAccessStatus: "awaiting_trainer", trainerAssignmentState: "assigned" },
  { accountAccessStatus: "active", trainerAssignmentState: "unassigned" }
]) test(`server-confirmed ${removal.trainerAssignmentState} trainer removal downgrades client, revokes media and preserves history/data`, () => {
  const h = harness(), baseline = { history: h.state.history, plan: h.state.plan, nutrition: h.state.nutrition };
  assert.deepEqual(h.subscription.options, { includeMetadataChanges: true });
  h.subscription.callback(snapshot(removal));
  assert.equal(h.state.role, "pending-client"); assert.deepEqual(h.mediaCalls, ["revoke"]);
  assert.equal(h.state.history, baseline.history); assert.equal(h.state.plan, baseline.plan); assert.equal(h.state.nutrition, baseline.nutrition);
  assert.ok(h.setters.every(key => ["role", "theme", "themeReady"].includes(key)));
  h.dispose(); assert.equal(h.subscription.unsubscribed, true);
});

test("cached and local-pending profile snapshots cannot grant removal authority", () => {
  const h = harness();
  for (const metadata of [{ fromCache: true }, { hasPendingWrites: true }, { fromCache: true, hasPendingWrites: true }]) h.subscription.callback(snapshot({}, metadata));
  assert.equal(h.state.role, "client"); assert.deepEqual(h.mediaCalls, []);
  h.subscription.callback(snapshot({ accountAccessStatus: "active", trainerAssignmentState: "assigned" }));
  assert.equal(h.state.role, "client"); assert.deepEqual(h.mediaCalls, []);
  h.subscription.callback(snapshot()); assert.equal(h.state.role, "pending-client"); assert.equal(h.mediaCalls.length, 1);
  h.dispose();
});

for (const sameUid of [false, true]) test(`stale profile snapshots after ${sameUid ? "same-UID re-login" : "account switch"} cannot downgrade or revoke current media`, () => {
  const h = harness(), original = h.auth.currentUser;
  h.auth.currentUser = null; advanceAuthSession(h.auth);
  h.auth.currentUser = sameUid ? original : { uid: "client-B" }; advanceAuthSession(h.auth);
  const before = h.setters.length; h.subscription.callback(snapshot());
  assert.equal(h.state.role, "client"); assert.deepEqual(h.mediaCalls, []); assert.equal(h.setters.length, before); h.dispose();
});

test("cleanup and auth changes invalidate deferred role setters and late subscription callbacks", () => {
  const h = harness({ defer: true }); h.subscription.callback(snapshot()); assert.equal(h.mediaCalls.length, 1);
  h.auth.currentUser = { uid: "client-B" }; advanceAuthSession(h.auth); h.flush(); assert.equal(h.state.role, "client"); h.dispose();
  const after = h.mediaCalls.length; h.subscription.callback(snapshot()); assert.equal(h.mediaCalls.length, after);
  const disposed = harness({ defer: true }); disposed.subscription.callback(snapshot()); disposed.dispose(); disposed.flush(); assert.equal(disposed.state.role, "client");
});
