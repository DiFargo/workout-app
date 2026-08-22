import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import test from "node:test";

const artifactGuardPath = fileURLToPath(new URL("../scripts/assert-firebase-deploy.mjs", import.meta.url));
const artifactBuildPath = fileURLToPath(new URL("../scripts/build-firebase-artifact.mjs", import.meta.url));
const vitePath = fileURLToPath(new URL("../node_modules/vite/bin/vite.js", import.meta.url));
const repositoryRoot = fileURLToPath(new URL("../", import.meta.url));
const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const firebaseConfig = JSON.parse(await readFile(new URL("../firebase.json", import.meta.url), "utf8"));
const firebaseRc = JSON.parse(await readFile(new URL("../.firebaserc", import.meta.url), "utf8"));
const verificationSource = await readFile(new URL("../scripts/verify.mjs", import.meta.url), "utf8");
const artifactBuildSource = await readFile(new URL("../scripts/build-firebase-artifact.mjs", import.meta.url), "utf8");
const viteConfigSource = await readFile(new URL("../vite.config.js", import.meta.url), "utf8");
const previewWorkflow = await readFile(
  new URL("../.github/workflows/firebase-hosting-pull-request.yml", import.meta.url),
  "utf8"
);

async function createArtifactFixture(t, artifact) {
  const directory = await mkdtemp(join(tmpdir(), "workout-firebase-artifact-"));
  await mkdir(join(directory, "dist"));
  await writeFile(join(directory, "dist", ".workout-release.json"), JSON.stringify(artifact), "utf8");
  t.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}

