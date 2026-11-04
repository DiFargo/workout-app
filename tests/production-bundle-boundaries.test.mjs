import assert from "node:assert/strict";
import test from "node:test";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { rolldown } from "rolldown";
import viteConfig from "../vite.config.js";
import { inspectBuildAssets } from "../scripts/check-build-budget.mjs";

function artifact() {
  return {
    assets: new Map([
      ["index-main.js", Buffer.from("entry")], ["index-main.css", Buffer.from("body{}")],
      ["react-runtime.js", Buffer.from("react")], ["firebase-core.js", Buffer.from("firebase core")],
      ["firebase-app-check-optional.js", Buffer.from("optional app check")],
      ["boot-style-module.js", Buffer.from("awaited style")], ["boot-style.css", Buffer.from(".trainer{}")]
    ]),
    manifest: {
      "src/main.jsx": { isEntry: true, file: "assets/index-main.js", imports: ["react"], dynamicImports: ["app", "boot-style", "app-check"], css: ["assets/index-main.css"] },
      react: { file: "assets/react-runtime.js" },
      app: { src: "src/App.jsx", file: "assets/firebase-core.js" },
      "boot-style": { src: "src/components/trainer/TrainerWorkspaceV2.module.css", file: "assets/boot-style-module.js", css: ["assets/boot-style.css"] },
      "app-check": { file: "assets/firebase-app-check-optional.js", imports: ["app"] }
    }
  };
}

test("artifact checks accept lazy App Check and exclude it from the static entry graph", () => {
  const { assets, manifest } = artifact();
  const report = inspectBuildAssets(assets, manifest);
  assert.ok(report.initialEntryGzipSize > 0);
  assert.ok(report.firebaseCoreGzipSize > 0);
  assert.ok(report.appCheckGzipSize > 0);
});

for (const name of ["ClientE2EHarness-abc.js", "TrainerFullE2EHarness-abc.css", "AdminE2EHarness-abc.js"]) {
  test(`artifact budget rejects leaked ${name}`, () => {
    const { assets, manifest } = artifact();
    assets.set(name, Buffer.from("fixture"));
    assert.throws(() => inspectBuildAssets(assets, manifest), /E2E harness leaked/);
  });
}

test("renaming a client fixture chunk does not bypass the artifact check", () => {
  const { assets, manifest } = artifact();
  assets.set("renamed-abc.js", Buffer.from('const workoutId="client_harness_day_1";'));
  assert.throws(() => inspectBuildAssets(assets, manifest), /E2E fixture data leaked/);
});

test("artifact checks reject an App Check dependency pulled into core or the main entry", () => {
  for (const parent of ["src/main.jsx", "app"]) {
    const { assets, manifest } = artifact();
    manifest[parent].imports = ["app-check"];
    assert.throws(() => inspectBuildAssets(assets, manifest), /(?:eagerly imported|statically imports)/);
  }
});

test("initial budget follows all transitive static dependencies instead of only named index/react files", () => {
  const { assets, manifest } = artifact();
  assets.set("large-static.js", randomBytes(105 * 1024));
  manifest.react.imports = ["large"];
  manifest.large = { file: "assets/large-static.js" };
  assert.throws(() => inspectBuildAssets(assets, manifest), /Initial entry gzip size/);
});

test("Firebase core has its own gzip budget", () => {
  const { assets, manifest } = artifact();
  assets.set("firebase-core.js", randomBytes(175 * 1024));
  assert.throws(() => inspectBuildAssets(assets, manifest), /Firebase core gzip size/);
});

test("production chunk routing keeps optional App Check and storage separate from auth/Firestore", () => {
  const config = viteConfig({ command: "build", mode: "production" });
  const chunkFor = config.build.rollupOptions.output.manualChunks;
  assert.equal(config.build.manifest, true);
  for (const root of ["firebase", "@firebase"]) {
    assert.equal(chunkFor(`/project/node_modules/${root}/app-check/dist/index.js`), "firebase-app-check");
    assert.equal(chunkFor(`/project/node_modules/${root}/storage/dist/index.js`), "firebase-storage");
    assert.equal(chunkFor(`/project/node_modules/${root}/auth/dist/index.js`), "firebase");
    assert.equal(chunkFor(`/project/node_modules/${root}/firestore/dist/index.js`), "firebase");
  }
});

for (const development of [false, true]) test(`actual AppBootstrap compile graph ${development ? "retains DEV harnesses" : "excludes deployable harnesses and fixtures"}`, async () => {
  const entry = fileURLToPath(new URL("../src/app/AppBootstrap.jsx", import.meta.url));
  const bundle = await rolldown({
    input: entry,
    transform: { jsx: { runtime: "automatic" } },
    external: id => id !== entry && !id.includes("E2EHarness"),
    plugins: [{
      name: "test-build-constant-and-fixture-boundaries",
      transform: (code, id) => id === entry ? code.replaceAll("import.meta.env.DEV", String(development)) : null,
      resolveId: id => id.includes("E2EHarness") ? `\0fixture:${id}` : null,
      load: id => id.startsWith("\0fixture:") ? 'export default function Fixture(){return "E2E_ONLY_FIXTURE";}' : null
    }]
  });
  try {
    const { output } = await bundle.generate({ format: "es" });
    const chunks = output.filter(item => item.type === "chunk");
    const code = chunks.map(chunk => chunk.code).join("\n");
    if (development) {
      assert.equal(chunks.length, 4);
      assert.match(code, /E2E_ONLY_FIXTURE/);
    } else {
      assert.equal(chunks.length, 1);
      assert.doesNotMatch(code, /E2E_ONLY_FIXTURE|E2EHarness/);
      assert.deepEqual(chunks[0].dynamicImports, []);
    }
  } finally { await bundle.close(); }
});
