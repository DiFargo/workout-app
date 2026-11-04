// Opt-in, owned synthetic account only. Default invocation makes no network requests.
// No screenshots, traces, image downloads via the operator, tokens or identity output.
import { randomBytes } from "node:crypto";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import process from "node:process";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const PROJECTS = Object.freeze(["tren-85720-staging", "tren-85720"]);
const fail = code => { throw Object.assign(new Error(code), { smokeCode: code }); };
const safeUid = uid => typeof uid === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(uid);
const CACHE = "private,no-store,max-age=0";
const MAX_JSON = 4 * 1024 * 1024;
// A 1x1 opaque PNG used only as an upload fixture, never a product image asset.
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=", "base64");

export function makePrivatePhotoUploadFixture() {
  return { name: "synthetic-photo.png", mimeType: "image/png", buffer: Buffer.from(PNG) };
}

export function recordPrivatePhotoDiagnostic(diagnostics, event) {
  const methods = ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"];
  if (event.kind === "console") {
    const text = String(event.text || "");
    if (/CORS policy|blocked by CORS|cross-origin request blocked/i.test(text)) diagnostics.corsConsoleObserved = true;
    for (const code of new Set(text.match(/storage\/(?:unauthorized|unauthenticated|canceled|unknown|invalid-checksum|retry-limit-exceeded|quota-exceeded|object-not-found|bucket-not-found|project-not-found|invalid-argument|unsupported-environment)/g) || [])) {
      diagnostics.storageErrorCodes[code] = (diagnostics.storageErrorCodes[code] || 0) + 1;
    }
  } else if (methods.includes(event.method) && event.kind === "response" && Number.isInteger(event.status) && event.status >= 100 && event.status <= 599) {
    const key = `${event.method}:${event.status}`;
    const value = diagnostics.storageResponses[key] ||= { count: 0, corsHeaderAllowsOrigin: false, corsWildcard: false };
    value.count++;
    value.corsHeaderAllowsOrigin ||= event.corsHeaderAllowsOrigin === true;
    value.corsWildcard ||= event.corsWildcard === true;
  } else if (methods.includes(event.method) && event.kind === "request-failed") {
    diagnostics.storageRequestFailures[event.method] = (diagnostics.storageRequestFailures[event.method] || 0) + 1;
  }
}

export function parsePrivatePhotoSmokeArgs(args = [], env = process.env) {
  const options = { project: "tren-85720-staging", run: false };
  const seen = new Set();
  for (const arg of args) {
    const match = /^--(project|confirm-project|expected-version)=(.+)$/.exec(arg);
    const key = match ? match[1] : arg;
    if (seen.has(key)) fail("duplicate-argument");
    seen.add(key);
    if (match) options[{ project: "project", "confirm-project": "confirmProject", "expected-version": "version" }[key]] = match[2];
    else if (arg === "--run") options.run = true;
    else fail("unknown-argument");
  }
  if (!PROJECTS.includes(options.project)) fail("project-not-allowlisted");
  if (options.confirmProject && options.confirmProject !== options.project) fail("project-confirmation-mismatch");
  if (options.run && !seen.has("project")) fail("explicit-project-required");
  if (options.run && options.project === "tren-85720" && options.confirmProject !== options.project) fail("production-confirmation-required");
  if (!options.run && options.confirmProject) fail("confirmation-without-run");
  if (options.version && !/^\d+\.\d+\.\d+$/.test(options.version)) fail("invalid-version");
  for (const key of ["FIREBASE_TOKEN", "GOOGLE_APPLICATION_CREDENTIALS", "FIRESTORE_EMULATOR_HOST", "FIREBASE_AUTH_EMULATOR_HOST", "FIREBASE_STORAGE_EMULATOR_HOST"])
    if (env[key]) fail("cached-operator-live-project-only");
  return options;
}

export function ownedPhotoPrefix(uid) {
  if (!safeUid(uid)) fail("invalid-owned-uid");
  return `progress-photos/${uid}/`;
}

export function assertOwnedPhotoObject(item, uid) {
  const prefix = ownedPhotoPrefix(uid);
  if (typeof item?.name !== "string" || !item.name.startsWith(prefix)
    || item.name.slice(prefix.length).split("/").some(part => !part || part === "." || part === "..")
    || !/^[1-9]\d*$/.test(String(item.generation || "")) || !/^[1-9]\d*$/.test(String(item.metageneration || ""))) fail("unowned-or-unversioned-object");
}

