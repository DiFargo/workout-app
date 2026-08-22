import test from "node:test";
import assert from "node:assert/strict";

import { APP_THEMES, DEFAULT_APP_THEME, normalizeAppTheme } from "../src/app/appTheme.js";

test("the app normalizes current and legacy theme preferences to warm light", () => {
  assert.equal(DEFAULT_APP_THEME, APP_THEMES.WARM_LIGHT);
  assert.equal(normalizeAppTheme(null), APP_THEMES.WARM_LIGHT);
  assert.equal(normalizeAppTheme("unknown"), APP_THEMES.WARM_LIGHT);
  assert.equal(normalizeAppTheme("dark-green"), APP_THEMES.WARM_LIGHT);
});
