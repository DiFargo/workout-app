import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { rolldown } from "rolldown";
import { chromium } from "playwright";

const sourcePath = value => fileURLToPath(new URL(value, import.meta.url)).replaceAll("\\", "/");
const pickerPath = sourcePath("../src/features/client/workouts/WorkoutExercisePicker.jsx");
const focusPath = sourcePath("../src/shared/hooks/useModalFocusTrap.js");
const sharedCss = readFileSync(new URL("../src/shared/ui/ResponsiveModalLayer.module.css", import.meta.url), "utf8");
function unwrapGlobals(css) {
  let result = "", cursor = 0, start;
  while ((start = css.indexOf(":global(", cursor)) !== -1) {
    result += css.slice(cursor, start);
    let end = start + 8, depth = 1;
    for (; end < css.length && depth; end++) {
      if (css[end] === "(") depth++;
      else if (css[end] === ")") depth--;
    }
    result += css.slice(start + 8, end - 1);
    cursor = end;
  }
  return result + css.slice(cursor);
}
const bundle = await rolldown({
  input: "exercise-picker-test-entry", platform: "browser", transform: { jsx: { runtime: "automatic" } },
  plugins: [{
    name: "exercise-picker-component-test",
    resolveId(id) { return id === "exercise-picker-test-entry" ? id : null; },
    load(id) {
      if (id.endsWith(".css")) {
        const css = readFileSync(id, "utf8");
        const classes = Object.fromEntries([...css.matchAll(/\.([a-zA-Z_][\w-]*)/g)].map(match => [match[1], match[1]]));
        return { code: `const style = document.createElement('style'); style.textContent = ${JSON.stringify(css)}; document.head.appendChild(style); export default ${JSON.stringify(classes)};`, moduleType: "js" };
      }
      if (id === "exercise-picker-test-entry") return { code: `
        import React from 'react';
        import { createRoot } from 'react-dom/client';
        import Picker from ${JSON.stringify(pickerPath)};
        import { useModalFocusTrap } from ${JSON.stringify(focusPath)};
        let root;
        window.pickerEvents = { selected: [], closed: 0 };
        function Harness({ items }) {
          const [open, setOpen] = React.useState(false);
          useModalFocusTrap();
          return <><button data-testid='open-picker' onClick={() => setOpen(true)}>Выбрать упражнение</button>
            <button data-testid='outside-action'>Действие за окном</button>
            <Picker open={open} items={items} onClose={() => { window.pickerEvents.closed++; setOpen(false); }}
              onSelectStep={step => window.pickerEvents.selected.push(step)} /></>;
        }
        export function mount(items) {
          root = createRoot(document.getElementById('root'));
          window.pickerItems = Object.freeze(items.map(item => Object.freeze(item)));
          root.render(<React.StrictMode><Harness items={window.pickerItems} /></React.StrictMode>);
        }
        export function unmount() { root.unmount(); }
      `, moduleType: "jsx" };
      return null;
    }
  }]
});
const generated = await bundle.generate({ format: "iife", name: "ExercisePickerProbe" });
await bundle.close();

const items = [
  { key: "press", title: "Жим ногами", detail: "3 подхода", stepIndex: 1, status: "completed" },
  { key: "row", title: "Тяга хаммера по одной руке", detail: "3 подхода", stepIndex: 2, status: "partial", current: true },
  { key: "group-round-2", title: "Разведение гантелей", detail: "Суперсет · круг 2 из 3", stepIndex: 7, status: "pending" }
];

async function mount(page, rows = items) {
  await page.setContent("<main id='root'></main>");
  await page.addStyleTag({ content: "body { margin: 0; font-family: system-ui, sans-serif; }" });
  await page.addStyleTag({ content: unwrapGlobals(sharedCss) });
  await page.addScriptTag({ content: generated.output[0].code });
  await page.evaluate(value => window.ExercisePickerProbe.mount(value), rows);
  await page.getByTestId("open-picker").waitFor({ state: "visible" });
}

test("controlled exercise picker preserves execution-step identity and never mutates items or completes sets", { timeout: 30000 }, async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
    await mount(page);
    assert.equal(await page.getByRole("dialog").count(), 0);
    await page.getByTestId("open-picker").click();
    const dialog = page.getByRole("dialog", { name: "Упражнения тренировки" });
    await dialog.waitFor({ state: "visible" });
    assert.equal(await dialog.getAttribute("aria-modal"), "true");
    assert.equal(await dialog.locator('[aria-current="step"]').count(), 1);
    assert.match(await dialog.locator('[aria-current="step"]').innerText(), /Тяга хаммера/);
    assert.match(await dialog.innerText(), /Выполнено/);
    assert.match(await dialog.innerText(), /Не завершено/);
    assert.match(await dialog.innerText(), /Не начато/);
    await dialog.getByRole("button", { name: /Разведение гантелей/ }).click();
    assert.deepEqual(await page.evaluate(() => window.pickerEvents.selected), [7]);
    assert.equal(await dialog.isVisible(), true, "Parent owns whether the guarded selection closes the sheet");
    assert.equal(await page.evaluate(() => window.pickerEvents.closed), 0);
    assert.deepEqual(await page.evaluate(() => window.pickerItems), items);
  } finally { await browser.close(); }
});

