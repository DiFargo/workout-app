import test from "node:test";
import assert from "node:assert/strict";
import {
  limitUserDisplayName,
  MAX_USER_DISPLAY_NAME_LENGTH
} from "../src/utils/userDisplayName.js";

test("user display name is trimmed and limited to the compact app length", () => {
  const name = limitUserDisplayName("  Александра-Екатерина Владимировна  ");

  assert.equal(name, "Александра-Екатерина");
  assert.equal(name.length, MAX_USER_DISPLAY_NAME_LENGTH);
});

test("display names start with an uppercase letter without changing the rest of the name", () => {
  assert.equal(limitUserDisplayName("  илья  "), "Илья");
  assert.equal(limitUserDisplayName("nargo"), "Nargo");
  assert.equal(limitUserDisplayName("анна-Мария"), "Анна-Мария");
  assert.equal(limitUserDisplayName("McDonald"), "McDonald");
  assert.equal(limitUserDisplayName(null), "");
});
