import assert from "node:assert/strict";
import test from "node:test";
import { initializeTelegramMiniApp } from "../src/app/telegramMiniApp.js";

function createHost(webApp) {
  const values = new Map();
  const root = {
    dataset: {},
    style: { setProperty: (name, value) => values.set(name, value) }
  };
  return {
    hostWindow: { Telegram: webApp ? { WebApp: webApp } : undefined },
    hostDocument: { documentElement: root },
    root,
    values
  };
}

test("Telegram Mini App setup syncs stable viewport, safe areas and brand chrome", () => {
  const events = new Map();
  const calls = { ready: 0, expand: 0, header: [], background: [], bottomBar: [] };
  const webApp = {
    viewportHeight: 760,
    viewportStableHeight: 720,
    safeAreaInset: { top: 24, right: 0, bottom: 30, left: 0 },
    contentSafeAreaInset: { top: 0, right: 0, bottom: 18, left: 0 },
    colorScheme: "dark",
    onEvent: (name, handler) => events.set(name, handler),
    offEvent: (name) => events.delete(name),
    expand: () => { calls.expand += 1; },
    ready: () => { calls.ready += 1; },
    setHeaderColor: (color) => calls.header.push(color),
    setBackgroundColor: (color) => calls.background.push(color),
    setBottomBarColor: (color) => calls.bottomBar.push(color)
  };
  const { hostWindow, hostDocument, root, values } = createHost(webApp);
  const runtime = initializeTelegramMiniApp(hostWindow, hostDocument);

  assert.equal(root.dataset.platform, "telegram");
  assert.equal(root.dataset.telegramColorScheme, "dark");
  assert.equal(values.get("--app-viewport-height"), "720px");
  assert.equal(values.get("--telegram-safe-area-top"), "24px");
  assert.equal(values.get("--telegram-safe-area-bottom"), "30px");
  assert.equal(values.get("--telegram-content-safe-area-bottom"), "18px");
  assert.deepEqual(calls.header, ["#f5f7f8"]);
  assert.deepEqual(calls.background, ["#f5f7f8"]);
  assert.deepEqual(calls.bottomBar, ["#f5f7f8"]);
  assert.equal(calls.expand, 1);
  assert.equal(calls.ready, 0);

  webApp.viewportStableHeight = 680;
  events.get("viewportChanged")({ isStateStable: false });
  assert.equal(values.get("--app-viewport-height"), "720px");
  events.get("viewportChanged")({ isStateStable: true });
  assert.equal(values.get("--app-viewport-height"), "680px");

  webApp.safeAreaInset = { top: 12, right: 0, bottom: 22, left: 0 };
  events.get("safeAreaChanged")();
  assert.equal(values.get("--telegram-safe-area-bottom"), "22px");

  runtime.ready();
  runtime.ready();
  assert.equal(calls.ready, 1);
  runtime.dispose();
  assert.equal(events.size, 0);
});

test("Telegram Mini App setup stays inactive in a regular browser", () => {
  const { hostWindow, hostDocument, root } = createHost(null);
  assert.equal(initializeTelegramMiniApp(hostWindow, hostDocument), null);
  assert.equal(root.dataset.platform, undefined);
});
