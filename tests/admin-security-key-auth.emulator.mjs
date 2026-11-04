import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(new URL("../functions/package.json", import.meta.url));
const admin = require("firebase-admin");
const host = process.env.FIREBASE_AUTH_EMULATOR_HOST;
const projectId = process.env.GCLOUD_PROJECT || "";
assert.match(host || "", /^(?:127\.0\.0\.1|localhost):\d+$/);
assert.match(projectId, /^demo-/);
const app = admin.initializeApp({ projectId }, "security-key-local-proof");
const auth = app.auth();
const uid = "admin-hardware-proof-local";
const email = "hardware-proof@example.invalid", password = "local-emulator-only-123";
async function exchange(path, body, form = false) {
  const response = await fetch(`http://${host}/${path}?key=emulator`, {
    method: "POST", headers: { "Content-Type": form ? "application/x-www-form-urlencoded" : "application/json" },
    body: form ? new URLSearchParams(body) : JSON.stringify(body)
  });
  const data = await response.json();
  assert.equal(response.ok, true, data.error?.message || "Auth emulator request failed");
  return data;
}
try {
  await auth.createUser({ uid, email, password });
  await auth.setCustomUserClaims(uid, { admin: true, adminClaimVersion: "grant-local" });
  const proof = { adminSecurityKeyVersion: "policy-local", adminSecurityKeyRoleVersion: "grant-local", adminSecurityKeyUntil: Date.now() + 3600000 };
  const customToken = await auth.createCustomToken(uid, proof);
  const signedIn = await exchange("identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken", { token: customToken, returnSecureToken: true });
  const first = await auth.verifyIdToken(signedIn.idToken);
  for (const [key, value] of Object.entries(proof)) assert.equal(first[key], value);
  assert.equal(first.admin, true);
  const refreshed = await exchange("securetoken.googleapis.com/v1/token", { grant_type: "refresh_token", refresh_token: signedIn.refreshToken }, true);
  const afterRefresh = await auth.verifyIdToken(refreshed.id_token);
  for (const [key, value] of Object.entries(proof)) assert.equal(afterRefresh[key], value);
  const plainLogin = await exchange("identitytoolkit.googleapis.com/v1/accounts:signInWithPassword", { email, password, returnSecureToken: true });
  const plain = await auth.verifyIdToken(plainLogin.idToken);
  assert.equal(plain.admin, true);
  for (const key of Object.keys(proof)) assert.equal(Object.hasOwn(plain, key), false);
  const saved = await auth.getUser(uid);
  for (const key of Object.keys(proof)) assert.equal(Object.hasOwn(saved.customClaims, key), false);
  console.log("PASS: proof остаётся в подтверждённой сессии после refresh; обычный вход и глобальные claims не получают proof.");
} finally {
  await auth.deleteUser(uid).catch(() => {});
  await app.delete();
}
