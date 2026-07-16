import test from "node:test";
import assert from "node:assert/strict";

import { CSS_VARIANT } from "../src/app/cssVariant.js";

test("CSS V2 is the only application style variant", () => {
  assert.equal(CSS_VARIANT, "v2");
});
