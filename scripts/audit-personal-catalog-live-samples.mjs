import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout } from "node:timers/promises";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const folder = path.join(root, "artifacts/nutrition-catalog-audit-2026-10-29");
const rows = JSON.parse(fs.readFileSync(path.join(root, "public/nutrition-catalog/personal/products.json"), "utf8")).slice(0, 10000);
const samples = ["4810268031793", "4810285009027"];
const keys = ["energy-kcal", "proteins", "fat", "carbohydrates"];
const checks = [];
for (const [index, code] of samples.entries()) {
  if (index) await setTimeout(4500);
  const local = rows.find(row => row[10].includes(code));
  const url = new URL(`https://world.openfoodfacts.org/api/v3.6/product/${code}.json`);
  url.searchParams.set("fields", "code,product_name,nutrition,nutrition_data_per,quantity,product_quantity_unit,last_modified_t,image_nutrition_url");
  const check = { code, id: local?.[0], name: local?.[1], endpoint: url.href, checkedAt: new Date().toISOString(),
    localNutrition: local && { basis: local[8], kcal: local[4], protein: local[5], fat: local[6], carbs: local[7] },
    labelImageIndependentlyInspected: false };
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "ZmenaCatalogAudit/1.0 (read-only; https://tren-85720.web.app)" },
      signal: AbortSignal.timeout(20000)
    });
    check.httpStatus = response.status;
    if (!response.ok) {
      check.statusRussian = "Источник недоступен; достоверность не подтверждена";
    } else {
      const data = await response.json();
      const product = data.product;
      check.sourceSnapshot = product || null;
      const aggregate = product?.nutrition?.aggregated_set;
      check.sourceBasis = aggregate?.per || null;
      const nutrients = aggregate?.nutrients;
      check.sourceNumbers = nutrients ? Object.fromEntries(keys.map(key => [key, nutrients[key]?.value ?? null])) : null;
      check.basisMismatch = Boolean(local && check.sourceBasis && check.sourceBasis !== local[8]);
      check.numericDifference = Boolean(local && check.sourceBasis === local[8] && keys.some((key, i) =>
        Number.isFinite(nutrients?.[key]?.value) && Math.abs(nutrients[key].value - local[4 + i]) > 0.001));
      check.statusRussian = !product ? "Карточка не найдена" : check.basisMismatch
        ? "Единица каталога отличается от текущего структурированного источника"
        : check.numericDifference ? "КБЖУ каталога отличаются от текущего структурированного источника"
          : "Числа и единица совпадают с текущим API; это не независимая сверка этикетки";
    }
  } catch (error) {
    check.statusRussian = "Ошибка доступа к источнику; достоверность не подтверждена";
    check.error = error.message;
  }
  checks.push(check);
  console.log(JSON.stringify({ code, httpStatus: check.httpStatus, status: check.statusRussian }));
}
fs.mkdirSync(folder, { recursive: true });
fs.writeFileSync(path.join(folder, "live-samples.json"), JSON.stringify({
  schemaVersion: 1,
  title: "Выборочная сверка текущего Open Food Facts",
  scopeRussian: "Только два публичных продукта; не массовая сверка всех 10 000 этикеток. API не изменялся, каталог и Production не записывались.",
  documentation: [
    "https://openfoodfacts.github.io/documentation/docs/Product-Opener/api/",
    "https://openfoodfacts.github.io/documentation/docs/Product-Opener/schemas/schemas/product_nutrition/"
  ],
  earlierBatchProbe: { endpoint: "GET /api/v2/search (3 public codes)", httpStatus: 503,
    noteRussian: "После ошибки массовая загрузка не запускалась. Для более чем нескольких сотен товаров документация просит использовать экспорт данных." },
  checks
}, null, 2) + "\n");
