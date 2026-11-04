import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import { normalizeTrainerTelegramUsername } from "../src/features/trainer/trainerInviteMessage.js";

const source = readFileSync(new URL("../src/features/trainer/trainerCreateClientHandlers.js", import.meta.url), "utf8")
  .replace(/^import[^;]*;\s*/gm, "")
  .replace("export function createTrainerCreateClientHandlers", "function createTrainerCreateClientHandlers");
const apiResult = {
  client: { id: "synthetic-client", name: "Fixture client", role: "client" },
  login: "generated.login", telegramUsername: "fixture_client",
  botStartUrl: "https://t.me/example_bot?start=synthetic-invite",
  inviteUrl: "https://example.test/invite/synthetic", activationUrl: "https://example.test/activate/synthetic",
  shareUrl: "https://example.test/invite/synthetic-share"
};

function fixture({ response = apiResult, responseOk = true, requestError, canCreate = true, login = " Entered.Login ", name = " Fixture client " } = {}) {
  const state = { name, login, password: "", loading: false, status: "", credentials: null, users: [], allUsers: [], selected: "", client: null };
  const calls = { fetch: [], loading: [], prevented: 0 };
  const setter = key => update => { state[key] = typeof update === "function" ? update(state[key]) : update; };
  const createHandlers = vm.runInNewContext(`${source}\ncreateTrainerCreateClientHandlers`, {
    console: { error() {}, warn() {} }, normalizeTrainerTelegramUsername,
    fetchAuthorizedWithTimeout: async (url, options, timeout) => {
      calls.fetch.push({ url, options, timeout });
      if (requestError) throw requestError;
      return { ok: responseOk, json: async () => response };
    }
  });
  const handlers = createHandlers({
    currentUserRole: "trainer", adminNewUserName: name, adminNewUserEmail: login,
    canUseTrainerFeatures: () => canCreate, canUseAdminFeatures: () => false,
    setAdminNewUserName: setter("name"), setAdminNewUserEmail: setter("login"), setAdminNewUserPassword: setter("password"),
    setAdminCreateUserStatus: setter("status"), setAdminCreatedCredentials: setter("credentials"),
    setAdminCreateUserLoading: value => { state.loading = value; calls.loading.push(value); },
    setUsersList: setter("users"), setAdminAllUsersList: setter("allUsers"),
    setSelectedUserId: setter("selected"), setAdminSelectedClient: setter("client"), loadUsers: async () => []
  });
  return {
    state, calls,
    submit: (username = " @Fixture_Client ") => handlers.createUserFromAdminPanel({ preventDefault() { calls.prevented += 1; } }, username)
  };
}

test("real create-invite factory returns the same ready credentials object exposed to the UI", async () => {
  const f = fixture();
  const result = await f.submit();
  assert.equal(result, f.state.credentials);
  assert.equal(result.login, apiResult.login);
  assert.equal(result.telegramUsername, apiResult.telegramUsername);
  assert.equal(result.botStartUrl, apiResult.botStartUrl);
  assert.equal(result.shareUrl, apiResult.shareUrl);
  assert.equal(result.activationUrl, apiResult.activationUrl);
  assert.equal(result.existingAccount, false);
  assert.equal(f.state.name, "");
  assert.equal(f.state.login, "");
  assert.equal(f.state.loading, false);
  assert.doesNotMatch(f.state.status, /приглашение отправлено/i);
  assert.equal(f.calls.prevented, 1);
});

test("one submit makes exactly one normalized POST to the existing invitation endpoint", async () => {
  const f = fixture();
  await f.submit();
  assert.equal(f.calls.fetch.length, 1);
  const request = f.calls.fetch[0];
  assert.equal(request.url, "/api/trainer/create-invite");
  assert.equal(request.options.method, "POST");
  assert.equal(request.options.headers["Content-Type"], "application/json");
  assert.equal(request.timeout, 20_000);
  assert.deepEqual(JSON.parse(request.options.body), { login: "entered.login", name: "Fixture client", telegramUsername: "fixture_client" });
});

test("existing-account result never presents the entered login as that account's actual login", async () => {
  const f = fixture({ response: { ...apiResult, existingAccount: true, login: "" } });
  const result = await f.submit();
  assert.equal(result, f.state.credentials);
  assert.equal(result.existingAccount, true);
  assert.equal(result.login, "");
  assert.equal(result.telegramUsername, "fixture_client");
  assert.equal(result.botStartUrl, apiResult.botStartUrl);
  assert.doesNotMatch(f.state.status, /отправлено/i);
  assert.equal(f.calls.fetch.length, 1);
});

test("API rejection returns false, retains entered fields and does not invent a selected client", async () => {
  const f = fixture({ responseOk: false, response: { error: "auth/login-already-in-use" } });
  assert.equal(await f.submit(), false);
  assert.equal(f.state.name, " Fixture client ");
  assert.equal(f.state.login, " Entered.Login ");
  assert.equal(f.state.credentials, null);
  assert.equal(f.state.client, null);
  assert.equal(f.state.selected, "");
  assert.deepEqual(f.state.users, []);
  assert.equal(f.state.loading, false);
  assert.match(f.state.status, /логин.*занят/i);
  assert.equal(f.calls.fetch.length, 1, "an API rejection is not retried automatically");
});

test("an ambiguous request timeout returns false without retrying or clearing user input", async () => {
  const f = fixture({ requestError: Object.assign(new Error("Synthetic timeout"), { name: "AbortError" }) });
  assert.equal(await f.submit(), false);
  assert.equal(f.calls.fetch.length, 1);
  assert.equal(f.state.name, " Fixture client ");
  assert.equal(f.state.login, " Entered.Login ");
  assert.equal(f.state.loading, false);
  assert.equal(f.state.credentials, null);
  assert.ok(f.state.status);
});

test("denied access returns false without calling the creation API", async () => {
  const f = fixture({ canCreate: false });
  assert.equal(await f.submit(), false);
  assert.equal(f.calls.fetch.length, 0);
  assert.equal(f.state.name, " Fixture client ");
  assert.equal(f.state.login, " Entered.Login ");
});

for (const [name, options, username] of [
  ["invalid Telegram username", {}, "not a valid username"],
  ["missing login and Telegram username", { login: "" }, ""]
]) {
  test(`validation rejects ${name} with false before any API request`, async () => {
    const f = fixture(options);
    assert.equal(await f.submit(username), false);
    assert.equal(f.calls.fetch.length, 0);
    assert.equal(f.state.loading, false);
    assert.ok(f.state.status);
  });
}
