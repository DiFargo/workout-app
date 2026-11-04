import assert from "node:assert/strict";
import test from "node:test";
import { randomBytes } from "node:crypto";
import { gzipSync } from "node:zlib";
import { inspectBuildAssets, MANDATORY_BOOT_GZIP_LIMIT } from "../scripts/check-build-budget.mjs";
import { deriveAndroidVersion, planAndroidVersion } from "../scripts/prepare-android-version.mjs";

function artifact() {
  const assets = new Map([
    ["index-main.js", Buffer.from("entry")], ["index-main.css", Buffer.from("entry css")],
    ["react-runtime.js", Buffer.from("react")], ["firebase-core.js", Buffer.from("firebase")],
    ["firebase-app-check-optional.js", Buffer.from("optional")], ["opaque-runtime.js", Buffer.from("app")],
    ["opaque-style.js", Buffer.from("style module")], ["opaque-style.css", Buffer.from("style")],
    ["shared.js", Buffer.from("shared static")], ["app.css", Buffer.from("app css")]
  ]);
  const manifest = {
    "index.html": { isEntry: true, file: "assets/index-main.js", imports: ["react"], dynamicImports: ["opaque-app", "opaque-style", "app-check"], css: ["assets/index-main.css"] },
    react: { file: "assets/react-runtime.js" },
    firebase: { file: "assets/firebase-core.js" },
    "app-check": { file: "assets/firebase-app-check-optional.js", imports: ["firebase"] },
    "opaque-app": { src: "src/App.jsx", file: "assets/opaque-runtime.js", imports: ["react", "firebase", "shared"], css: ["assets/app.css", "assets/index-main.css"] },
    "opaque-style": { src: "src/components/trainer/TrainerWorkspaceV2.module.css", file: "assets/opaque-style.js", imports: ["shared"], css: ["assets/opaque-style.css", "assets/app.css"] },
    shared: { file: "assets/shared.js", imports: ["react"] }
  };
  return { assets, manifest };
}

test("mandatory startup counts the source-identified App static closure exactly once", () => {
  const { assets, manifest } = artifact();
  const report = inspectBuildAssets(assets, manifest);
  const expected = [...assets].filter(([name]) => !name.includes("app-check") && !name.startsWith("opaque-style")).reduce((sum, [, content]) => sum + gzipSync(content).byteLength, 0);
  assert.equal(report.mandatoryBootGzipSize, expected);
  assert.equal(report.mandatoryBootAssetCount, assets.size - 3);
  assert.equal(MANDATORY_BOOT_GZIP_LIMIT, 640 * 1024);
});

for (const asset of ["opaque-runtime.js", "shared.js", "app.css"]) {
  test(`mandatory startup rejects growth in renamed ${asset}`, () => {
    const { assets, manifest } = artifact();
    assets.set(asset, randomBytes(650 * 1024));
    assert.throws(() => inspectBuildAssets(assets, manifest), /Mandatory boot path gzip size/);
  });
}

test("trainer-only lazy styles do not block normal startup but eager styles are still counted", () => {
  const { assets, manifest } = artifact();
  const before = inspectBuildAssets(assets, manifest).mandatoryBootGzipSize;
  assets.set("opaque-style.css", randomBytes(650 * 1024));
  assert.equal(inspectBuildAssets(assets, manifest).mandatoryBootGzipSize, before);
  manifest["opaque-app"].imports.push("opaque-style");
  assert.throws(() => inspectBuildAssets(assets, manifest), /Mandatory boot path gzip size/);
});

test("unused lazy admin code and CSS do not inflate the normal startup subtotal", () => {
  const { assets, manifest } = artifact();
  const before = inspectBuildAssets(assets, manifest).mandatoryBootGzipSize;
  assets.set("admin-lazy.js", randomBytes(700 * 1024));
  assets.set("admin-lazy.css", randomBytes(700 * 1024));
  manifest["opaque-app"].dynamicImports = ["admin"];
  manifest.admin = { file: "assets/admin-lazy.js", css: ["assets/admin-lazy.css"] };
  assert.equal(inspectBuildAssets(assets, manifest).mandatoryBootGzipSize, before);
});

test("missing, ambiguous or disconnected mandatory source fails closed", () => {
  for (const change of [
    manifest => { delete manifest["opaque-app"].src; },
    manifest => { manifest.alias = { ...manifest["opaque-app"] }; },
    manifest => { manifest["index.html"].dynamicImports = ["opaque-style", "app-check"]; }
  ]) {
    const { assets, manifest } = artifact();
    change(manifest);
    assert.throws(() => inspectBuildAssets(assets, manifest), /mandatory boot source|Mandatory boot source/);
  }
});

const gradle = `android { defaultConfig {\n    versionCode 300813\n    versionName "3.0.813"\n} }\n`;
test("Android metadata derives from the approved package without guessing a distributed build", () => {
  assert.deepEqual(deriveAndroidVersion("3.0.850"), { versionName: "3.0.850", versionCode: 300850 });
  const plan = planAndroidVersion(gradle, "3.0.850");
  assert.equal(plan.changed, true);
  assert.match(plan.source, /versionCode 300850/);
  assert.match(plan.source, /versionName "3.0.850"/);
  assert.equal(planAndroidVersion(plan.source, "3.0.850").changed, false);
  assert.throws(() => planAndroidVersion(plan.source, "3.0.849"), /decrease/);
  assert.throws(() => planAndroidVersion(plan.source, "3.0.850", { lastVersionCode: 300850 }), /distributed/);
  assert.equal(planAndroidVersion(plan.source, "3.0.850", { lastVersionCode: 300849 }).versionCode, 300850);
});

test("Android guard rejects unsupported, ambiguous and overflowing version metadata", () => {
  for (const version of ["3.0.850-beta", "3.100.0", "3.0.1000", "30000.0.0", "03.0.850", "0.0.0"]) {
    assert.throws(() => deriveAndroidVersion(version));
  }
  assert.throws(() => planAndroidVersion(gradle + '\nversionCode 999\n', "3.0.850"), /exactly one/);
  assert.throws(() => planAndroidVersion(gradle, "3.0.850", { lastVersionCode: -1 }), /last-version-code/);
});
