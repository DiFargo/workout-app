import test from "node:test";
import assert from "node:assert/strict";
import { isTrainerV2Path, isCssV2PreviewPath } from "../src/app/cssVariant.js";

test("trainer V2 is the default at normal, shared and preview URLs", () => {
  for (const path of ["/", "/v2", "/v2/", "/v2/client", "/invite/token", "/cssV2", "/client/v2"]) {
    assert.equal(isTrainerV2Path(path), true);
  }
  assert.equal(isCssV2PreviewPath("/cssV2"), true);
  assert.equal(isCssV2PreviewPath("/v2"), false);
});
