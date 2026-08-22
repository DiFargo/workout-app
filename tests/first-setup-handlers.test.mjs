import test from "node:test";
import assert from "node:assert/strict";

import {
  hasSavedWeightMeasurement,
  submitFirstSetupProfileWithDeps
} from "../src/features/auth/firstSetupHandlers.js";

test("recognizes saved weight check-ins without treating empty measurements as weight", () => {
  assert.equal(hasSavedWeightMeasurement([]), false);
  assert.equal(hasSavedWeightMeasurement([{ chest: 100 }]), false);
  assert.equal(hasSavedWeightMeasurement([{ weight: "67,7" }]), true);
});

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

test("first setup saves the entered weight as the initial check-in once", async () => {
  const savedMeasurements = [];
  const savedProfiles = [];

  await submitFirstSetupProfileWithDeps({
    APP_PAGES: { MAIN: "main" },
    user: { uid: "client-1" },
    aiNutritionProfileDraft: { name: "Test", weight: "67.7" },
    profileMeasurements: [],
    firstSetupDoneUserStorageKey: "first-setup",
    firstSetupRequiredVersion: "v2",
    hasRequiredAiNutritionProfileFields: () => true,
    saveAiNutritionPlan: async (...args) => { savedProfiles.push(args); return true; },
    saveProfileMeasurement: async (...args) => { savedMeasurements.push(args); return true; },
    showAppError: () => {},
    setFirstSetupCompletedInSession: () => {},
    setFirstSetupSaveStatus: () => {},
    setOnboardingStep: () => {},
    setPage: () => {},
    setProfileAccount: () => {},
    setProfileAccountDraft: () => {},
    setShowFirstSetupOnboarding: () => {}
  });

  assert.deepEqual(savedMeasurements, [[
    { weight: "67.7" },
    {
      measurementType: "weight_checkin",
      requireCloudSave: true,
      completeFirstSetupVersion: "v2"
    }
  ]]);
  assert.deepEqual(savedProfiles, [[
    { name: "Test", weight: "67.7" },
    { completeFirstSetup: false }
  ]]);
});

test("first setup remains open when the required first weight is not saved in cloud", async () => {
  let completedInSession = false;
  let onboardingVisible = true;
  let page = "setup";
  const saveStatuses = [];
  const errors = [];

  await submitFirstSetupProfileWithDeps({
    APP_PAGES: { MAIN: "main" },
    user: { uid: "client-1" },
    aiNutritionProfileDraft: { name: "Test", weight: "67.7" },
    profileMeasurements: [],
    firstSetupDoneUserStorageKey: "first-setup",
    firstSetupRequiredVersion: "v2",
    hasRequiredAiNutritionProfileFields: () => true,
    saveAiNutritionPlan: async (_profile, options) => {
      assert.deepEqual(options, { completeFirstSetup: false });
      return true;
    },
    saveProfileMeasurement: async () => false,
    showAppError: (...args) => { errors.push(args); },
    setFirstSetupCompletedInSession: (value) => { completedInSession = value; },
    setFirstSetupSaveStatus: (value) => { saveStatuses.push(value); },
    setOnboardingStep: () => {},
    setPage: (value) => { page = value; },
    setProfileAccount: () => {},
    setProfileAccountDraft: () => {},
    setShowFirstSetupOnboarding: (value) => { onboardingVisible = value; }
  });

  assert.equal(completedInSession, false);
  assert.equal(onboardingVisible, true);
  assert.equal(page, "setup");
  assert.equal(saveStatuses.at(-1), "error");
  assert.match(errors.at(-1)?.[1] || "", /первый замер/i);
});

test("first setup does not duplicate an existing weight check-in", async () => {
  let saveCalls = 0;

  await submitFirstSetupProfileWithDeps({
    APP_PAGES: { MAIN: "main" },
    user: { uid: "client-1" },
    aiNutritionProfileDraft: { name: "Test", weight: "67.7" },
    profileMeasurements: [{ id: "existing", weight: 67.7 }],
    firstSetupDoneUserStorageKey: "first-setup",
    firstSetupRequiredVersion: "v2",
    hasRequiredAiNutritionProfileFields: () => true,
    saveAiNutritionPlan: async () => true,
    saveProfileMeasurement: async () => { saveCalls += 1; return true; },
    showAppError: () => {},
    setFirstSetupCompletedInSession: () => {},
    setFirstSetupSaveStatus: () => {},
    setOnboardingStep: () => {},
    setPage: () => {},
    setProfileAccount: () => {},
    setProfileAccountDraft: () => {},
    setShowFirstSetupOnboarding: () => {}
  });

  assert.equal(saveCalls, 0);
});
