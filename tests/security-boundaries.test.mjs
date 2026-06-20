import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const functionsSource = await readFile(new URL("../functions/index.js", import.meta.url), "utf8");
const appSource = await readFile(new URL("../src/App.jsx", import.meta.url), "utf8");
const apiClientSource = await readFile(new URL("../src/utils/apiClient.js", import.meta.url), "utf8");
const rulesSource = await readFile(new URL("../firestore.rules", import.meta.url), "utf8");
const firebaseConfig = JSON.parse(
  await readFile(new URL("../firebase.json", import.meta.url), "utf8")
);

function getExportBlock(name, nextName) {
  const start = functionsSource.indexOf(`export const ${name}`);
  const end = nextName
    ? functionsSource.indexOf(`export const ${nextName}`, start + 1)
    : functionsSource.length;

  assert.notEqual(start, -1, `${name} export must exist`);
  return functionsSource.slice(start, end === -1 ? functionsSource.length : end);
}

test("paid and privileged HTTP functions require Firebase authentication", () => {
  const protectedExports = [
    ["telegramSendMessage", "telegramTestWorkoutReminder"],
    ["telegramTestWorkoutReminder", "telegramDailyWorkoutReminders"],
    ["telegramSetWebhook", "telegramWebhook"],
    ["openFoodFactsSearch", "deleteUser"],
    ["deleteUser", "aiFoodPhoto"],
    ["aiFoodPhoto", null]
  ];

  protectedExports.forEach(([name, nextName]) => {
    assert.match(getExportBlock(name, nextName), /getAuthenticatedContext\(req\)/);
  });
  assert.match(
    functionsSource,
    /async function nutritionSearchHandler[\s\S]*?getAuthenticatedContext\(req\)/
  );
});

test("client API calls send Firebase ID tokens", () => {
  assert.match(apiClientSource, /export async function fetchAuthorized\(/);
  assert.match(apiClientSource, /export async function fetchAuthorizedWithTimeout\(/);
  assert.match(apiClientSource, /"Authorization": `Bearer \$\{await currentUser\.getIdToken\(\)\}`/);
  assert.doesNotMatch(appSource, /fetch\("\/api\/telegram\/send-message"/);
  assert.doesNotMatch(appSource, /fetch\("\/api\/ai-food-photo"/);
  assert.doesNotMatch(appSource, /fetch\("\/api\/admin\/deleteUser"/);
});

test("profile owners cannot change role and trainer assignment fields", () => {
  assert.match(rulesSource, /function protectedUserFields\(\)/);
  assert.match(rulesSource, /function isSafeOwnerCreate\(uid\)/);
  assert.match(rulesSource, /function isSafeOwnerUpdate\(uid\)/);
  assert.match(
    rulesSource,
    /allow update: if isAdmin\(\) \|\| isSafeOwnerUpdate\(uid\) \|\| isTrainerProgramAssignment\(\)/
  );
  assert.match(
    rulesSource,
    /"assignedWorkoutCount",\s*"workoutCalendar"/
  );
});

test("assigned trainer nutrition writes are limited to plan fields", () => {
  assert.match(rulesSource, /function isTrainerNutritionPlanUpdate\(\)/);
  assert.match(rulesSource, /function trainerNutritionStateFields\(\)/);
  assert.match(rulesSource, /function isTrainerNutritionStatePlanCreate\(uid, docId\)/);
  assert.match(rulesSource, /function isTrainerNutritionStatePlanUpdate\(uid, docId\)/);
  assert.match(
    rulesSource,
    /isTrainerClientScheduleUpdate\(\) \|\| isTrainerNutritionPlanUpdate\(\)/
  );
  assert.match(
    rulesSource,
    /request\.resource\.data\.diff\(resource\.data\)\.affectedKeys\(\)\.hasOnly\(trainerNutritionStateFields\(\)\)/
  );
});

test("every configured API rewrite points to an exported function", () => {
  const rewrites = firebaseConfig.hosting?.rewrites || [];
  const functionIds = rewrites
    .map((rewrite) => rewrite.function?.functionId)
    .filter(Boolean);

  functionIds.forEach((functionId) => {
    assert.match(functionsSource, new RegExp(`export const ${functionId}\\b`));
  });
});
