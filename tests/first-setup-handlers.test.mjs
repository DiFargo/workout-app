import test from "node:test";
import assert from "node:assert/strict";

import { submitFirstSetupProfileWithDeps } from "../src/features/auth/firstSetupHandlers.js";

test("first setup updates the account name before opening the client home screen", async () => {
  let account = { displayName: "test15", email: "test@example.com" };
  let accountDraft = { displayName: "test15", email: "test@example.com" };
  let page = "";

  await submitFirstSetupProfileWithDeps({
    APP_PAGES: { MAIN: "main" },
    user: { uid: "client-1" },
    aiNutritionProfileDraft: { name: "Илья" },
    firstSetupDoneUserStorageKey: "first-setup",
    firstSetupRequiredVersion: "v2",
    hasRequiredAiNutritionProfileFields: () => true,
    saveAiNutritionPlan: async () => true,
    showAppError: () => {},
    setFirstSetupCompletedInSession: () => {},
    setFirstSetupSaveStatus: () => {},
    setOnboardingStep: () => {},
    setPage: (nextPage) => { page = nextPage; },
    setProfileAccount: (updater) => { account = updater(account); },
    setProfileAccountDraft: (updater) => { accountDraft = updater(accountDraft); },
    setShowFirstSetupOnboarding: () => {}
  });

  assert.equal(account.displayName, "Илья");
  assert.equal(accountDraft.displayName, "Илья");
  assert.equal(page, "main");
});
