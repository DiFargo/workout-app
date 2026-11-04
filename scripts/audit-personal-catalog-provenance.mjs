import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

// Read-only аудит каталогов. Единственный выход — отдельный JSON-отчёт.
// Совпадение локальных чисел не является независимой проверкой этикетки.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const asOf = '2026-10-29T00:00:00.000Z';
const asOfMs = Date.parse(asOf);
const reportPath = 'artifacts/nutrition-catalog-audit-2026-10-29/provenance.json';
const inputPaths = {
  runtime: 'public/nutrition-catalog/personal/products.json',
  baseline: 'output/belarus-products-10000/products.json',
  baselineManifest: 'output/belarus-products-10000/manifest.json',
  openfoodfacts: 'public/nutrition-catalog/sku/foods.full.json',
  gemini: 'output/gemini-products-new/products.json',
};
const checkOnly = process.argv.includes('--check');
if (process.argv.slice(2).some(arg => arg !== '--check')) throw new Error('Допустим только аргумент --check');
const inputs = Object.fromEntries(Object.entries(inputPaths).map(([key, relative]) => {
  const bytes = fs.readFileSync(path.join(root, relative));
  return [key, { path: relative, sha256: crypto.createHash('sha256').update(bytes).digest('hex'), value: JSON.parse(bytes) }];
}));
const { value: baseline } = inputs.baseline;
const { value: runtime } = inputs.runtime;
if (!Array.isArray(baseline) || baseline.length !== 10000) throw new Error('Ожидалась исходная база ровно из 10000 карточек');
if (!Array.isArray(runtime)) throw new Error('Runtime-каталог не является массивом');

const canonical = value => JSON.stringify(value, (_, v) => v && typeof v === 'object' && !Array.isArray(v)
  ? Object.fromEntries(Object.keys(v).sort().map(key => [key, v[key]])) : v);
const equal = (a, b) => canonical(a) === canonical(b);
const tally = (values) => values.reduce((result, value) => {
  result[String(value)] = (result[String(value)] ?? 0) + 1;
  return result;
}, {});
const unique = values => [...new Set(values)];
const mapById = values => new Map(values.map(value => [String(value.id), value]));
const offById = mapById(inputs.openfoodfacts.value);
const geminiById = mapById(inputs.gemini.value);
const runtimeById = new Map();
runtime.forEach((row, index) => {
  if (!Array.isArray(row)) return;
  const id = String(row[0]);
  const previous = runtimeById.get(id) ?? [];
  previous.push({ row, index });
  runtimeById.set(id, previous);
});
const sourceType = source => source?.kind === 'Open Food Facts' ? 'openfoodfacts'
  : source?.kind === 'Gemini dialogue supplied by user' ? 'gemini' : 'unknown';
const nutritionKey = value => canonical(Object.fromEntries(['basis', 'kcal', 'protein', 'fat', 'carbs'].map(key => [key, value?.[key]])));
const isHttpUrl = value => {
  try { return ['http:', 'https:'].includes(new URL(value).protocol); } catch { return false; }
};
const date = value => {
  const ms = typeof value === 'string' && value ? Date.parse(value) : NaN;
  return Number.isFinite(ms) ? { value, ageDays: Math.floor((asOfMs - ms) / 86400000), future: ms > asOfMs } : null;
};
const ageBucket = value => !value ? 'no_date' : value.future ? 'future_date'
  : value.ageDays <= 90 ? '0_90_days' : value.ageDays <= 365 ? '91_365_days'
    : value.ageDays <= 1095 ? '366_1095_days' : 'over_1095_days';
const latest = values => values.filter(Boolean).sort().at(-1) ?? null;
const oldest = values => values.filter(Boolean).sort()[0] ?? null;
const expectedRuntime = row => [row.id, row.name, row.brand, row.category,
  row.nutrition.kcal, row.nutrition.protein, row.nutrition.fat, row.nutrition.carbs,
  row.nutrition.basis, row.aliases, row.barcodes, row.market, row.sourceType,
  !!row.nutritionConflict, row.sources?.[0]?.url ?? null];
