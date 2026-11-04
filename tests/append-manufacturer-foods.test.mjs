import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createSearch } from '../scripts/lib/belarusPersonalCatalog.mjs';
import {
  appendManufacturerFoods, canonicalManufacturerBrand, manufacturerFoodId, normalizedManufacturerGtin,
} from '../scripts/lib/appendManufacturerFoods.mjs';

const nutrition = { basis: '100g', kcal: 121, protein: 16, fat: 5, carbs: 3 };
function candidate(overrides = {}) {
  return { name: 'Творог рассыпчатый 5%', brand: 'Тест', manufacturer: 'Белорусский завод', manufacturerCountry: 'BY',
    category: 'Молочные продукты и сыры', nutrition: { ...nutrition }, barcodes: [], aliases: [],
    source: { url: 'https://manufacturer.example/products/curd/', checkedAt: '2026-10-29T12:00:00Z',
      manufacturerEvidenceUrl: 'https://manufacturer.example/about/', basisText: 'Пищевая ценность на 100 г.' }, ...overrides };
}
function tuple(overrides = {}) {
  const food = candidate(overrides), n = food.nutrition;
  return ['existing-1', food.name, food.brand, food.category, n.kcal, n.protein, n.fat, n.carbs,
    n.basis, food.aliases, food.barcodes, 'BY', 'openfoodfacts', false, 'https://world.openfoodfacts.org/product/4810268031793'];
}
const append = (candidates, existingRows = []) => appendManufacturerFoods({ existingRows, candidates });

test('all published baseline tuples retain their complete values, order and references', () => {
  const baseline = JSON.parse(fs.readFileSync(new URL('../public/nutrition-catalog/personal/products.json', import.meta.url)));
  const before = JSON.stringify(baseline);
  const result = append([candidate({ name: 'Продукт регрессионного теста уникальный', brand: 'Уникальная тестовая марка' })], baseline);
  assert.equal(result.added.length, 1);
  assert.equal(result.rows.length, baseline.length + 1);
  assert.equal(JSON.stringify(result.rows.slice(0, baseline.length)), before);
  assert.equal(JSON.stringify(baseline), before);
  assert.ok(baseline.every((row, index) => result.rows[index] === row));
  const added = result.added[0];
  assert.equal(added[11], 'unknown'); assert.equal(added[12], 'manufacturer'); assert.equal(added[13], false);
  assert.equal(added[14], candidate().source.url); assert.equal(added[15], 'Производитель: Белорусский завод');
});

test('GTIN-13/14 equivalents are duplicates and conflicting source values never overwrite the baseline', () => {
  const existing = tuple({ barcodes: ['4810268031793'] });
  const result = append([candidate({ name: 'Другое название', barcodes: ['04810268031793'], nutrition: { ...nutrition, kcal: 130 } })], [existing]);
  assert.equal(normalizedManufacturerGtin('4810268031793'), '04810268031793');
  assert.equal(result.added.length, 0); assert.equal(result.rows[0], existing);
  assert.deepEqual(result.duplicates[0].matchingIds, ['existing-1']);
  assert.deepEqual(result.duplicates[0].reasons, ['gtin_match']);
  assert.equal(result.duplicates[0].nutritionConflict, true); assert.equal(existing[4], 121);
});

test('exact brand/title grouping ignores pack sizes but retains the old tuple and source', () => {
  const existing = tuple({ name: 'Творог рассыпчатый 5,0% 200 г' });
  const result = append([candidate({ name: 'Творог рассыпчатый 5% 400 г' })], [existing]);
  assert.equal(result.added.length, 0); assert.deepEqual(result.duplicates[0].reasons, ['identity_match']);
  assert.equal(result.duplicates[0].nutritionConflict, false);
});

test('reordered and conservatively similar titles require review rather than adding or merging', () => {
  const existing = tuple({ name: 'Творог классический рассыпчатый 5%' });
  const reordered = append([candidate({ name: 'Творог рассыпчатый классический 5%' })], [existing]);
  assert.equal(reordered.added.length, 0); assert.equal(reordered.duplicates.length, 0);
  assert.deepEqual(reordered.suspected[0].reasons, ['reordered_identity']);
  const similar = append([candidate({ name: 'Творог классический рассыпчатый нежный 5%' })], [existing]);
  assert.equal(similar.added.length, 0); assert.deepEqual(similar.suspected[0].reasons, ['similar_title']);
});

test('ingredient aliases do not merge unrelated products or trigger an alias suspicion', () => {
  const existing = tuple({ name: 'Творог мягкий', aliases: ['Молоко нормализованное, закваска.'] });
  const result = append([candidate({ name: 'Творог высокобелковый', aliases: ['Молоко нормализованное, закваска.'] })], [existing]);
  assert.equal(result.added.length, 1); assert.equal(result.duplicates.length, 0); assert.equal(result.suspected.length, 0);
  const pasta = append([candidate({ name: 'Спагетти из твердых сортов пшеницы', aliases: ['Мука из твердых сортов пшеницы, вода питьевая.'] })],
    [tuple({ name: 'Спирали из твердых сортов пшеницы', aliases: ['Мука из твердых сортов пшеницы, вода питьевая.'] })]);
  assert.equal(pasta.added.length, 1); assert.equal(pasta.suspected.length, 0);
});

test('a safe product alias produces a review item, never an automatic merge', () => {
  const existing = tuple({ name: 'Творог рассыпчатый 5%', aliases: ['Творог традиционный 5%'] });
  const result = append([candidate({ name: 'Творог традиционный 5%' })], [existing]);
  assert.equal(result.added.length, 0); assert.equal(result.duplicates.length, 0);
  assert.deepEqual(result.suspected[0].reasons, ['alias_match']);
});

