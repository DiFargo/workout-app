import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const folder = path.join(root, "artifacts/nutrition-catalog-audit-2026-10-29");
const read = file => JSON.parse(fs.readFileSync(file, "utf8"));
const sha = data => crypto.createHash("sha256").update(data).digest("hex");
const runtimePath = path.join(root, "public/nutrition-catalog/personal/products.json");
const before = sha(fs.readFileSync(runtimePath));
const baseline = read(path.join(root, "public/nutrition-catalog/personal/manufacturer-sources.json")).baseline;
const rows = read(runtimePath).slice(0, baseline.count);
const provenance = read(path.join(folder, "provenance.json"));
const nutrition = read(path.join(folder, "nutrition.json"));
const duplicates = read(path.join(folder, "duplicates.json"));
const live = read(path.join(folder, "live-samples.json"));
const expected = new Set(rows.map(row => row[0]));
assert.equal(rows.length, 10000);
assert.equal(sha(JSON.stringify(rows)), baseline.rowsSha256);
for (const records of [provenance.records, nutrition.records, duplicates.coverage]) {
  assert.equal(records.length, expected.size);
  assert.equal(new Set(records.map(record => record.id)).size, expected.size);
  assert.ok(records.every(record => expected.has(record.id)));
}
assert.ok(duplicates.coverage.every(record => record.checked));
const byProvenance = new Map(provenance.records.map(record => [record.id, record]));
const byNutrition = new Map(nutrition.records.map(record => [record.id, record]));
const byDuplicates = new Map(duplicates.coverage.map(record => [record.id, record]));
const byLive = new Map(live.checks.map(record => [record.id, record]));
const recordRows = rows.map(row => {
  const source = byProvenance.get(row[0]);
  const nutritional = byNutrition.get(row[0]);
  return [row[0], row[1], row[2], row[12], row[8], ...row.slice(4, 8), nutritional.recordStatus,
    nutritional.priority, byDuplicates.get(row[0]).groupIds, nutritional.findings.map(finding => finding.code),
    source.classification, row[14], byLive.get(row[0])?.sourceBasis || null, Boolean(byLive.get(row[0])?.basisMismatch)];
});
const recordsPath = path.join(folder, "records.json");
fs.writeFileSync(recordsPath, JSON.stringify({
  title: "Индивидуальные результаты проверки всех 10 000 исходных карточек",
  checkedRecords: recordRows.length,
  checkedAreasRussian: ["Структура и КБЖУ", "Происхождение и точность переноса", "Дубли и разновидности"],
  independentlyVerifiedLabels: 0,
  columns: ["id", "name", "brand", "sourceType", "basis", "kcal", "protein", "fat", "carbs", "nutritionStatus", "priority", "duplicateReviewGroupIds", "nutritionFindingCodes", "sourceClassification", "sourceUrl", "liveSourceBasis", "liveSourceBasisMismatch"],
  records: recordRows
}) + "\n");
const summary = {
  schemaVersion: 1,
  title: "Аудит исходной базы продуктов из 10 000 карточек",
  date: "2026-10-29",
  conclusion: "Внутренняя проверка охватила каждую карточку. Это не независимая сверка всех этикеток. По решению пользователя 2701 сомнительная карточка исключена из общего поискового payload, но сохранена в архиве с прежними ID. История и личные продукты не изменялись; сведения о выпуске находятся в отдельном release.json.",
  scope: {
    baselineCount: rows.length,
    currentLocalCount: read(runtimePath).length,
    addedManufacturerCardsPreviouslyChecked: read(path.join(root, "public/nutrition-catalog/personal/manufacturer-sources.json")).records.length,
    runtimeWrittenByAudit: false,
    productionWrittenByAudit: false,
    userHistoryWritten: false
  },
  acceptanceChecklist: [
    { item: "Все 10 000 ID присутствуют ровно один раз в каждом из трёх индивидуальных отчётов", passed: true },
    { item: "Проверены КБЖУ, заявленный базис, перенос из исходников, конфликты и признаки дублей", passed: true },
    { item: "Сходные варианты не объявлены доказанными дублями; состав не используется как идентичность товара", passed: true },
    { item: "Проверка локальных данных отделена от независимой сверки этикеток и текущего API", passed: true },
    { item: "Каталог, старые ID и история не изменены аудитом; массовое удаление не выполнялось", passed: true }
  ],
  coverage: {
    structuralNutritionChecked: nutrition.records.length,
    sourceConsistencyChecked: provenance.records.length,
    duplicateScreeningChecked: duplicates.coverage.length,
    independentlyVerifiedLabels: 0,
    currentApiSamples: live.checks.length,
    currentApiAvailable: live.checks.filter(check => check.httpStatus === 200).length,
    currentApiSourceBasisMismatches: live.checks.filter(check => check.basisMismatch).length
  },
  mainFindings: [
    { issue: "Неподтверждённые записи Gemini без единицы КБЖУ и внешнего первичного URL", count: 2584, meaning: "Нельзя считать проверенными на 100 г. Подтверждение пользователем массы не подтверждает сами числа." },
    { issue: "Карточки с конфликтами сохранённых источников", count: 114, meaning: "Расхождения разного масштаба требуют выбора конкретного SKU и источника, а не усреднения." },
    { issue: "Сумма БЖУ несовместима с указанными 100 г даже в модели округления", count: 5, meaning: "Приоритетная сверка этикеток; значения не исправлялись догадкой." },
    { issue: "Кандидаты на сверку единицы жидкости", count: 565, meaning: "Это не 565 доказанных ошибок. Текущий источник одного кваса уже явно задаёт 100 мл вместо указанных каталогом 100 г." },
    { issue: "Подозрительные группы похожих карточек", count: duplicates.summary.suspectedGroups, affectedRows: duplicates.summary.suspectedRows, meaning: "Не доказанные дубли. Разные вкусы, жирность, форма и приготовление исключают автоматическое объединение." },
    { issue: "Источники OFF с датой обновления старше трёх лет в сохранённом экспорте", count: 1059, meaning: "Возраст не доказывает ошибку, но нужен актуальный источник. Это дата источника, не дата последней независимой проверки упаковки." }
  ],
  technicalIntegrity: {
    invalidOrNegativeNutritionValues: 0,
    originalToRuntimeTransferErrors: provenance.summary.numericTransferMismatchCards,
    confirmedDuplicateIdGtinOrStrictIdentityGroups: duplicates.summary.confirmedGroups,
    baselineSha256: baseline.rowsSha256,
    runtimeSha256UnchangedBySummary: before
  },
  nutritionTriage: nutrition.summary,
  duplicateTriage: duplicates.summary,
  sourceTriage: provenance.summary,
  strongestExamples: {
    massContradictions: nutrition.records.filter(record => record.recordStatus === "внутреннее_противоречие_данных")
      .map(record => ({ id: record.id, name: record.name, brand: record.brand, nutrition: record.nutrition, sum: record.per100g.macroSum, sourceUrls: record.sourceUrls })),
    sourceUnitMismatch: live.checks.filter(check => check.basisMismatch).map(check => ({
      id: check.id, name: check.name, localBasis: check.localNutrition.basis, currentSourceBasis: check.sourceBasis, endpoint: check.endpoint,
      meaning: "Подтверждено расхождение с текущим структурированным источником; фото этикетки независимо не просматривалось. Граммы и миллилитры без плотности не пересчитывались."
    }))
  },
  actionPlan: [
    { order: 1, task: "Сохранить все старые ID и снимки дневников. Не пересчитывать историю и не удалять данные клиентов." },
    { order: 2, task: "По согласованию отделить 2 584 неподтверждённые AI-карточки от основного поиска. Для возвращения нужны идентифицируемый SKU, этикетка/производитель и точный базис." },
    { order: 3, task: "Сначала сверить 5 противоречий массы и 114 конфликтов источников; возможные различия рецептуры, упаковки и округления не усреднять." },
    { order: 4, task: "Восстановить и сквозным образом хранить 100 г / 100 мл. Проверить 565 жидкостных кандидатов, начиная с подтверждённого расхождения кваса." },
    { order: 5, task: "Проверить 138 групп с сильными текстовыми признаками дублей, затем 606 семантических. Старые ссылки сохранять через алиасы; транзитивные группы целиком не объединять." },
    { order: 6, task: "Для оставшихся OFF-карточек сверить свежий экспорт и упаковки/производителей. Логическое совпадение чисел и URL не использовать как знак подтверждённой этикетки." },
    { order: 7, task: "После согласованных изменений повторить дедупликацию, единицы, поиск, порции, личную базу и неизменность истории; затем опубликовать вместе с 55 новыми товарами." }
  ],
  limitations: [
    "Аудит не является заявлением, что все 10 000 КБЖУ сверены с упаковками: независимо просмотренных исходных этикеток в этом проходе 0.",
    "1478 отклонений от формулы 4/9/4 — только повод для проверки: полиолы, клетчатка и другие компоненты могут объяснять часть разницы.",
    "744 группы сходства не означают 744 дубли. В шести транзитивных группах есть разные разновидности, массовое объединение недопустимо.",
    "Один batch-пробник API вернул 503; выполнена только малая выборка текущего API. Массовая актуальная выгрузка и визуальная сверка всех упаковок не выполнялись.",
    "Каталог и Production не исправлялись по результатам этого аудита; нужно отдельное согласование способа очистки."
  ],
  documentation: [
    "https://openfoodfacts.github.io/documentation/docs/Product-Opener/schemas/schemas/product_nutrition/",
    "https://openfoodfacts.github.io/documentation/docs/Product-Opener/api/"
  ],
  evidence: Object.fromEntries(["provenance.json", "nutrition.json", "duplicates.json", "live-samples.json", "records.json"].map(file => [file, {
    path: `artifacts/nutrition-catalog-audit-2026-10-29/${file}`,
    bytes: fs.statSync(path.join(folder, file)).size,
    sha256: sha(fs.readFileSync(path.join(folder, file)))
  }]))
};
assert.equal(sha(fs.readFileSync(runtimePath)), before);
fs.writeFileSync(path.join(folder, "summary.json"), JSON.stringify(summary, null, 2) + "\n");
console.log(JSON.stringify({ checked: rows.length, independentlyVerifiedLabels: 0, runtimeUnchanged: true,
  duplicatesReviewGroups: duplicates.summary.suspectedGroups, currentApiSourceBasisMismatches: summary.coverage.currentApiSourceBasisMismatches,
  summary: "artifacts/nutrition-catalog-audit-2026-10-29/summary.json" }, null, 2));