const runtimeFields = ['id', 'name', 'brand', 'category', 'kcal', 'protein', 'fat', 'carbs',
  'basis', 'aliases', 'barcodes', 'market', 'sourceType', 'nutritionConflict', 'sourceUrl'];

const records = baseline.map((row, baselineIndex) => {
  const issues = [];
  const addIssue = (code, severity, message, detail) => issues.push({ code, severity, message, ...(detail ? { detail } : {}) });
  const matches = runtimeById.get(String(row.id)) ?? [];
  const runtimeMatch = matches[0];
  const compact = runtimeMatch?.row;
  const expected = expectedRuntime(row);
  const runtimeMismatchedFields = runtimeFields.filter((_, index) => !compact || !equal(compact[index], expected[index]));
  if (!runtimeMatch) addIssue('runtime_record_missing', 'error', 'Исходная карточка отсутствует в текущем runtime');
  if (matches.length > 1) addIssue('duplicate_runtime_id', 'error', 'ID встречается в runtime несколько раз', { indices: matches.map(match => match.index) });
  if (runtimeMatch && runtimeMatch.index !== baselineIndex) addIssue('baseline_prefix_position_changed', 'error', 'Карточка не находится на своей позиции исходного префикса');
  if (runtimeMismatchedFields.length) addIssue('runtime_baseline_transfer_mismatch', 'error', 'Runtime отличается от полного baseline', { fields: runtimeMismatchedFields });
  if (compact && compact.length !== runtimeFields.length) addIssue('runtime_tuple_length_mismatch', 'error', 'Длина compact-кортежа отличается от исходного контракта');

  const memberAudits = (row.members ?? []).map(member => {
    const type = sourceType(member.source);
    const originalId = type === 'gemini' ? String(member.source?.recordId ?? member.id.replace(/^gemini-/, '')) : String(member.id);
    const original = type === 'openfoodfacts' ? offById.get(originalId) : type === 'gemini' ? geminiById.get(originalId) : undefined;
    const expectedNutrition = original ? type === 'openfoodfacts'
      ? { basis: '100g', kcal: original.calories, protein: original.protein, fat: original.fat, carbs: original.carbs }
      : { basis: 'unknown', kcal: original.cal, protein: original.p, fat: original.f, carbs: original.c } : null;
    const mismatchedFields = [];
    if (original) {
      for (const field of ['name', 'brand']) if (!equal(member[field], original[field])) mismatchedFields.push(field);
      for (const field of ['basis', 'kcal', 'protein', 'fat', 'carbs']) {
        if (!equal(member.nutrition?.[field], expectedNutrition[field])) mismatchedFields.push(`nutrition.${field}`);
      }
      if (type === 'openfoodfacts') {
        for (const field of ['barcode', 'quantity']) if (!equal(member[field], original[field])) mismatchedFields.push(field);
        if (!equal(member.source, original.source)) mismatchedFields.push('source');
      } else {
        const expectedSource = { kind: 'Gemini dialogue supplied by user', recordId: String(original.id), file: '../gemini-products-new/products.json' };
        if (!equal(member.source, expectedSource)) mismatchedFields.push('source');
      }
    }
    if (type === 'unknown') addIssue('member_source_type_unknown', 'error', 'Не распознан тип источника member', { memberId: member.id });
    if (!original) addIssue('original_member_missing', 'error', 'Не найден локальный оригинал member', { memberId: member.id, originalId });
    if (mismatchedFields.length) addIssue('member_original_transfer_mismatch', 'error', 'Member отличается от локального оригинала', { memberId: member.id, fields: mismatchedFields });
    const source = member.source ?? {};
    const originalVerification = original?.verification ?? null;
    const retrievedAt = date(source.retrievedAt);
    const sourceUpdatedAt = date(source.sourceUpdatedAt);
    const metadataVerifiedAt = date(originalVerification?.verifiedAt);
    for (const [field, parsed] of [['retrievedAt', retrievedAt], ['sourceUpdatedAt', sourceUpdatedAt]]) {
      if (source[field] && !parsed) addIssue('invalid_source_date', 'review', 'Некорректная дата в метаданных источника', { memberId: member.id, field, value: source[field] });
      if (parsed?.future) addIssue('future_source_date', 'review', 'Дата источника позднее даты аудита', { memberId: member.id, field, value: source[field] });
    }
    if (retrievedAt && sourceUpdatedAt && Date.parse(sourceUpdatedAt.value) > Date.parse(retrievedAt.value)) {
      addIssue('source_updated_after_retrieval', 'review', 'Дата изменения источника позднее даты локального получения', { memberId: member.id });
    }
    // basisUnit:g не доказывает единицу этикетки: build-nutrition-catalog.mjs задаёт его константой.
    // В сохранённых original source нет сырой единицы этикетки, плотности или её проверенного фото.
    const unitProvenanceStatus = type === 'openfoodfacts' ? 'off_normalized_values_label_unit_not_recoverable'
      : type === 'gemini' ? 'ai_dialogue_basis_unknown' : 'source_unit_unknown';
    return {
      id: member.id,
      sourceType: type,
      originalId,
      originalFound: !!original,
      originalFile: type === 'openfoodfacts' ? inputPaths.openfoodfacts : type === 'gemini' ? inputPaths.gemini : null,
      originalMismatchedFields: mismatchedFields,
      nutrition: member.nutrition,
      originalNutrition: expectedNutrition,
      numericTransferMatchesOriginal: !!original && !mismatchedFields.some(field => /^nutrition\.(kcal|protein|fat|carbs)$/.test(field)),
      source: {
        kind: source.kind ?? null, recordId: source.recordId ?? null,
        url: source.url ?? null, hasHttpUrl: isHttpUrl(source.url), file: source.file ?? null,
        retrievedAt: source.retrievedAt ?? null, sourceUpdatedAt: source.sourceUpdatedAt ?? null,
        metadataVerifiedAt: originalVerification?.verifiedAt ?? null,
        importedVerificationStatus: originalVerification?.status ?? null,
        importedVerificationMethod: originalVerification?.method ?? null,
        license: source.license ?? null,
        independentLabelCheckPerformed: false,
      },
      provenanceCompleteness: type === 'openfoodfacts'
        ? (isHttpUrl(source.url) && retrievedAt && sourceUpdatedAt && source.recordId && source.license
          ? 'community_metadata_complete_not_label_verified' : 'community_metadata_incomplete')
        : type === 'gemini' ? 'local_ai_lineage_only_primary_source_missing' : 'unknown_source',
      unitProvenanceStatus,
      originalBasisUnit: original?.basisUnit ?? null,
      explicitLabelUnitEvidence: null,
      sourceCurrentness: {
        sourceUpdatedAgeDays: sourceUpdatedAt?.ageDays ?? null,
        sourceUpdatedAgeBucket: ageBucket(sourceUpdatedAt),
        retrievedAgeDays: retrievedAt?.ageDays ?? null,
        metadataVerifiedAgeDays: metadataVerifiedAt?.ageDays ?? null,
        liveCurrentnessVerified: false,
      },
    };
  });
  if (!memberAudits.length) addIssue('members_missing', 'error', 'У карточки отсутствуют исходные members');
  const selected = memberAudits.find(member => member.id === row.id);
  const selectedRaw = row.members?.find(member => member.id === row.id);
  if (!selectedRaw) addIssue('selected_member_missing', 'error', 'ID карточки не найден среди members');
  const selectedMemberMismatchedFields = [];
  if (selectedRaw) {
    if (!equal(row.name, selectedRaw.name?.trim())) selectedMemberMismatchedFields.push('name');
    if (!equal(row.brand, selectedRaw.brand?.trim())) selectedMemberMismatchedFields.push('brand');
    if (nutritionKey(row.nutrition) !== nutritionKey(selectedRaw.nutrition)) selectedMemberMismatchedFields.push('nutrition');
    if (row.sourceType !== sourceType(selectedRaw.source)) selectedMemberMismatchedFields.push('sourceType');
  }
  if (selectedMemberMismatchedFields.length) addIssue('selected_member_transfer_mismatch', 'error', 'Полная карточка не совпадает с выбранным member', { fields: selectedMemberMismatchedFields });
  const memberSourcesMatch = equal(row.sources, (row.members ?? []).map(member => member.source));
  if (!memberSourcesMatch) addIssue('source_member_list_mismatch', 'error', 'Список sources не совпадает с источниками members');
  const expectedBarcodes = unique((row.members ?? []).map(member => member.barcode).filter(Boolean));
  if (!equal(row.barcodes, expectedBarcodes)) addIssue('merged_barcode_transfer_mismatch', 'error', 'Штрихкоды карточки отличаются от объединения members');
  const nutritionGroups = [...new Map((row.members ?? []).map(member => [nutritionKey(member.nutrition), member.nutrition])).values()];
  const conflictDetected = nutritionGroups.length > 1;
  if (conflictDetected !== !!row.nutritionConflict) addIssue('conflict_flag_mismatch', 'error', 'Флаг конфликта не соответствует сохранённым значениям members');
  if (conflictDetected) addIssue('conflicting_member_nutrition', 'review', 'Объединённые members содержат разные КБЖУ или базу расчёта');
  if (row.sourceType === 'gemini') addIssue('ai_dialogue_not_primary_source', 'review', 'Диалог Gemini не является первичным источником состава продукта');
  if (row.nutrition.basis === 'unknown') addIssue('nutrition_basis_unknown', 'review', 'База расчёта не подтверждена: эти значения нельзя считать проверенными на 100 г');
  if (row.sourceType === 'openfoodfacts') addIssue('off_label_unit_not_recoverable', 'review', 'Нормализованные числа OFF; единица этикетки не восстановлена. Суффикс _100g может относиться к 100 мл жидкости');
  addIssue('no_independent_label_verification', 'review', 'Этикетка или официальный источник производителя независимо не проверялись; локальное совпадение чисел не доказывает правильность продукта');
  if (memberAudits.some(member => !member.source.hasHttpUrl)) addIssue('members_without_primary_url', 'review', 'Есть members без внешнего URL; локальный путь к диалогу не заменяет первичный источник');
  if (memberAudits.some(member => !member.source.sourceUpdatedAt)) addIssue('source_currentness_date_missing', 'review', 'Для части источников нет даты изменения; актуальность по дате не оценивается');
  const allOriginalsMatch = memberAudits.every(member => member.originalFound && !member.originalMismatchedFields.length);
  const integrityErrors = issues.filter(issue => issue.severity === 'error');
  const classification = integrityErrors.length ? 'local_integrity_error'
    : conflictDetected ? 'unverified_conflicting_members'
      : row.nutrition.basis === 'unknown' ? 'ai_dialogue_unknown_basis_unverified'
        : 'off_normalized_values_label_unit_unverified';
  const updatedDates = memberAudits.map(member => member.source.sourceUpdatedAt);
  const retrievedDates = memberAudits.map(member => member.source.retrievedAt);
  const selectedUpdated = date(selected?.source.sourceUpdatedAt);
  return {
    id: row.id, baselineIndex, runtimeIndex: runtimeMatch?.index ?? null,
    name: row.name, brand: row.brand, sourceType: row.sourceType,
    memberSourceTypes: unique(memberAudits.map(member => member.sourceType)),
    classification,
    sourceEvidenceClass: row.sourceType === 'openfoodfacts' ? 'community_database' : 'ai_user_dialogue',
    independentlyVerified: false,
    declaredRuntimeNutritionBasis: compact?.[8] ?? null,
    unitProvenanceStatus: selected?.unitProvenanceStatus ?? 'source_unit_unknown',
    unitProvenanceStatusLabel: row.sourceType === 'openfoodfacts'
      ? 'Нормализованные числа OFF; единица этикетки не восстановлена'
      : 'Диалог Gemini; база расчёта неизвестна',
    runtimeProvenance: {
      hasHttpUrl: isHttpUrl(compact?.[14]), sourceUrl: compact?.[14] ?? null,
      datesRetained: false, memberDetailsRetained: false,
      completeness: isHttpUrl(compact?.[14]) ? 'source_type_and_selected_url_only' : 'source_type_only',
    },
    transfer: {
      runtimeMatchesBaseline: !runtimeMismatchedFields.length && compact?.length === runtimeFields.length,
      runtimeMismatchedFields, selectedMemberMatchesCard: !selectedMemberMismatchedFields.length && !!selectedRaw,
      allMembersMatchOriginals: allOriginalsMatch, sourceListsMatchMembers: memberSourcesMatch,
      numericTransferMatchesOriginals: memberAudits.every(member => member.numericTransferMatchesOriginal),
    },
    conflict: { detected: conflictDetected, storedFlag: !!row.nutritionConflict, nutritionGroups },
    provenanceCompleteness: selected?.provenanceCompleteness ?? 'unknown_source',
    sourceCurrentness: {
      asOf, selectedSourceUpdatedAt: selected?.source.sourceUpdatedAt ?? null,
      selectedSourceUpdatedAgeDays: selectedUpdated?.ageDays ?? null,
      selectedSourceUpdatedAgeBucket: ageBucket(selectedUpdated),
      oldestMemberUpdatedAt: oldest(updatedDates), latestMemberUpdatedAt: latest(updatedDates),
      oldestRetrievedAt: oldest(retrievedDates), latestRetrievedAt: latest(retrievedDates),
      missingMemberUpdateDates: updatedDates.filter(value => !value).length,
      liveCurrentnessVerified: false,
      interpretation: 'Возраст локальных метаданных; не срок годности и не доказательство текущей рецептуры',
    },
    members: memberAudits,
    issues,
  };
});

