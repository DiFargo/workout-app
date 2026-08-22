import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const sourceUrl = (path) => new URL(`../${path}`, import.meta.url);

test("auth bootstrap releases the app before optional Telegram hydration", async () => {
  const source = await readFile(sourceUrl("src/app/useAuthBootstrapEffect.js"), "utf8");

  assert.match(source, /import \{ useEffect \} from "react"/);
  assert.match(source, /const BOOTSTRAP_FALLBACK_TIMEOUT_MS = 9000/);
  assert.match(source, /void hydrateRemoteTelegramProfile\(\{/);
  assert.doesNotMatch(source, /await hydrateRemoteTelegramProfile\(\{/);
});

test("splash screen offers a clear retry path when startup is slow or offline", async () => {
  const [screen, styles] = await Promise.all([
    readFile(sourceUrl("src/components/auth/AuthScreens.jsx"), "utf8"),
    readFile(sourceUrl("src/components/auth/AuthScreens.module.css"), "utf8")
  ]);

  assert.match(screen, /window\.setTimeout\(\(\) => setShowRecovery\(true\), 6000\)/);
  assert.match(screen, /Нет соединения\. Проверь интернет и повтори попытку\./);
  assert.match(screen, /window\.location\.reload\(\)/);
  assert.match(styles, /\.splashRetry \{[\s\S]*?min-height: 44px/);
});

test("lazy routes reuse the single startup splash instead of a second loading screen", async () => {
  const [startupGate, routeFallback] = await Promise.all([
    readFile(sourceUrl("src/app/appStartupGate.jsx"), "utf8"),
    readFile(sourceUrl("src/app/RouteFallback.jsx"), "utf8")
  ]);

  assert.match(startupGate, /if \(appLoading \|\| firstSetupStillResolving\) \{\s*return <AppSplash \/>;/);
  assert.match(routeFallback, /import \{ AppSplash \} from "\.\.\/components\/auth\/AuthScreens"/);
  assert.match(routeFallback, /return <AppSplash \/>;/);
  assert.doesNotMatch(routeFallback, /clientRouteFallback/);
});

test("startup does not restart when App Check or a service worker becomes ready", async () => {
  const [main, registration, worker] = await Promise.all([
    readFile(sourceUrl("src/main.jsx"), "utf8"),
    readFile(sourceUrl("src/app/registerServiceWorker.js"), "utf8"),
    readFile(sourceUrl("public/sw.js"), "utf8")
  ]);

  assert.doesNotMatch(main, /await initializeClientAppCheck\(/);
  assert.match(main, /void initializeClientAppCheck\(\)\.catch/);
  assert.match(registration, /requestIdleCallback/);
  assert.doesNotMatch(registration, /controllerchange/);
  assert.doesNotMatch(registration, /window\.location\.reload\(\)/);
  assert.doesNotMatch(worker, /self\.skipWaiting\(\)/);
});

test("service worker has bounded runtime, nutrition and video caches", async () => {
  const source = await readFile(sourceUrl("public/sw.js"), "utf8");

  assert.match(source, /RUNTIME_CACHE_MAX_ENTRIES = 32/);
  assert.match(source, /NUTRITION_CATALOG_CACHE_MAX_ENTRIES = 8/);
  assert.match(source, /WORKOUT_VIDEO_CACHE_MAX_ENTRIES = 4/);
  assert.match(source, /MAX_CACHEABLE_VIDEO_BYTES = 20 \* 1024 \* 1024/);
  assert.match(source, /function enforceCacheEntryLimit/);
  assert.match(source, /url\.pathname\.startsWith\("\/nutrition-catalog\/"\)/);
  assert.match(source, /slice\(0, WORKOUT_VIDEO_CACHE_MAX_ENTRIES\)/);
  assert.doesNotMatch(source, /response\.status === 200 \|\| response\.type === "opaque"/);
});
