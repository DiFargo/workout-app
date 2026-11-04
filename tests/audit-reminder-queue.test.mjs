import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { rolldown } from "rolldown";
import { chromium, expect } from "@playwright/test";

// Execute the real component with real React scheduling and DOM events. Only
// persistence is held at its I/O boundary; CSS does not affect these behaviors.
const componentPath = fileURLToPath(new URL("../src/features/client/profile/ProfileNotificationSettingsSection.jsx", import.meta.url)).replaceAll("\\", "/");
const bundle = await rolldown({
  input: "reminder-queue-entry", platform: "browser", transform: { jsx: { runtime: "automatic" } },
  plugins: [{
    name: "reminder-test-entry", resolveId: id => id === "reminder-queue-entry" ? id : null,
    load(id) {
      if (id.endsWith(".css")) return { code: "export default {};", moduleType: "js" };
      if (id === "reminder-queue-entry") return `
        import React from "react";
        import { createRoot } from "react-dom/client";
        import Settings from ${JSON.stringify(componentPath)};
        export function mount() {
          window.reminderIO = { calls: [], resolve: [] };
          createRoot(document.getElementById("root")).render(React.createElement(Settings, {
            telegramProfile: { connected: true },
            calendar: { reminderOffsetsHours: [24, 12], progressPhotoReminderEnabled: true, progressReminderTime: "09:00" },
            onSaveReminders: next => new Promise(resolve => {
              window.reminderIO.calls.push(structuredClone(next));
              window.reminderIO.resolve.push(resolve);
            })
          }));
        }
      `;
      return null;
    }
  }]
});
const generated = await bundle.generate({ format: "iife", name: "ReminderProbe" });
await bundle.close();

test("failed time save rolls back UI while retry retains all queued offset changes", { timeout: 30000 }, async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.setContent('<main id="root"></main>');
    await page.addScriptTag({ content: generated.output[0].code });
    await page.evaluate(() => window.ReminderProbe.mount());
    const time = page.getByLabel("Время для фото, веса и замеров");
    const offsets = page.getByRole("group", { name: "Когда напоминать о тренировке" });
    await time.fill("18:35");
    await time.blur();
    await page.getByRole("status").waitFor();
    await offsets.getByRole("button", { name: "1 ч", exact: true }).click();
    await expect(offsets.getByRole("button", { name: "1 ч", exact: true })).toHaveAttribute("aria-pressed", "true");
    await offsets.getByRole("button", { name: "24 ч", exact: true }).click();
    await expect(offsets.getByRole("button", { name: "1 ч", exact: true })).toHaveAttribute("aria-pressed", "true");
    assert.deepEqual(await page.evaluate(() => window.reminderIO.calls.map(call => call.offsets)), [[24, 12]]);
    await page.evaluate(() => window.reminderIO.resolve[0](false));
    await page.getByRole("alert").waitFor();
    assert.equal(await time.inputValue(), "09:00");
    assert.equal(await offsets.getByRole("button", { name: "24 ч", exact: true }).getAttribute("aria-pressed"), "true");
    assert.equal(await offsets.getByRole("button", { name: "1 ч", exact: true }).getAttribute("aria-pressed"), "false");
    await page.getByRole("button", { name: "Повторить сохранение" }).click();
    const retry = await page.evaluate(() => window.reminderIO.calls[1]);
    assert.deepEqual(retry.offsets, [12, 1]);
    assert.equal(retry.reminderTime, "18:35");
    assert.equal(retry.photoEnabled, true);
    await page.evaluate(() => window.reminderIO.resolve[1](true));
    await page.getByRole("status").filter({ hasText: "Настройки сохранены" }).waitFor();
    assert.equal(await time.inputValue(), "18:35");
    assert.equal(await offsets.getByRole("button", { name: "1 ч", exact: true }).getAttribute("aria-pressed"), "true");
    assert.equal(await offsets.getByRole("button", { name: "24 ч", exact: true }).getAttribute("aria-pressed"), "false");
  } finally {
    await browser.close();
  }
});
