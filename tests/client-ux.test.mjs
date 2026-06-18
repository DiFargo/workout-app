import test from "node:test";
import assert from "node:assert/strict";

import {
  mapLoginAuthError,
  normalizeClientPrimaryPage,
  parsePositiveDecimal,
  validateLoginFields,
  validateNutritionAmount,
  validateNutritionFoodDraft
} from "../src/utils/clientUx.js";

test("login validation trims email and reports fields separately", () => {
  assert.deepEqual(validateLoginFields(" bad-email ", ""), {
    valid: false,
    email: "bad-email",
    password: "",
    errors: {
      email: "Проверь формат email.",
      password: "Укажи пароль."
    }
  });

  assert.equal(validateLoginFields("user@example.com", "secret").valid, true);
});

test("password reset validation accepts an email without a password", () => {
  assert.equal(
    validateLoginFields("user@example.com", "", { passwordRequired: false }).valid,
    true
  );
});

test("auth errors are mapped to actionable messages", () => {
  assert.match(mapLoginAuthError({ code: "auth/network-request-failed" }), /интернет/i);
  assert.match(mapLoginAuthError({ code: "auth/invalid-credential" }), /email или пароль/i);
});

test("nutrition amount never silently falls back to 100", () => {
  assert.equal(parsePositiveDecimal(""), null);
  assert.equal(parsePositiveDecimal("0"), null);
  assert.equal(parsePositiveDecimal("-4"), null);
  assert.equal(parsePositiveDecimal("12,5"), 12.5);
  assert.equal(validateNutritionAmount("").valid, false);
});

test("nutrition food draft requires valid macros and positive portion", () => {
  const invalid = validateNutritionFoodDraft({
    name: "",
    calories: "abc",
    protein: "-1",
    fat: "2",
    carbs: "3",
    portionAmount: "0"
  });

  assert.equal(invalid.valid, false);
  assert.deepEqual(Object.keys(invalid.errors).sort(), [
    "calories",
    "name",
    "portionAmount",
    "protein"
  ]);

  assert.equal(validateNutritionFoodDraft({
    name: "Творог",
    calories: "120",
    protein: "18",
    fat: "5",
    carbs: "3",
    portionAmount: "100"
  }).valid, true);
});

test("only primary client pages can be restored", () => {
  assert.equal(normalizeClientPrimaryPage("nutrition"), "nutrition");
  assert.equal(normalizeClientPrimaryPage("adminUsers"), "main");
});
