import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Preserve the established 3.0.813 -> 300813 scheme. Ranges are explicit so
// minor/patch overflow cannot collide with the next release's numeric code.
export function deriveAndroidVersion(version) {
  const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(String(version));
  if (!match) throw new Error("Android release requires a numeric major.minor.patch package version.");
  const [major, minor, patch] = match.slice(1).map(Number);
  const versionCode = major * 100000 + minor * 1000 + patch;
  if (minor > 99 || patch > 999 || !Number.isSafeInteger(versionCode) || versionCode < 1 || versionCode > 2100000000) {
    throw new Error("Android version is outside the supported versionCode scheme (minor <=99, patch <=999, code <=2100000000).");
  }
  return { versionName: String(version), versionCode };
}

export function planAndroidVersion(source, packageVersion, { lastVersionCode } = {}) {
  const version = deriveAndroidVersion(packageVersion);
  const codePattern = /^(\s*versionCode\s+)(\d+)(\s*)$/gm;
  const namePattern = /^(\s*versionName\s+)["']([^"']+)["'](\s*)$/gm;
  const codes = [...source.matchAll(codePattern)];
  const names = [...source.matchAll(namePattern)];
  if (codes.length !== 1 || names.length !== 1) throw new Error("Expected exactly one literal versionCode and versionName in android/app/build.gradle.");
  const currentCode = Number(codes[0][2]);
  if (version.versionCode < currentCode) throw new Error("Refusing to decrease the current Android versionCode.");
  if (lastVersionCode !== undefined) {
    if (!Number.isSafeInteger(lastVersionCode) || lastVersionCode < 0) throw new Error("Invalid --last-version-code: use the verified nonnegative distributed code.");
    if (version.versionCode <= lastVersionCode) throw new Error("The next Android versionCode must exceed the last distributed build.");
  }
  const next = source
    .replace(codePattern, (_, prefix, _old, suffix) => `${prefix}${version.versionCode}${suffix}`)
    .replace(namePattern, (_, prefix, _old, suffix) => `${prefix}"${version.versionName}"${suffix}`);
  return { ...version, changed: next !== source, source: next };
}

export function prepareAndroidVersion({ root = fileURLToPath(new URL("..", import.meta.url)), write = false, lastVersionCode } = {}) {
  const packageVersion = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")).version;
  const gradlePath = path.join(root, "android", "app", "build.gradle");
  const plan = planAndroidVersion(fs.readFileSync(gradlePath, "utf8"), packageVersion, { lastVersionCode });
  if (plan.changed && !write) throw new Error(`Android metadata differs from package ${packageVersion}. Run node scripts/prepare-android-version.mjs --write as part of an authorized Android build.`);
  if (plan.changed) fs.writeFileSync(gradlePath, plan.source, "utf8");
  console.log(`Android metadata ${plan.versionName} (${plan.versionCode}) ${plan.changed ? "synchronized" : "verified"}. No APK/AAB was built or distributed.`);
  return plan;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.some(arg => arg !== "--write" && !/^--last-version-code=\d+$/.test(arg))) throw new Error("Use [--write] [--last-version-code=<verified distributed code>].");
  const baseline = args.find(arg => arg.startsWith("--last-version-code="));
  prepareAndroidVersion({ write: args.includes("--write"), lastVersionCode: baseline ? Number(baseline.split("=")[1]) : undefined });
}