test("picker uses global focus/body guards and has working close, Escape, backdrop and keyboard selection", { timeout: 30000 }, async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 320, height: 640 } });
    await mount(page);
    const open = page.getByTestId("open-picker");
    await open.click();
    const close = page.getByRole("button", { name: "Закрыть список упражнений" });
    await page.waitForFunction(() => document.activeElement?.getAttribute("aria-label") === "Закрыть список упражнений");
    assert.equal(await page.locator("body").evaluate(node => node.style.overflow), "hidden");
    assert.equal(await open.evaluate(node => node.closest("main").inert), true);
    const closeRect = await close.boundingBox();
    assert.ok(closeRect.width >= 44 && closeRect.height >= 44);
    await page.keyboard.press("Shift+Tab");
    await page.waitForFunction(() => document.activeElement?.getAttribute("data-step-index") === "7");
    await page.keyboard.press("Enter");
    assert.deepEqual(await page.evaluate(() => window.pickerEvents.selected), [7]);
    await page.keyboard.press("Escape");
    await page.getByRole("dialog").waitFor({ state: "detached" });
    await page.waitForFunction(() => document.activeElement?.getAttribute("data-testid") === "open-picker");
    assert.equal(await page.locator("body").evaluate(node => node.style.overflow), "");
    assert.equal(await open.evaluate(node => node.closest("main").inert), false);
    await open.click();
    await close.click();
    await page.getByRole("dialog").waitFor({ state: "detached" });
    await open.click();
    await page.getByTestId("workout-exercise-picker-backdrop").click({ position: { x: 2, y: 2 } });
    await page.getByRole("dialog").waitFor({ state: "detached" });
    assert.equal(await page.evaluate(() => window.pickerEvents.closed), 3);
    assert.deepEqual(await page.evaluate(() => window.pickerEvents.selected), [7]);
  } finally { await browser.close(); }
});

test("long exercise lists and large text remain scrollable without horizontal overflow or hidden controls", { timeout: 30000 }, async () => {
  const browser = await chromium.launch();
  try {
    const rows = Array.from({ length: 24 }, (_, index) => ({
      key: `exercise-${index}`, stepIndex: index + 1,
      title: `Тяга гантели одной рукой с опорой на наклонную скамью ${index + 1}`,
      detail: "Суперсет · круг 2 из 3", status: "pending", current: index === 18
    }));
    for (const viewport of [{ width: 320, height: 640 }, { width: 375, height: 812 }, { width: 844, height: 390 }, { width: 768, height: 1024 }]) {
      const page = await browser.newPage({ viewport });
      let requests = 0;
      await page.route("**/*", route => { requests++; return route.abort(); });
      await mount(page, rows);
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.evaluate(() => { document.documentElement.style.fontSize = "32px"; });
      await page.getByTestId("open-picker").click();
      const dialog = page.getByRole("dialog", { name: "Упражнения тренировки" });
      await dialog.waitFor({ state: "visible" });
      const rect = await dialog.boundingBox();
      assert.ok(rect.x >= 0 && rect.y >= 0 && rect.x + rect.width <= viewport.width + 1 && rect.y + rect.height <= viewport.height + 1);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      const list = dialog.getByRole("list");
      assert.equal(await list.evaluate(node => node.scrollHeight > node.clientHeight), true);
      const last = dialog.getByTestId("workout-exercise-picker-item").last();
      await last.click();
      const rowRect = await last.boundingBox();
      const listRect = await list.boundingBox();
      const visibleTop = Math.max(rowRect.y, listRect.y);
      const visibleBottom = Math.min(rowRect.y + rowRect.height, listRect.y + listRect.height);
      // At 200% text a long exercise can be taller than the scroll area. Keep
      // its text scrollable and an unobscured actionable area, not a clipped label.
      assert.ok(visibleBottom - visibleTop >= 44, JSON.stringify({ viewport, rowRect, listRect }));
      assert.equal(await last.evaluate((node, { top, bottom }) => {
        const rect = node.getBoundingClientRect();
        return node.contains(document.elementFromPoint(rect.x + rect.width / 2, (top + bottom) / 2));
      }, { top: visibleTop, bottom: visibleBottom }), true);
      assert.deepEqual(await page.evaluate(() => window.pickerEvents.selected), [24]);
      assert.equal(requests, 0, "Opening and selecting use only supplied workout items");
      await page.close();
    }
  } finally { await browser.close(); }
});