export function verifyPrivatePhotoRecord(document, bucket, uid) {
  const values = ["front", "side", "back"].map(view => document?.fields?.[`${view}Url`]?.stringValue);
  const prefix = `gs://${bucket}/${ownedPhotoPrefix(uid)}`;
  const paths = values.map((value, index) => {
    if (typeof value !== "string" || !value.startsWith(prefix)) fail("persisted-reference-not-private");
    const suffix = value.slice(prefix.length);
    if (!new RegExp(`^[A-Za-z0-9_-]{1,160}/${["front", "side", "back"][index]}\\.webp$`).test(suffix)) fail("persisted-reference-out-of-scope");
    return value.slice(`gs://${bucket}/`.length);
  });
  if (new Set(paths.map(path => path.split("/")[2])).size !== 1) fail("mixed-photo-sessions");
  return paths;
}

const encode = value => value === null ? { nullValue: null } : typeof value === "boolean" ? { booleanValue: value }
  : typeof value === "object" ? { mapValue: { fields: fields(value) } } : { stringValue: String(value) };
const fields = value => Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, encode(entry)]));

async function operatorToken(project) {
  try {
    const require = createRequire(import.meta.url);
    const cli = resolve(ROOT, ".npm-cache/_npx/7084310e8c2c604f/node_modules/firebase-tools/lib");
    require(resolve(cli, "logger.js")).logger.silent = true;
    const account = require(resolve(cli, "auth.js")).getGlobalDefaultAccount();
    if (!account) fail("operator-unavailable");
    await require(resolve(cli, "requireAuth.js")).requireAuth({ ...account, project }, true);
    const token = await require(resolve(cli, "apiv2.js")).getAccessToken();
    if (!token || typeof token !== "string") fail("operator-unavailable");
    return token;
  } catch { fail("operator-unavailable"); }
}

