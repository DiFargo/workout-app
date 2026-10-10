import test from "node:test";
import assert from "node:assert/strict";
import { hydrateRemoteTelegramProfile, resetAuthSessionOperations } from "../src/app/appBootstrapHelpers.js";

test("auth change clears blocked saves and confirmation sheets from the previous account", () => {
  const state = { isSaving: true, saved: true, historyLoading: true, deleting: "A-record", candidate: { uid: "A" }, files: { front: {} } };
  const ref = { current: { uid: "A" } };
  resetAuthSessionOperations({
    workoutSaveInFlightRef: ref,
    setIsSaving: value => { state.isSaving = value; },
    setIsWorkoutSaved: value => { state.saved = value; },
    setHistoryLoading: value => { state.historyLoading = value; },
    setHistoryDeletingId: value => { state.deleting = value; },
    setHistoryDeleteCandidate: value => { state.candidate = value; },
    setProfileProgressPhotoFiles: value => { state.files = value; }
  });
  assert.equal(ref.current, false);
  assert.deepEqual(state, { isSaving: false, saved: false, historyLoading: false, deleting: "", candidate: null, files: { front: null, side: null, back: null } });
});

function telegramHarness() {
  let current = true;
  let finish;
  const pending = new Promise(resolve => { finish = resolve; });
  const effects = [];
  const setters = [];
  const options = {
    user: { uid: "A" }, isCurrentRun: () => current, readProfile: () => pending,
    setTelegramProfile: update => setters.push(update), setTelegramDraft: update => setters.push(update),
    safeWriteUserJsonStorage: (...args) => effects.push(["cache", ...args]),
    refreshTelegramAvatar: () => effects.push(["avatar"]), TELEGRAM_PROFILE_STORAGE_KEY: "telegram"
  };
  return { options, effects, setters, switchAccount: () => { current = false; }, finish: () => finish({ exists: () => true, data: () => ({ telegram: { telegramUserId: "123", connected: true } }) }) };
}

test("late Telegram hydration never publishes the old account or starts an avatar refresh in a new session", async () => {
  const h = telegramHarness();
  const request = hydrateRemoteTelegramProfile(h.options);
  h.switchAccount(); h.finish(); await request;
  assert.deepEqual(h.effects, []);
  assert.deepEqual(h.setters, []);
});

test("a Telegram updater queued before auth changes preserves the new session state", async () => {
  const h = telegramHarness();
  const request = hydrateRemoteTelegramProfile(h.options);
  h.finish(); await request;
  assert.equal(h.effects[0][0], "cache");
  assert.equal(h.effects[0][2], "A");
  h.switchAccount();
  const next = { telegramUserId: "B" };
  h.setters.forEach(update => assert.equal(update(next), next));
});
