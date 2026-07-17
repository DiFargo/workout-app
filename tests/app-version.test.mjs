import test from "node:test";
import assert from "node:assert/strict";
import { formatAppVersion } from "../src/constants/appConfig.js";

test("public app versions use a zero-padded build number", () => {
  assert.equal(formatAppVersion("3.0.1"), "v.3.0.001");
  assert.equal(formatAppVersion("3.0.42"), "v.3.0.042");
  assert.equal(formatAppVersion("3.1.0"), "v.3.1.000");
});

test("non-release versions retain a readable public label", () => {
  assert.equal(formatAppVersion("test"), "v.test");
});
