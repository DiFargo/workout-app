import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

async function readText(path) {
  return fs.readFile(path, "utf8");
}

async function pathExists(path) {
  try {
    await fs.access(path);
    return true;
  } catch {
    return false;
  }
}

test("AppCore stays a coordinator and does not re-import nutrition internals", async () => {
  const appCore = await readText("src/AppCore.jsx");

  assert.match(appCore, /renderNutritionRoute/);
  assert.doesNotMatch(appCore, /renderNutritionPageFromContext/);
  assert.doesNotMatch(appCore, /NutritionPageView/);
  assert.doesNotMatch(appCore, /nutritionPageModel/);
  assert.doesNotMatch(appCore, /NUTRITION_ICON_PRESETS/);
  assert.doesNotMatch(appCore, /nutritionMeals/);
});

test("application styles use the modular styles entrypoint", async () => {
  const main = await readText("src/main.jsx");
  const indexCss = await readText("src/styles/index.css");

  assert.equal(await pathExists("src/styles.css"), false);
  assert.match(main, /['"]\.\/styles\/index\.css['"]/);
  assert.doesNotMatch(main, /['"]\.\/styles\.css['"]/);

  for (const requiredImport of [
    "./tokens.css",
    "./themes.css",
    "./layout.css",
    "./components.css",
    "./nutrition-stack.css",
    "./trainer.css",
    "./legacy-stack.css"
  ]) {
    assert.match(indexCss, new RegExp(`@import "${requiredImport.replace(".", "\\.")}"`));
  }
});
