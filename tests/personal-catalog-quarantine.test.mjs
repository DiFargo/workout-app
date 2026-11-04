import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  buildPersonalCatalogQuarantine, isPersonalCatalogRowSearchable, PERSONAL_CATALOG_MASS_CONTRADICTION_IDS, BASIS_CONTRADICTION_IDS,
} from '../scripts/lib/personalCatalogQuarantine.mjs';

function tuple(id, { sourceType = 'openfoodfacts', basis = '100g', conflict = false } = {}) {
  return [id, `Продукт ${id}`, 'Бренд', 'Категория', 100, 10, 4, 6, basis, ['alias'], [], 'unknown', sourceType, conflict, null];
}
const hash = value => crypto.createHash('sha256').update(value).digest('hex');

test('quarantine is a union by ID, preserving all overlapping reasons', () => {
  const rows = [tuple('gemini', { sourceType: 'gemini', basis: 'unknown' }), tuple('conflict', { conflict: true }),
    tuple('overlap', { sourceType: 'gemini', basis: 'unknown', conflict: true }), tuple('mass'), tuple('safe')];
  const result = buildPersonalCatalogQuarantine(rows, { additionalIds: ['mass', 'overlap', 'mass'] });
  assert.equal(result.schemaVersion, 1); assert.equal(result.counts.quarantinedIds, 4); assert.equal(result.counts.searchableRows, 1);
  assert.deepEqual(result.counts.byReason, { gemini_unknown_basis: 2, nutrition_conflict: 2, macro_mass_contradiction: 2, nutrition_basis_mismatch: 0 });
  assert.equal(result.counts.multipleReasons, 1);
  assert.deepEqual(result.reasonsById.overlap, ['gemini_unknown_basis', 'nutrition_conflict', 'macro_mass_contradiction']);
});

test('catalogue IDs, nested fields, tuple lengths and order remain untouched', () => {
  const rows = [tuple('unknown', { sourceType: 'gemini', basis: 'unknown' }), tuple('safe')];
  const before = structuredClone(rows), references = [...rows];
  buildPersonalCatalogQuarantine(rows);
  assert.deepEqual(rows, before); assert.ok(rows.every((row, index) => row === references[index]));
});

test('output is deterministic for reordered rows and repeated additional ids', () => {
  const rows = [tuple('b', { conflict: true }), tuple('a', { sourceType: 'gemini', basis: 'unknown' }), tuple('c')];
  const a = buildPersonalCatalogQuarantine(rows, { additionalIds: ['c', 'c'] });
  const b = buildPersonalCatalogQuarantine([...rows].reverse(), { additionalIds: new Set(['c']) });
  assert.deepEqual(a, b); assert.equal(hash(JSON.stringify(a)), hash(JSON.stringify(b)));
});

test('only specified source/basis combinations are quarantined, not all AI or unknown-basis rows', () => {
  for (const row of [tuple('manufacturer', { sourceType: 'manufacturer' }), tuple('off'),
    tuple('gemini-known', { sourceType: 'gemini' }), tuple('off-unknown', { basis: 'unknown' }),
    tuple('manufacturer-unknown', { sourceType: 'manufacturer', basis: 'unknown' })]) {
    assert.equal(isPersonalCatalogRowSearchable(row), true);
  }
  assert.equal(isPersonalCatalogRowSearchable(tuple('gemini-unknown', { sourceType: 'gemini', basis: 'unknown' })), false);
  assert.equal(isPersonalCatalogRowSearchable(tuple('manufacturer-conflict', { sourceType: 'manufacturer', conflict: true })), false);
});

