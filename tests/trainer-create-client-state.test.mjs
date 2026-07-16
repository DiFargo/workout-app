import test from "node:test";
import assert from "node:assert/strict";

import { buildTrainerCreateClientState } from "../src/utils/trainerCreateClientState.js";

test("trainer create client state keeps entered values and callbacks", () => {
  const handlers = {
    onClose() {},
    onNameChange() {},
    onEmailChange() {},
    onPasswordChange() {},
    onGeneratePassword() {},
    onSubmit() {}
  };
  const credentials = { email: "client@example.com", password: "secret" };

  const state = buildTrainerCreateClientState({
    open: true,
    name: "Client",
    email: "client@example.com",
    password: "secret",
    loading: true,
    status: "created",
    credentials
  }, handlers);

  assert.equal(state.open, true);
  assert.equal(state.name, "Client");
  assert.equal(state.email, "client@example.com");
  assert.equal(state.password, "secret");
  assert.equal(state.loading, true);
  assert.equal(state.status, "created");
  assert.equal(state.credentials, credentials);
  assert.equal(state.onSubmit, handlers.onSubmit);
});

test("trainer create client state has stable empty defaults", () => {
  const state = buildTrainerCreateClientState();

  assert.equal(state.open, false);
  assert.equal(state.name, "");
  assert.equal(state.email, "");
  assert.equal(state.password, "");
  assert.equal(state.loading, false);
  assert.equal(state.status, null);
  assert.equal(state.credentials, null);
});
