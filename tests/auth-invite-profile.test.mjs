import assert from "node:assert/strict";
import { after, beforeEach, test } from "node:test";
import { installRuntimeImports } from "./helpers/runtime-imports.mjs";

const user = { uid: "invited", email: "client@example.com", displayName: "Client" };
const auth = { currentUser: user };
const invite = { email: user.email, status: "active", authUid: user.uid, trainerId: "trainer",
  trainerEmail: "trainer@example.com", createdByUid: "trainer" };
let writes;
let requests;
const cleanup = installRuntimeImports({
  "firebase/auth": {
    GoogleAuthProvider: class {}, signInWithEmailAndPassword: async () => ({ user }),
    signInWithPopup: async () => ({ user }), signInWithCustomToken: async () => ({ user }),
    signOut: async () => {}, sendPasswordResetEmail: async () => {}
  },
  "firebase/firestore": {
    doc: (_, ...path) => path.join("/"),
    getDoc: async (path) => ({ exists: () => path.startsWith("clientInvites/"), data: () => path.startsWith("clientInvites/") ? invite : undefined }),
    setDoc: async (path, data) => writes.push({ path, data })
  },
  "/src/utils/apiClient.js": {
    fetchAuthorizedWithTimeout: async (url, options) => { requests.push({ url, body: JSON.parse(options.body) }); return { ok: true }; },
    fetchWithAppCheck: async (url, options) => { requests.push({ url, body: JSON.parse(options.body) }); return { ok: true, json: async () => ({ ok: true }) }; },
    getAppCheckApiHeaders: async (headers) => headers
  }
});
after(cleanup);
beforeEach(() => { writes = []; requests = []; });
const { createAuthHandlers } = await import("../src/features/auth/authHandlers.js");

for (const provider of ["password", "google"]) test(`invited ${provider} login creates only the profile contract and delegates alias to server`, async () => {
  const errors = [];
  const pages = [];
  const handlers = createAuthHandlers({
    APP_PAGES: { MAIN: "main" }, auth, db: {}, login: user.email, password: "test-password",
    setLoginFieldErrors() {}, setLoginError: (value) => { if (value) errors.push(value); },
    setLoginNotice() {}, setLoginSubmitting() {}, setPasswordResetSending() {},
    setPage: (value) => pages.push(value), setSelectedUserId() {}, loadHistory() {}, loadWorkoutsFromFirebase() {}
  });
  if (provider === "password") await handlers.handleLogin({ preventDefault() {} });
  else await handlers.handleGoogleAuth();
  assert.deepEqual(errors, []);
  assert.deepEqual(pages, ["main"]);
  const profile = writes.find((write) => write.path === `users/${user.uid}`)?.data;
  assert.ok(profile);
  assert.deepEqual(Object.keys(profile).sort(), ["email", "name", "role", "active", "createdAt", "updatedAt",
    "authProvider", "inviteActivatedAt", "createdBy", "createdByEmail", "createdByUid", "trainerId",
    "assignedTrainerId", "coachId", "trainerEmail", "assignedTrainerEmail", "coachEmail"].sort());
  assert.equal(profile.role, "client");
  assert.equal(profile.trainerId, "trainer");
  assert.equal(profile.loginLower, undefined);
  assert.equal(writes.find((write) => write.path.startsWith("clientInvites/"))?.data.status, "accepted");
  assert.deepEqual(requests, [{ url: "/api/profile/update-login", body: { login: "client" } }]);
});

test("Telegram Mini App login gives a clear next step when opened outside Telegram", async () => {
  const previousWindow = globalThis.window;
  const errors = [];
  globalThis.window = { Telegram: { WebApp: { initData: "" } } };
  try {
    const handlers = createAuthHandlers({
      APP_PAGES: { MAIN: "main" }, auth, db: {}, login: "", password: "",
      setLoginFieldErrors() {}, setLoginError: (value) => errors.push(value), setLoginNotice() {},
      setLoginSubmitting() {}, setPasswordResetSending() {}, setPage() {}, setSelectedUserId() {},
      loadHistory() {}, loadWorkoutsFromFirebase() {}
    });

    await handlers.handleTelegramMiniAppAuth();
    assert.deepEqual(errors, ["Открой приложение из меню бота в Telegram, чтобы войти этим способом."]);
    assert.deepEqual(requests, []);
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
});