test('browser-safe search predicate supports compact tuples, worker objects and an optional ID set', () => {
  assert.equal(isPersonalCatalogRowSearchable({ id: 'object-gemini', sourceType: 'gemini', nutrition: { basis: 'unknown' } }), false);
  assert.equal(isPersonalCatalogRowSearchable({ id: 'object-conflict', nutritionConflict: true, nutrition: { basis: '100g' } }), false);
  assert.equal(isPersonalCatalogRowSearchable({ id: 'safe', sourceType: 'manufacturer', basis: '100g' }), true);
  assert.equal(isPersonalCatalogRowSearchable(tuple('manual'), new Set(['manual'])), false);
  assert.equal(isPersonalCatalogRowSearchable(tuple('manual'), ['manual']), false);
  assert.equal(isPersonalCatalogRowSearchable(tuple('safe'), buildPersonalCatalogQuarantine([tuple('safe')], { additionalIds: ['safe'] })), false);
  assert.equal(isPersonalCatalogRowSearchable(null), false);
  const source = fs.readFileSync(new URL('../scripts/lib/personalCatalogQuarantine.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /(?:node:|\bfetch\s*\(|\brequire\s*\()/);
});

test('all five audited mass contradictions are excluded by default without excluding every 100ml product', () => {
  assert.equal(PERSONAL_CATALOG_MASS_CONTRADICTION_IDS.length, 5);
  for (const id of PERSONAL_CATALOG_MASS_CONTRADICTION_IDS) {
    assert.equal(isPersonalCatalogRowSearchable(tuple(id)), false);
    assert.equal(isPersonalCatalogRowSearchable(tuple(id), new Set()), false);
  }
  assert.equal(buildPersonalCatalogQuarantine(PERSONAL_CATALOG_MASS_CONTRADICTION_IDS.map(id => tuple(id))).counts.quarantinedIds, 5);
  assert.equal(isPersonalCatalogRowSearchable(tuple('kvass-100ml', { basis: '100ml' })), true);
});

test('the live OFF kvass basis mismatch has its own reason, not a mass contradiction', () => {
  assert.deepEqual(BASIS_CONTRADICTION_IDS, ['sku-4810285009027']);
  assert.ok(Object.isFrozen(BASIS_CONTRADICTION_IDS));
  const kvass = tuple('sku-4810285009027');
  const before = structuredClone(kvass);
  assert.equal(isPersonalCatalogRowSearchable(kvass), false);
  assert.equal(isPersonalCatalogRowSearchable(kvass, new Set()), false);
  assert.equal(isPersonalCatalogRowSearchable({ id: kvass[0], sourceType: 'openfoodfacts', nutrition: { basis: '100g' } }), false);
  const result = buildPersonalCatalogQuarantine([kvass]);
  assert.deepEqual(result.reasonsById[kvass[0]], ['nutrition_basis_mismatch']);
  assert.equal(result.counts.byReason.macro_mass_contradiction, 0);
  assert.equal(result.counts.byReason.nutrition_basis_mismatch, 1);
  assert.deepEqual(kvass, before);
});

test('frozen baseline keeps 2701 unique quarantined IDs because the kvass already has a source conflict', () => {
  const current = JSON.parse(fs.readFileSync(new URL('../public/nutrition-catalog/personal/products.json', import.meta.url)));
  const result = buildPersonalCatalogQuarantine(current.slice(0, 10000));
  assert.equal(result.counts.quarantinedIds, 2701);
  assert.deepEqual(result.counts.byReason, { gemini_unknown_basis: 2584, nutrition_conflict: 114, macro_mass_contradiction: 5, nutrition_basis_mismatch: 1 });
  assert.equal(result.counts.multipleReasons, 3);
  assert.deepEqual(result.reasonsById['gemini-13'], ['gemini_unknown_basis', 'nutrition_conflict']);
  assert.deepEqual(result.reasonsById['gemini-522'], ['gemini_unknown_basis', 'nutrition_conflict']);
  assert.deepEqual(result.reasonsById['sku-4810285009027'], ['nutrition_conflict', 'nutrition_basis_mismatch']);
  assert.ok(current.filter(row => row[12] === 'manufacturer').every(row => isPersonalCatalogRowSearchable(row)));
});

test('CLI defaults to dry-run and does not write catalogue or quarantine files', () => {
  const runtimePath = new URL('../public/nutrition-catalog/personal/products.json', import.meta.url);
  const quarantinePath = new URL('../public/nutrition-catalog/personal/quarantine.json', import.meta.url);
  const beforeCatalogue = hash(fs.readFileSync(runtimePath));
  const beforeSidecar = fs.existsSync(quarantinePath) ? hash(fs.readFileSync(quarantinePath)) : null;
  const run = spawnSync(process.execPath, [fileURLToPath(new URL('../scripts/build-personal-catalog-quarantine.mjs', import.meta.url))], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  const summary = JSON.parse(run.stdout);
  assert.match(summary.modeRussian, /не записывались/); assert.equal(summary.counts.quarantinedIds, 2701);
  assert.equal(hash(fs.readFileSync(runtimePath)), beforeCatalogue);
  assert.equal(fs.existsSync(quarantinePath) ? hash(fs.readFileSync(quarantinePath)) : null, beforeSidecar);
});