function runArtifactGuard(cwd, args, environment = {}) {
  return new Promise((resolve, reject) => {
    execFile(process.execPath, [artifactGuardPath, ...args], {
      cwd,
      env: { ...process.env, ...environment }
    }, (error, stdout, stderr) => {
      if (error) {
        error.stdout = stdout;
        error.stderr = stderr;
        reject(error);
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

function runArtifactBuild(cwd, args, environment = process.env) {
  return new Promise((resolve, reject) => {
    execFile(process.execPath, [artifactBuildPath, ...args], {
      cwd,
      env: environment
    }, (error, stdout, stderr) => {
      if (error) {
        error.stdout = stdout;
        error.stderr = stderr;
        reject(error);
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

function runViteBuild(environment) {
  return new Promise((resolve, reject) => {
    execFile(process.execPath, [vitePath, "build", "--mode", "staging"], {
      cwd: repositoryRoot,
      env: environment
    }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`${stdout}\n${stderr}`));
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

function createIsolatedStagingEnvironment(overrides = {}) {
  const environment = { ...process.env };
  for (const name of Object.keys(environment)) {
    if (name.startsWith("VITE_")) delete environment[name];
  }

  return {
    ...environment,
    VITE_FIREBASE_ENVIRONMENT: "staging",
    VITE_FIREBASE_API_KEY: "AIzaSyA12345678901234567890123456789012",
    VITE_FIREBASE_AUTH_DOMAIN: "workout-app-staging.invalid",
    VITE_FIREBASE_PROJECT_ID: "workout-app-staging",
    VITE_FIREBASE_STORAGE_BUCKET: "workout-app-staging.invalid",
    VITE_FIREBASE_MESSAGING_SENDER_ID: "000000000000",
    VITE_FIREBASE_APP_ID: "1:000000000000:web:staging",
    VITE_APP_CHECK_SITE_KEY: "",
    VITE_APP_CHECK_DEBUG_TOKEN: "",
    VITE_API_BASE_URL: "",
    ...overrides
  };
}

test("Firebase Hosting predeploy guard accepts a matching production artifact", async (t) => {
  const directory = await createArtifactFixture(t, {
    schemaVersion: 1,
    environment: "production",
    firebaseProjectId: "tren-85720",
    version: "test"
  });

  const result = await runArtifactGuard(directory, [
    "--environment=production",
    "--project",
    "tren-85720"
  ], { GCLOUD_PROJECT: "" });

  assert.match(result.stdout, /Verified production artifact for Firebase project tren-85720/);
});

test("Firebase Hosting predeploy guard refuses a cross-environment artifact", async (t) => {
  const directory = await createArtifactFixture(t, {
    schemaVersion: 1,
    environment: "staging",
    firebaseProjectId: "workout-staging",
    version: "test"
  });

  await assert.rejects(
    runArtifactGuard(directory, ["--project=tren-85720"], { GCLOUD_PROJECT: "" }),
    /Refusing to deploy a staging artifact to tren-85720/
  );
});

test("staging marker uses the same mode-local Firebase configuration as Vite", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "workout-firebase-build-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await writeFile(
    join(directory, "index.html"),
    "<script type=\"module\" src=\"/main.js\"></script>",
    "utf8"
  );
  await writeFile(join(directory, "main.js"), "console.log('fixture');\n", "utf8");
  await writeFile(
    join(directory, ".env.staging.local"),
    "VITE_FIREBASE_PROJECT_ID=fixture-staging\n",
    "utf8"
  );

  const buildEnvironment = { ...process.env };
  for (const name of Object.keys(buildEnvironment)) {
    if (name.startsWith("VITE_FIREBASE_")) delete buildEnvironment[name];
  }
  await runArtifactBuild(directory, ["--environment=staging"], buildEnvironment);

  const artifact = JSON.parse(await readFile(join(directory, "dist", ".workout-release.json"), "utf8"));
  assert.equal(artifact.environment, "staging");
  assert.equal(artifact.firebaseProjectId, "fixture-staging");
});

test("deployable staging builds reject an App Check debug token", async () => {
  await assert.rejects(
    runViteBuild(createIsolatedStagingEnvironment({
      VITE_APP_CHECK_DEBUG_TOKEN: "debug-token"
    })),
    /VITE_APP_CHECK_DEBUG_TOKEN must never be included in a deployable build/
  );
});

test("non-production API proxy rejects the production Firebase origin", async () => {
  await assert.rejects(
    runViteBuild(createIsolatedStagingEnvironment({
      VITE_API_BASE_URL: "https://tren-85720.web.app"
    })),
    /A non-production VITE_API_BASE_URL cannot target the production Firebase project/
  );
});

test("release configuration builds isolated artifacts and has no implicit Firebase target", () => {
  assert.equal(packageJson.scripts.build, "npm run build:production");
  assert.match(packageJson.scripts["build:staging"], /build-firebase-artifact\.mjs --environment=staging/);
  assert.match(packageJson.scripts["build:production"], /build-firebase-artifact\.mjs --environment=production/);
  assert.equal(firebaseConfig.hosting?.predeploy, "node scripts/assert-firebase-deploy.mjs");
  assert.equal(firebaseRc.projects?.default, undefined);
  assert.equal(firebaseRc.projects?.production, "tren-85720");
  assert.match(artifactBuildSource, /loadEnv\(environment, process\.cwd\(\), "VITE_FIREBASE_"\)/);
  assert.ok(
    verificationSource.indexOf("Isolated staging build") < verificationSource.indexOf("Production build"),
    "the final verification artifact must be production"
  );
  assert.match(previewWorkflow, /needs: quality/);
  assert.match(previewWorkflow, /FirebaseExtended\/action-hosting-deploy@7c850a480ce753f4f06f010801fc5a43787740bb/);
  assert.match(previewWorkflow, /VITE_FIREBASE_PROJECT_ID: \$\{\{ vars\.STAGING_FIREBASE_PROJECT_ID \}\}/);
  assert.match(viteConfigSource, /appCheckDebugToken && command === 'build'/);
  assert.match(viteConfigSource, /isProductionFirebaseHost\(parsedApiBaseUrl\.hostname\)/);
});
