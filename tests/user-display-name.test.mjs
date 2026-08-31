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