test('different explicit fat percentages, flavors and brands remain separate products', () => {
  const products = [candidate(), candidate({ name: 'Творог рассыпчатый 9%' }),
    candidate({ name: 'Йогурт греческий клубника 2%' }), candidate({ name: 'Йогурт греческий ваниль 2%' }),
    candidate({ brand: 'Другой бренд' })];
  const result = append(products);
  assert.equal(result.added.length, products.length); assert.equal(result.suspected.length, 0);
  assert.equal(new Set(result.added.map(row => row[0])).size, products.length);
});

test('import-only brand equivalents handle SVEŽA/Свежа, TEOS/Теос and Ganna/Ганна', () => {
  for (const [left, right] of [['SVEŽA', 'Свежа'], ['TEOS', 'Теос'], ['Ganna', 'Ганна']]) {
    assert.equal(canonicalManufacturerBrand(left), canonicalManufacturerBrand(right));
    const existing = tuple({ brand: left, name: `${left} Творог рассыпчатый 5%` });
    const result = append([candidate({ brand: right, name: `${right} Творог рассыпчатый 5%` })], [existing]);
    assert.equal(result.added.length, 0); assert.equal(result.duplicates.length, 1);
  }
});

test('new brand spellings are searchable through derived aliases without changing source candidates', () => {
  const foods = [candidate({ brand: 'SVEŽA' }), candidate({ brand: 'Ганна' })];
  const before = structuredClone(foods);
  const result = append(foods);
  const search = createSearch(result.added.map(row => ({
    id: row[0], name: row[1], brand: row[2], aliases: row[9], barcodes: row[10], market: row[11], sourceType: row[12],
  })));
  for (const query of ['Свежа', 'SVEZA', 'SVEŽA', 'svezha', 'Ганна', 'Ganna']) assert.equal(search(query).total, 1);
  assert.deepEqual(foods, before);
});

test('incomplete or impossible nutrition, wrong country, bad GTIN and missing source evidence are rejected', () => {
  const bad = [candidate({ nutrition: { ...nutrition, basis: undefined } }),
    candidate({ nutrition: { ...nutrition, basis: '100ml' } }),
    candidate({ nutrition: { ...nutrition, protein: undefined } }),
    candidate({ nutrition: { ...nutrition, fat: 120 } }),
    candidate({ manufacturerCountry: 'RU' }), candidate({ manufacturer: '' }),
    candidate({ barcodes: ['4810268031794'] }), candidate({ brand: '' }),
    candidate({ source: { ...candidate().source, url: 'http://manufacturer.example/product/' } }),
    candidate({ source: { ...candidate().source, manufacturerEvidenceUrl: undefined } }),
    candidate({ source: { ...candidate().source, checkedAt: 'yesterday' } }),
    candidate({ source: { ...candidate().source, basisText: 'На 100 мл' } }),
    candidate({ source: { ...candidate().source, basisText: '' } })];
  const result = append(bad);
  assert.equal(result.rejected.length, bad.length); assert.equal(result.rows.length, 0);
  assert.ok(result.rejected.every((report, index) => report.candidateIndex === index && report.reasons.length > 0));
});

test('checkedAt accepts real date-only values and ISO timestamps but rejects impossible calendar dates', () => {
  for (const checkedAt of ['2026-10-29', '2026-10-29T12:00:00Z', '2026-10-29T12:00:00.000+03:00']) {
    const result = append([candidate({ source: { ...candidate().source, checkedAt } })]);
    assert.equal(result.added.length, 1, checkedAt);
  }
  for (const checkedAt of ['2026-02-30', '2026-02-30T12:00:00Z', '2026-13-01', '2026-10-29T25:00:00Z']) {
    const result = append([candidate({ source: { ...candidate().source, checkedAt } })]);
    assert.equal(result.rejected.length, 1, checkedAt);
    assert.ok(result.rejected[0].reasons.includes('invalid_checked_at'));
  }
});

test('IDs are deterministic for family URLs and accepted candidates can be joined to provenance', () => {
  const first = candidate(), second = candidate({ name: 'Творог рассыпчатый 9%' });
  const id = manufacturerFoodId(first);
  assert.match(id, /^manufacturer-[a-f0-9]{20}$/);
  assert.equal(manufacturerFoodId({ ...first, aliases: ['Дополнительный alias'] }), id);
  assert.notEqual(manufacturerFoodId(second), id);
  const forward = append([first, second]), reverse = append([second, first]);
  assert.deepEqual(forward.added.map(row => row[0]).sort(), reverse.added.map(row => row[0]).sort());
  assert.ok(forward.added.every(row => [first, second].some(food => manufacturerFoodId(food) === row[0])));
  const again = append([first, second], forward.rows);
  assert.equal(again.added.length, 0); assert.equal(again.duplicates.length, 2);
  assert.deepEqual(again.rows, forward.rows);
});

test('new GTIN and identity matches are indexed within the same append operation', () => {
  const result = append([candidate({ barcodes: ['4810268031793'] }),
    candidate({ name: 'Совсем иное название', barcodes: ['04810268031793'] }),
    candidate({ name: 'Творог рассыпчатый 5% 400 г' })]);
  assert.equal(result.added.length, 1); assert.equal(result.duplicates.length, 2);
  assert.ok(result.duplicates.every(report => report.matchingIds[0] === result.added[0][0]));
});
