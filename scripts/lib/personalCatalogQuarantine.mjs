// Browser-safe policy. This file performs no I/O and never changes catalogue rows.
export const PERSONAL_CATALOG_MASS_CONTRADICTION_IDS = Object.freeze([
  'sku-4607002754304',
  'sku-4607051705296',
  'sku-4690469015361',
  'sku-4603773308869',
  'sku-4650060003662',
]);
export const BASIS_CONTRADICTION_IDS = Object.freeze(['sku-4810285009027']);

const defaultMassIds = new Set(PERSONAL_CATALOG_MASS_CONTRADICTION_IDS);
const defaultBasisIds = new Set(BASIS_CONTRADICTION_IDS);
export const PERSONAL_CATALOG_QUARANTINE_REASONS = Object.freeze({
  gemini_unknown_basis: 'Карточка из списка Gemini: масса или объём, к которым относятся КБЖУ, не подтверждены.',
  nutrition_conflict: 'В сохранённых источниках карточки уже отмечено расхождение КБЖУ.',
  macro_mass_contradiction: 'Аудит исходной карточки выявил противоречие суммы БЖУ заявленному базису 100 г, не объяснимое моделью округления.',
  nutrition_basis_mismatch: 'В каталоге указан базис 100 г, а проверенный текущий структурированный источник указывает 100 мл. Пересчёт без плотности не выполнялся.',
});

function fields(row) {
  if (Array.isArray(row)) return { id: row[0], basis: row[8], sourceType: row[12], nutritionConflict: row[13] };
  return { id: row?.id, basis: row?.nutrition?.basis ?? row?.basis, sourceType: row?.sourceType, nutritionConflict: row?.nutritionConflict };
}

function hasId(collection, id) {
  if (collection instanceof Set) return collection.has(id);
  if (Array.isArray(collection)) return collection.includes(id);
  return Boolean(collection?.reasonsById && Object.hasOwn(collection.reasonsById, id));
}

function quarantineReasons(row, additionalIds) {
  const item = fields(row), reasons = [];
  if (item.sourceType === 'gemini' && item.basis === 'unknown') reasons.push('gemini_unknown_basis');
  if (item.nutritionConflict === true) reasons.push('nutrition_conflict');
  if (defaultMassIds.has(item.id) || hasId(additionalIds, item.id)) reasons.push('macro_mass_contradiction');
  if (defaultBasisIds.has(item.id)) reasons.push('nutrition_basis_mismatch');
  return reasons;
}

/** Apply only to personal-catalogue search rows, never diaries or MyFoods. */
export function isPersonalCatalogRowSearchable(row, quarantinedIds = defaultMassIds) {
  const { id } = fields(row);
  return typeof id === 'string' && id.length > 0 && quarantineReasons(row, quarantinedIds).length === 0;
}

/** Stable, ID-keyed sidecar data; input tuples, values and order are untouched. */
export function buildPersonalCatalogQuarantine(rows, { additionalIds = [] } = {}) {
  if (!Array.isArray(rows)) throw new TypeError('rows must be an array');
  if (!(Array.isArray(additionalIds) || additionalIds instanceof Set)) throw new TypeError('additionalIds must be an array or Set');
  const additional = new Set(additionalIds);
  if ([...additional].some(id => typeof id !== 'string' || !id)) throw new TypeError('additionalIds must contain nonempty string ids');
  const seen = new Set(), selected = new Map();
  for (const row of rows) {
    const { id } = fields(row);
    if (typeof id !== 'string' || !id || seen.has(id)) throw new TypeError('Catalogue rows must have unique nonempty string ids');
    seen.add(id);
    const reasons = quarantineReasons(row, additional);
    if (reasons.length) selected.set(id, reasons);
  }
  const ids = [...selected.keys()].sort();
  const reasonsById = Object.fromEntries(ids.map(id => [id, selected.get(id)]));
  const byReason = Object.fromEntries(Object.keys(PERSONAL_CATALOG_QUARANTINE_REASONS)
    .map(reason => [reason, ids.filter(id => reasonsById[id].includes(reason)).length]));
  return {
    schemaVersion: 1,
    policy: 'personal-catalog-search-only',
    counts: { catalogRows: rows.length, quarantinedIds: ids.length, searchableRows: rows.length - ids.length,
      byReason, multipleReasons: ids.filter(id => reasonsById[id].length > 1).length },
    ids,
    reasonsById,
    reasonDefinitions: { ...PERSONAL_CATALOG_QUARANTINE_REASONS },
    unmatchedAdditionalIds: [...additional].filter(id => !seen.has(id)).sort(),
  };
}
