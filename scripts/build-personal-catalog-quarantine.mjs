import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildPersonalCatalogQuarantine, PERSONAL_CATALOG_MASS_CONTRADICTION_IDS, BASIS_CONTRADICTION_IDS } from './lib/personalCatalogQuarantine.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const runtimePath = path.join(root, 'public/nutrition-catalog/personal/products.json');
const auditPath = path.join(root, 'artifacts/nutrition-catalog-audit-2026-10-29/nutrition.json');
const liveAuditPath = path.join(root, 'artifacts/nutrition-catalog-audit-2026-10-29/live-samples.json');
const outputPath = path.join(root, 'public/nutrition-catalog/personal/quarantine.json');
const digest = value => crypto.createHash('sha256').update(value).digest('hex');

export function generatePersonalCatalogQuarantine({ apply = false } = {}) {
  const raw = fs.readFileSync(runtimePath, 'utf8');
  const rows = JSON.parse(raw);
  let auditEvidence = null;
  if (fs.existsSync(auditPath)) {
    const auditRaw = fs.readFileSync(auditPath, 'utf8'), audit = JSON.parse(auditRaw);
    const ids = audit.records.filter(record => record.recordStatus === 'внутреннее_противоречие_данных'
      && record.findings.some(finding => finding.code === 'macro_mass_above_100_exceeds_rounding')).map(record => record.id).sort();
    assert.deepEqual(ids, [...PERSONAL_CATALOG_MASS_CONTRADICTION_IDS].sort(), 'Список противоречий массы в аудите изменился: нужна явная проверка политики.');
    assert.equal(digest(JSON.stringify(rows.slice(0, audit.baseline.count))), audit.baseline.rowsSha256, 'Исходный baseline изменён.');
    auditEvidence = { path: 'artifacts/nutrition-catalog-audit-2026-10-29/nutrition.json', sha256: digest(auditRaw),
      findingCode: 'macro_mass_above_100_exceeds_rounding', ids };
  }
  let basisAuditEvidence = null;
  if (fs.existsSync(liveAuditPath)) {
    const liveRaw = fs.readFileSync(liveAuditPath, 'utf8'), live = JSON.parse(liveRaw);
    const checks = BASIS_CONTRADICTION_IDS.map(id => {
      const check = live.checks.find(record => record.id === id);
      assert.ok(check?.basisMismatch && check.localNutrition.basis === '100g'
        && check.sourceSnapshot.nutrition.aggregated_set.per === '100ml', `Не подтверждено расхождение базиса ${id}.`);
      return { id, checkedAt: check.checkedAt, endpoint: check.endpoint, catalogueBasis: '100g', sourceBasis: '100ml' };
    });
    basisAuditEvidence = { path: 'artifacts/nutrition-catalog-audit-2026-10-29/live-samples.json', sha256: digest(liveRaw), checks };
  }
  const additionalIds = [...PERSONAL_CATALOG_MASS_CONTRADICTION_IDS];
  const sidecar = buildPersonalCatalogQuarantine(rows, { additionalIds });
  assert.equal(sidecar.unmatchedAdditionalIds.length, 0, 'В каталоге отсутствует обязательный ID карантина.');
  assert.ok(BASIS_CONTRADICTION_IDS.every(id => sidecar.reasonsById[id]?.includes('nutrition_basis_mismatch')), 'В каталоге отсутствует ID с противоречием базиса.');
  const document = {
    ...sidecar,
    catalogue: { url: '/nutrition-catalog/personal/products.json', count: rows.length,
      rowsSha256: digest(JSON.stringify(rows)), fileSha256: digest(raw) },
    auditEvidence,
    basisAuditEvidence,
    notesRussian: [
      'Карантин ограничивает выдачу персонального каталога; карточки, их поля, порядок и идентификаторы не удалены и не изменены.',
      'Дневники, история питания и «Мои продукты» этим скриптом не читаются и не изменяются.',
      'Совпадения причин учтены объединением по ID; каждая причина сохраняется отдельно.',
      'Квас sku-4810285009027 исключён отдельной причиной nutrition_basis_mismatch: текущий структурированный OFF указывает 100 мл вместо сохранённых 100 г. КБЖУ, история и базис карточки не исправлялись.',
    ],
  };
  const serialized = `${JSON.stringify(document, null, 2)}\n`;
  if (apply) fs.writeFileSync(outputPath, serialized);
  assert.equal(digest(fs.readFileSync(runtimePath)), digest(raw), 'Исходные compact tuples изменились во время генерации.');
  const summary = { modeRussian: apply ? 'Записан только sidecar карантина' : 'Предварительная проверка: файлы не записывались',
    output: outputPath, counts: sidecar.counts, quarantineSha256: digest(serialized), catalogueFileSha256: digest(raw),
    originalRowsPreserved: true };
  console.log(JSON.stringify(summary, null, 2));
  return { document, summary };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = new Set(process.argv.slice(2));
  assert.ok([...args].every(arg => ['--apply', '--dry-run'].includes(arg)), 'Поддерживаются только --apply и --dry-run.');
  assert.ok(!(args.has('--apply') && args.has('--dry-run')), 'Выберите один режим.');
  generatePersonalCatalogQuarantine({ apply: args.has('--apply') });
}
