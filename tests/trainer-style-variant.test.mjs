import test from "node:test";
import assert from "node:assert/strict";
import { isTrainerV2Path, isCssV2PreviewPath } from "../src/app/cssVariant.js";

test("trainer v2 is opt-in by exact path segment", () => {
  for (const path of ["/v2", "/v2/", "/v2/client"]) assert.equal(isTrainerV2Path(path), true);
  for (const path of ["/", "/v20", "/v2-preview", "/cssV2", "/client/v2"]) assert.equal(isTrainerV2Path(path), false);
  assert.equal(isCssV2PreviewPath("/cssV2"), true);
  assert.equal(isCssV2PreviewPath("/v2"), false);
});
