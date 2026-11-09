import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const script = html.match(/<script id="startup-appearance">([\s\S]*?)<\/script>/)?.[1];

function resolveAppearance({ saved = null, storageError = false, systemDark = false, telegram } = {}) {
  const root = { dataset: {} };
  const context = {
    document: { documentElement: root },
    localStorage: { getItem(key) {
      assert.equal(key, "zmena-client-appearance-v1");
      if (storageError) throw new Error("Storage blocked");
      return saved;
    } },
    window: { Telegram: telegram ? { WebApp: telegram } : undefined,
      matchMedia: query => {
        assert.equal(query, "(prefers-color-scheme: dark)");
        return { matches: systemDark };
      } }
  };
  assert.ok(script, "The initial theme must resolve before the application module loads");
  vm.runInNewContext(script, context);
  return root.dataset.startupAppearance;
}

test("loading follows the explicit saved theme independently of Telegram or OS", () => {
  for (const saved of ["dark", "light"]) {
    assert.equal(resolveAppearance({ saved }), saved);
    assert.equal(resolveAppearance({ saved, systemDark: saved === "light",
      telegram: { initData: "test", colorScheme: saved === "light" ? "dark" : "light" } }), saved);
  }
});

test("first launch and restricted storage retain the safe light default", () => {
  for (const saved of [null, "", "unknown"]) assert.equal(resolveAppearance({ saved, systemDark: true }), "light");
  assert.equal(resolveAppearance({ storageError: true }), "light");
});

test("legacy system theme uses a live Telegram host, otherwise the device preference", () => {
  assert.equal(resolveAppearance({ saved: "system", systemDark: true }), "dark");
  assert.equal(resolveAppearance({ saved: "system", systemDark: false }), "light");
  assert.equal(resolveAppearance({ saved: "system", systemDark: false,
    telegram: { initData: "test", colorScheme: "dark" } }), "dark");
  assert.equal(resolveAppearance({ saved: "system", systemDark: true,
    telegram: { platform: "ios", colorScheme: "light" } }), "light");
  assert.equal(resolveAppearance({ saved: "system", systemDark: true,
    telegram: { platform: "unknown", colorScheme: "light" } }), "dark");
});
