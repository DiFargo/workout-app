import test from "node:test";
import assert from "node:assert/strict";

import { isCssV2PreviewPath } from "../src/app/cssVariant.js";

test("CSS V2 preview is available only under the dedicated URL prefix", () => {
  assert.equal(isCssV2PreviewPath("/cssV2"), true);
  assert.equal(isCssV2PreviewPath("/cssV2/"), true);
  assert.equal(isCssV2PreviewPath("/cssV2/client"), true);
  assert.equal(isCssV2PreviewPath("/"), false);
  assert.equal(isCssV2PreviewPath("/invite/token"), false);
});
