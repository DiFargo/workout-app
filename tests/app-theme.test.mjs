import test from "node:test";
import assert from "node:assert/strict";

import { APP_THEMES, DEFAULT_APP_THEME, normalizeAppTheme } from "../src/app/appTheme.js";

test("the app defaults to the warm light theme while preserving an explicit dark choice", () => {
  assert.equal(DEFAULT_APP_THEME, APP_THEMES.WARM_LIGHT);
  assert.equal(normalizeAppTheme(null), APP_THEMES.WARM_LIGHT);
  assert.equal(normalizeAppTheme("unknown"), APP_THEMES.WARM_LIGHT);
  assert.equal(normalizeAppTheme(APP_THEMES.DARK_GREEN), APP_THEMES.DARK_GREEN);
});