async function boundedJson(response) {
  if (Number(response.headers.get("content-length")) > MAX_JSON) { await response.body?.cancel(); fail("response-size-limit"); }
  const reader = response.body?.getReader(); if (!reader) fail("empty-response");
  const chunks = []; let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      length += value.byteLength;
      if (length > MAX_JSON) { await reader.cancel(); fail("response-size-limit"); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

export async function runPrivatePhotoSmoke(input) {
  // Revalidate direct callers, not just CLI invocation, before loading credentials.
  if (input?.run !== undefined && typeof input.run !== "boolean") fail("invalid-run-option");
  const options = parsePrivatePhotoSmokeArgs([
    ...(input?.run ? ["--run"] : []), `--project=${input?.project || "tren-85720-staging"}`,
    ...(input?.confirmProject ? [`--confirm-project=${input.confirmProject}`] : []),
    ...(input?.version ? [`--expected-version=${input.version}`] : [])
  ]);
  if (!options.run) return { project: options.project, readOnly: true, status: "not-run", networkRequests: 0 };
  const project = options.project, base = `https://${project}.web.app`;
  const version = options.version || JSON.parse(await readFile(resolve(ROOT, "package.json"), "utf8")).version;
  const runId = randomBytes(12).toString("hex");
  const identity = { email: `private-photo-smoke-${runId}@example.invalid`, password: randomBytes(32).toString("base64url"),
    marker: `private-photo-smoke:${runId}`, creationAttempted: false };
  const documents = `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents`;
  const databasePrefix = `projects/${project}/databases/(default)/documents/`;
  const report = { project, version, readOnly: false, status: "pending", cases: {}, cleanup: {}, requestCount: 0,
    diagnostics: { storageResponses: {}, storageRequestFailures: {}, storageErrorCodes: {}, corsConsoleObserved: false, selectedViews: 0 } };
  let token, apiKey, bucket, browser, page, cleanupMode = false, currentStep = "preflight", cleanupDocuments = 0;
  const deadline = Date.now() + 8 * 60 * 1000;
  async function request(url, { method = "GET", body, bearer, missing = false, statuses = [] } = {}) {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" || ![`${project}.web.app`, "identitytoolkit.googleapis.com", "firestore.googleapis.com", "firebasestorage.googleapis.com", "storage.googleapis.com"].includes(parsed.hostname)) fail("unsafe-request-origin");
    if (++report.requestCount > (cleanupMode ? 900 : 400) || (!cleanupMode && Date.now() > deadline)) fail("request-budget");
    const response = await fetch(parsed, { method, redirect: "error", cache: "no-store", signal: AbortSignal.timeout(20000),
      headers: { ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}), ...(body ? { "Content-Type": "application/json" } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}) });
    if ((missing && response.status === 404) || statuses.includes(response.status) || method === "DELETE" && response.ok) {
      await response.body?.cancel(); return { status: response.status, data: null };
    }
    if (!response.ok) { await response.body?.cancel(); fail(`http-${response.status}`); }
    return { status: response.status, data: await boundedJson(response) };
  }
  const admin = (method, body) => request(`https://identitytoolkit.googleapis.com/v1/projects/${project}/accounts:${method}`, { method: "POST", bearer: token, body });
  const docUrl = path => `${documents}/${path.split("/").map(encodeURIComponent).join("/")}`;
  const getDoc = path => request(docUrl(path), { bearer: token, missing: true }).then(result => result.data);
  async function lookup() {
    const { data } = await admin("lookup", { email: [identity.email] });
    if ((data.users || []).length > 1) fail("ambiguous-owned-account");
    const user = data.users?.[0]; if (!user) return null;
    if (user.email !== identity.email || !safeUid(user.localId) || identity.uid && identity.uid !== user.localId) fail("owned-account-mismatch");
    return user;
  }
  async function listObjects() {
    const items = []; let pageToken;
    for (let pageNumber = 0; pageNumber < 10; pageNumber++) {
      const url = new URL(`https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(bucket)}/o`);
      for (const [key, value] of Object.entries({ prefix: ownedPhotoPrefix(identity.uid), versions: "true", maxResults: "100", fields: "items(name,generation,metageneration,metadata,cacheControl),nextPageToken", ...(pageToken ? { pageToken } : {}) })) url.searchParams.set(key, value);
      const { data } = await request(url, { bearer: token });
      for (const item of data.items || []) { assertOwnedPhotoObject(item, identity.uid); items.push(item); }
      pageToken = data.nextPageToken;
      if (!pageToken) return items;
    }
    fail("owned-object-page-limit");
  }
  async function deleteDocument(document) {
    if (!document.name?.startsWith(databasePrefix)) fail("foreign-document");
    const url = new URL(docUrl(document.name.slice(databasePrefix.length)));
    if (document.updateTime) url.searchParams.set("currentDocument.updateTime", document.updateTime);
    await request(url, { method: "DELETE", bearer: token, missing: true });
    cleanupDocuments++;
  }
  async function removeTree(path, depth = 0) {
    const root = `users/${identity.uid}`;
    if (!(path === root || path.startsWith(root + "/")) || depth > 12 || cleanupDocuments > 500) fail("owned-tree-limit");
    const { data } = await request(`${docUrl(path)}:listCollectionIds`, { method: "POST", bearer: token, body: { pageSize: 100 } });
    if (data.nextPageToken) fail("owned-collection-limit");
    for (const collection of data.collectionIds || []) {
      if (!/^[A-Za-z0-9_-]+$/.test(collection)) fail("unsafe-collection");
      let pageToken;
      do {
        const url = new URL(docUrl(`${path}/${collection}`)); url.searchParams.set("pageSize", "100"); url.searchParams.set("showMissing", "true");
        url.searchParams.set("mask.fieldPaths", "_smokeProjectionOnly"); if (pageToken) url.searchParams.set("pageToken", pageToken);
        const { data: children } = await request(url, { bearer: token });
        for (const child of children.documents || []) {
          if (!child.name?.startsWith(databasePrefix)) fail("foreign-child");
          await removeTree(child.name.slice(databasePrefix.length), depth + 1);
        }
        pageToken = children.nextPageToken;
      } while (pageToken);
    }
    const existing = await getDoc(path); if (existing) await deleteDocument(existing);
  }
  async function assertCloudThumbnails(expect) {
    await expect(page.getByTestId("profile-progress-photos-latest")).toBeVisible();
    const images = page.getByTestId("profile-progress-photos-latest").locator("img[data-private-photo-state]");
    await expect(images).toHaveCount(3);
    await expect.poll(() => images.evaluateAll(nodes => nodes.every(image => image.dataset.privatePhotoState === "ready"
      && image.currentSrc.startsWith("blob:") && image.complete && image.naturalWidth > 0)), { timeout: 60000 }).toBe(true);
  }
  try {
    token = await operatorToken(project);
    const { data: config } = await request(`${base}/__/firebase/init.json`);
    if (config.projectId !== project || typeof config.apiKey !== "string" || !config.apiKey) fail("hosting-project-mismatch");
    apiKey = config.apiKey;
    const { data: defaultBucket } = await request(`https://firebasestorage.googleapis.com/v1alpha/projects/${project}/defaultBucket`, { bearer: token });
    bucket = defaultBucket.bucket?.name?.split("/").at(-1);
    if (![`${project}.firebasestorage.app`, `${project}.appspot.com`].includes(bucket) || config.storageBucket !== bucket) fail("default-bucket-mismatch");
    if (await lookup()) fail("synthetic-email-already-exists");
    currentStep = "synthetic-account";
    identity.creationAttempted = true;
    const { data: created } = await request(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${encodeURIComponent(apiKey)}`, {
      method: "POST", body: { email: identity.email, password: identity.password, returnSecureToken: true }
    });
    if (!safeUid(created.localId)) fail("invalid-created-uid");
    identity.uid = created.localId;
    if ((await lookup())?.localId !== identity.uid) fail("created-identity-not-verified");
    const trainerId = `photo-smoke-trainer-${runId}`;
    await request(`${docUrl(`users/${identity.uid}`)}?currentDocument.exists=false`, { method: "PATCH", bearer: token, body: { fields: fields({
      role: "client", active: true, name: "Synthetic private photo smoke", email: identity.email, firstSetupCompleted: true,
      accountAccessStatus: "active", trainerAssignmentState: "assigned", trainerId, assignedTrainerId: trainerId,
      createdByUid: identity.marker, smokeMarker: identity.marker,
      aiNutritionProfile: { weight: "72", height: "174", age: "30", sex: "male", activity: "medium", goal: "recomp" },
      workoutModePreference: { mode: "individual", remember: true, updatedAt: new Date().toISOString() }
    }) } });
    report.cases.syntheticAccount = true;
    currentStep = "deployed-ui-login";
    const { chromium, expect: baseExpect } = await import("@playwright/test");
    const expect = baseExpect.configure({ timeout: 45000 });
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 402, height: 874 }, serviceWorkers: "block" });
    context.setDefaultTimeout(45000); context.setDefaultNavigationTimeout(45000);
    page = await context.newPage(); const runtimeErrors = [];
    page.on("pageerror", () => runtimeErrors.push(true));
    const isStorageRequest = url => {
      try { return ["firebasestorage.googleapis.com", "storage.googleapis.com"].includes(new URL(url).hostname); } catch { return false; }
    };
    page.on("console", message => recordPrivatePhotoDiagnostic(report.diagnostics, { kind: "console", text: message.text() }));
    page.on("requestfailed", failed => {
      if (isStorageRequest(failed.url())) recordPrivatePhotoDiagnostic(report.diagnostics, { kind: "request-failed", method: failed.method() });
    });
    page.on("response", async response => {
      if (!isStorageRequest(response.url())) return;
      try {
        const headers = await response.allHeaders();
        recordPrivatePhotoDiagnostic(report.diagnostics, { kind: "response", method: response.request().method(), status: response.status(),
          corsHeaderAllowsOrigin: headers["access-control-allow-origin"] === base, corsWildcard: headers["access-control-allow-origin"] === "*" });
      } catch { report.diagnostics.headerReadFailures = (report.diagnostics.headerReadFailures || 0) + 1; }
    });
    // No network mocks: the actual deployed app, Auth, Firestore, Storage and CORS are exercised.
    await page.goto(`${base}/?privatePhotoSmoke=${runId}`, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "У меня есть логин и пароль", exact: true }).or(page.locator("summary").filter({ hasText: "У меня есть логин и пароль" })).click();
    const form = page.locator("form").filter({ has: page.getByLabel("Логин или email", { exact: true }) });
    await form.getByLabel("Логин или email", { exact: true }).fill(identity.email);
    await form.getByLabel("Пароль", { exact: true }).fill(identity.password);
    await form.getByRole("button", { name: "Войти", exact: true }).click();
    await expect(page.getByTestId("client-bottom-nav")).toBeVisible();
    await page.getByTestId("client-nav-cabinet").click();
    await expect(page.getByText(`v.${version}`, { exact: true }).first()).toBeVisible();
    currentStep = "open-real-photo-dialog";
    await page.getByTestId("client-nav-progress").click();
    await page.getByTestId("profile-progress-photos-open").click();
    for (const [view, label] of [["front", "Спереди"], ["side", "Сбоку"], ["back", "Со спины"]]) {
      currentStep = `select-${view}-photo`;
      const input = page.getByLabel(`Добавить фото: ${label}`, { exact: true });
      await input.setInputFiles(makePrivatePhotoUploadFixture());
      await expect.poll(() => input.evaluate(node => node.files?.length || 0)).toBe(1);
      await expect(page.locator(`[data-photo-view="${view}"]`)).toContainText("Готово");
      report.diagnostics.selectedViews++;
    }
    currentStep = "enable-three-photo-save";
    await expect(page.getByTestId("profile-progress-photos-save")).toBeEnabled();
    currentStep = "click-three-photo-save";
    await page.getByTestId("profile-progress-photos-save").click();
    currentStep = "wait-upload-saved-status";
    await expect(page.getByTestId("profile-progress-photos-status")).toContainText("сохранены");
    // Current SaveSuccessNotice has no confirmation button: its 2.4s timer closes the sheet.
    await expect(page.getByTestId("profile-progress-photos-dialog")).toBeHidden();
    report.cases.uiUploadSaved = true;
    currentStep = "persisted-private-references";
    const { data: photos } = await request(`${docUrl(`users/${identity.uid}/progressPhotos`)}?pageSize=10`, { bearer: token });
    if (photos.nextPageToken || photos.documents?.length !== 1) fail("unexpected-owned-photo-record-count");
    const paths = verifyPrivatePhotoRecord(photos.documents[0], bucket, identity.uid);
    report.cases.persistedPrivateReferences = paths.length;
    currentStep = "finalizer-private-metadata";
    const metadataDeadline = Date.now() + 90000;
    let objects;
    do {
      objects = await listObjects();
      if (objects.length === 3 && paths.every(path => objects.some(item => item.name === path))
        && objects.every(item => !Object.hasOwn(item.metadata || {}, "firebaseStorageDownloadTokens") && String(item.cacheControl || "").replace(/\s/g, "") === CACHE)) break;
      if (Date.now() >= metadataDeadline) fail("private-metadata-not-finalized");
      await delay(3000);
    } while (true);
    report.cases.privateMetadataVerified = objects.length;
    currentStep = "reload-cloud-getblob-cors";
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("client-bottom-nav")).toBeVisible();
    await page.getByTestId("client-nav-progress").click();
    await page.getByTestId("profile-progress-photos-open").click();
    await assertCloudThumbnails(expect);
    report.cases.reloadedCloudBlobImages = 3;
    currentStep = "anonymous-media-denied";
    for (const path of paths) {
      const url = `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(path)}?alt=media`;
      const response = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(20000) });
      const status = response.status; await response.body?.cancel();
      if (status !== 403) fail("anonymous-media-not-forbidden");
    }
    report.cases.anonymousMediaDenied = 3;
    if (runtimeErrors.length) fail("browser-runtime-errors");
    report.status = "passed";
  } catch (error) {
    report.status = "failed"; report.failedStep = currentStep;
    report.error = /^[a-z0-9-]{1,100}$/.test(error?.smokeCode || "") ? error.smokeCode : "assertion-transport-or-browser-failure";
    if (page && !page.isClosed()) {
      try {
        report.diagnostics.ui = await page.evaluate(() => {
          const save = document.querySelector('[data-testid="profile-progress-photos-save"]');
          const status = document.querySelector('[data-testid="profile-progress-photos-status"]')?.textContent || "";
          const privateImages = [...document.querySelectorAll('[data-testid="profile-progress-photos-latest"] img[data-private-photo-state]')];
          return { dialogPresent: Boolean(document.querySelector('[data-testid="profile-progress-photos-dialog"]')),
            selectedFileInputs: [...document.querySelectorAll('[data-photo-view] input[type="file"]')].filter(input => input.files?.length === 1).length,
            previewImages: document.querySelectorAll('[data-photo-view] img').length,
            savePresent: Boolean(save), saveEnabled: Boolean(save && !save.disabled),
            privateImageStates: Object.fromEntries(["idle", "loading", "ready", "error", "preview"].map(state => [state, privateImages.filter(image => image.dataset.privatePhotoState === state).length])),
            privateBlobSources: privateImages.filter(image => image.getAttribute("src")?.startsWith("blob:")).length,
            decodedPrivateImages: privateImages.filter(image => image.complete && image.naturalWidth > 0).length,
            statusCategory: /сохранены/.test(status) ? "saved" : /Не получилось загрузить/.test(status) ? "upload-failed" : /Добавь фото/.test(status) ? "missing-views" : status ? "other" : "empty" };
        });
      } catch { report.diagnostics.uiSnapshotUnavailable = true; }
    }
    if (identity.uid && bucket && token) {
      try { report.diagnostics.ownedStorageVersionsAtFailure = (await listObjects()).length; } catch { report.diagnostics.ownedInventoryUnavailable = true; }
    }
  } finally {
    cleanupMode = true;
    try { await browser?.close(); report.cleanup.browserClosed = true; } catch { report.cleanup.browserClosed = false; }
    if (identity.creationAttempted && token) {
      try { const found = await lookup(); if (found) identity.uid = found.localId; report.cleanup.identityResolved = true; }
      catch { report.cleanup.identityResolved = false; }
      if (identity.uid && safeUid(identity.uid)) {
        // Independent attempts: a Storage/Firestore failure must not prevent Auth deletion.
        try {
          let deleted = 0;
          if (!bucket) fail("cleanup-bucket-unavailable");
          for (let sweep = 0; sweep < 3; sweep++) {
            const remaining = await listObjects();
            if (!remaining.length) break;
            for (const item of remaining) {
              const url = new URL(`https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(item.name)}`);
              url.searchParams.set("generation", item.generation); url.searchParams.set("ifGenerationMatch", item.generation);
              url.searchParams.set("ifMetagenerationMatch", item.metageneration);
              try {
                await request(url, { method: "DELETE", bearer: token, missing: true }); deleted++;
              } catch (error) {
                // A finalize handler may just have changed metadata. Re-list and
                // revalidate this owned prefix; never retry an unconditional DELETE.
                if (!["http-409", "http-412"].includes(error?.smokeCode)) throw error;
              }
            }
            await delay(500);
          }
          report.cleanup.storageVersionsDeleted = deleted;
          report.cleanup.storageAbsent = (await listObjects()).length === 0;
        } catch { report.cleanup.storageAbsent = false; }
        try {
          const existing = await getDoc(`users/${identity.uid}`);
          if (existing && existing.fields?.smokeMarker?.stringValue !== identity.marker) fail("profile-marker-mismatch");
          await removeTree(`users/${identity.uid}`);
          report.cleanup.firestoreDocumentsDeleted = cleanupDocuments;
          report.cleanup.firestoreAbsent = !(await getDoc(`users/${identity.uid}`));
        } catch { report.cleanup.firestoreAbsent = false; }
        try {
          const queryOwnedLimits = async () => {
            const { data } = await request(`${documents}:runQuery`, { method: "POST", bearer: token, body: { structuredQuery: {
              from: [{ collectionId: "securityRateLimits" }], select: { fields: [{ fieldPath: "uid" }] },
              where: { fieldFilter: { field: { fieldPath: "uid" }, op: "EQUAL", value: { stringValue: identity.uid } } }, limit: 101
            } } });
            return data.filter(row => row.document).map(row => row.document);
          };
          const rows = await queryOwnedLimits();
          if (rows.length > 100) fail("owned-rate-limit-bound");
          for (const doc of rows) {
            if (doc.fields?.uid?.stringValue !== identity.uid || !doc.name?.startsWith(`${databasePrefix}securityRateLimits/`)
              || doc.name.slice(`${databasePrefix}securityRateLimits/`.length).includes("/")) fail("unowned-rate-limit");
            await deleteDocument(doc);
          }
          report.cleanup.ownedRateLimitsDeleted = rows.length;
          report.cleanup.ownedRateLimitsCleaned = (await queryOwnedLimits()).length === 0;
        } catch { report.cleanup.ownedRateLimitsCleaned = false; }
        try {
          const found = await lookup();
          if (found) await admin("delete", { localId: identity.uid });
          report.cleanup.authAbsent = !(await lookup());
        } catch { report.cleanup.authAbsent = false; }
      } else if (report.cleanup.identityResolved) report.cleanup.authAbsent = true;
    }
    if (Object.values(report.cleanup).some(value => value === false)) report.status = "failed";
  }
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const report = await runPrivatePhotoSmoke(parsePrivatePhotoSmokeArgs(process.argv.slice(2)));
    console.log(JSON.stringify(report)); if (report.status === "failed") process.exitCode = 1;
  } catch (error) {
    console.error(JSON.stringify({ status: "failed", error: /^[a-z0-9-]{1,100}$/.test(error?.smokeCode || "") ? error.smokeCode : "operation-failed" }));
    process.exitCode = 1;
  }
}