const allMembers = records.flatMap(record => record.members);
const sourceHashChecks = (inputs.baselineManifest.value.sourceFiles ?? []).map(source => ({
  path: source.path,
  expectedSha256: source.sha256,
  actualSha256: Object.values(inputs).find(input => input.path === source.path)?.sha256 ?? null,
  matches: Object.values(inputs).some(input => input.path === source.path && input.sha256 === source.sha256),
}));
const report = {
  schemaVersion: 1,
  title: 'Происхождение и точность переноса исходных 10000 карточек питания',
  asOf,
  scope: {
    baselineCount: baseline.length, runtimeCountAtRead: runtime.length,
    runtimeSuffixNotAuditedHere: Math.max(0, runtime.length - baseline.length),
    runtimeBaselinePrefixMatches: baseline.every((row, index) => runtime[index]?.[0] === row.id),
    noProductNetworkRequests: true, noProductionAccess: true, noProductDataModified: true,
    independentLabelChecksPerformed: 0,
  },
  inputs: Object.fromEntries(Object.entries(inputs).map(([key, input]) => [key, { path: input.path, sha256: input.sha256, ...(Array.isArray(input.value) ? { count: input.value.length } : {}) }])),
  sourceHashChecks,
  methodology: [
    'Каждая исходная карточка сверяется по ID и позиции с текущим runtime; сравниваются все 15 compact-полей.',
    'Каждый member сверяется с сохранённым OFF/Gemini-оригиналом по имени, бренду, четырём числам, базе расчёта и источнику; у OFF также по штрихкоду и фасовке.',
    'Флаги конфликтов пересчитываются по КБЖУ и базе всех members. Их наличие не исправляется этим аудитом.',
    'Даты retrievedAt, sourceUpdatedAt и imported verification.verifiedAt — локальные метаданные. Поле verifiedAt не считается независимой проверкой этикетки.',
    'OFF _100g означает нормализованные значения на 100 г или на 100 мл жидкости. Сохранённый basisUnit:g задан сборщиком и не восстанавливает единицу этикетки.',
    'Плотность и исходная база этикетки не восстанавливаются догадками. Все 7416 карточек OFF остаются с непроверенной единицей; все Gemini с unknown basis остаются непроверенными.',
    'Возраст источника описан диапазонами 0–90, 91–365, 366–1095 и более 1095 дней; это не оценка срока годности или доступности в продаже.',
    'Наличие URL, лицензии, штрихкода или совпадения с локальной копией OFF не означает подтверждения первичной этикетки.',
  ],
  documentation: [
    { url: 'https://openfoodfacts.github.io/documentation/docs/Product-Opener/schemas/schemas/product_nutrition/', checkedAt: '2026-10-29', finding: 'Схема OFF прямо допускает 100 мл жидкости в нормализованном поле _100g; единица ввода _unit также не обязательно совпадает с этикеткой.' },
    { path: 'scripts/import-openfoodfacts-catalog.mjs', finding: 'Числа _100g копируются в nutrition с константой basis:100g.' },
    { path: 'scripts/build-localized-nutrition-catalog.mjs', finding: 'Адаптер нормализованных данных OFF также задаёт basis:100g.' },
    { path: 'scripts/build-nutrition-catalog.mjs', finding: 'Выход foods.full.json записывает basisUnit:g константой.' },
  ],
  summary: {
    records: records.length, sourceTypes: tally(records.map(record => record.sourceType)),
    classifications: tally(records.map(record => record.classification)),
    unitProvenanceStatuses: tally(records.map(record => record.unitProvenanceStatus)),
    provenanceCompleteness: tally(records.map(record => record.provenanceCompleteness)),
    independentlyVerifiedRecords: 0,
    runtimeHasSourceUrl: records.filter(record => record.runtimeProvenance.hasHttpUrl).length,
    runtimeMissingSourceUrl: records.filter(record => !record.runtimeProvenance.hasHttpUrl).length,
    runtimeDatesOmitted: records.length,
    members: allMembers.length, memberSourceTypes: tally(allMembers.map(member => member.sourceType)),
    cardsWithMultipleMembers: records.filter(record => record.members.length > 1).length,
    cardsWithMixedSourceTypes: records.filter(record => record.memberSourceTypes.length > 1).length,
    conflictingCards: records.filter(record => record.conflict.detected).length,
    runtimeBaselineMismatches: records.filter(record => !record.transfer.runtimeMatchesBaseline).length,
    memberOriginalMismatchCards: records.filter(record => !record.transfer.allMembersMatchOriginals).length,
    missingOriginalMembers: allMembers.filter(member => !member.originalFound).length,
    numericTransferMismatchCards: records.filter(record => !record.transfer.numericTransferMatchesOriginals).length,
    cardsWithIntegrityErrors: records.filter(record => record.issues.some(issue => issue.severity === 'error')).length,
    sourceUpdatedAgeBuckets: tally(records.map(record => record.sourceCurrentness.selectedSourceUpdatedAgeBucket)),
    sourceUpdatedOldest: oldest(allMembers.map(member => member.source.sourceUpdatedAt)),
    sourceUpdatedLatest: latest(allMembers.map(member => member.source.sourceUpdatedAt)),
    issueCounts: tally(records.flatMap(record => record.issues.map(issue => issue.code))),
  },
  records,
};

if (checkOnly) {
  const saved = JSON.parse(fs.readFileSync(path.join(root, reportPath), 'utf8'));
  if (!equal(saved, report)) throw new Error('Сохранённый отчёт не соответствует текущим входам и повторному расчёту');
} else {
  fs.mkdirSync(path.dirname(path.join(root, reportPath)), { recursive: true });
  fs.writeFileSync(path.join(root, reportPath), `${JSON.stringify(report, null, 2)}\n`);
}
console.log(JSON.stringify({ reportPath, checkOnly, scope: report.scope, sourceHashChecks, summary: report.summary }, null, 2));
if (report.summary.cardsWithIntegrityErrors || sourceHashChecks.some(check => !check.matches)) process.exitCode = 1;
