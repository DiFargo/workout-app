import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { brandGroups, canonicalBrand, identity, normalize, validGtin } from './lib/belarusPersonalCatalog.mjs';
import { canonicalManufacturerBrand } from './lib/appendManufacturerFoods.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'artifacts/nutrition-catalog-audit-2026-10-29/duplicates.json');
const files = {
  full: 'output/belarus-products-10000/products.json',
  runtime: 'public/nutrition-catalog/personal/products.json',
  provenance: 'public/nutrition-catalog/personal/manufacturer-sources.json',
};
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const ingredientPattern = /состав|ингредиент|нормализованн|закваск|эмульгатор|стабилизатор|ароматизатор|вода питьевая|молоко сухое|сухое молоко|подсолнечное масло|масло подсолнечное|мука.*вода|молоко.*сливки.*сахар/;
const packWords = /(?:^|\s)(?:упаковк[ае]|фасовк[ае]|пачк[ае]|бутылк[ае]|банк[ае]|стакан[ае]?|ведро|фасованн(?:ый|ая|ое|ые)|кусок)(?=\s|$)/g;
const stopWords = new Set(['и', 'с', 'со', 'в', 'на', 'для', 'из', 'по', 'от', 'к', 'во']);
const flavors = [
  ['натуральный', /натуральн|без добавок/], ['ваниль', /ванил|vanill/],
  ['клубника', /клубник|землян|strawber/], ['черника', /черник|blueber/], ['голубика', /голубик/],
  ['малина', /малин|raspber/], ['вишня', /вишн|cherry/], ['персик', /персик|peach/],
  ['манго', /манго|mango/], ['банан', /банан|banana/], ['шоколад', /шоколад|какао|chocol/],
  ['карамель', /карамел|caramel/], ['кокос', /кокос|coconut/], ['киви', /киви|kiwi/],
  ['яблоко', /яблок|apple/], ['груша', /груш|pear/], ['абрикос', /абрикос|apricot/],
  ['чернослив', /чернослив|prune/], ['ананас', /ананас|pineapple/], ['лимон', /лимон|lemon/],
  ['апельсин', /апельсин|orange/], ['орех', /орех|nut/], ['изюм', /изюм/],
  ['чеснок', /чеснок/], ['укроп', /укроп/], ['грибы', /гриб|шампин/],
];
const processing = [
  ['сырой', /(?:^|\s)(?:сырой|сырая|сырое|сырые|сырого|сыром|неприготовленн\p{L}*)(?=\s|$)/u],
  ['варёный', /варен|отварн/], ['жареный', /жарен|обжарен/], ['запечённый', /запечен/],
  ['копчёный', /копчен/], ['сушёный', /сушен/], ['вяленый', /вялен/],
];
const shapes = [
  ['спирали', /спирал/], ['спагетти', /спагет/], ['перья', /перья|пенне/],
  ['рожки', /рожки/], ['ракушки', /ракушк/], ['пюре', /пюре/],
  ['тёртый', /терт(?:ый|ая|ое|ые|ого)/], ['нарезка', /нарезк|ломтик/], ['брусок', /брусок|бруск/],
];
const doneness = [['вкрутую', /вкрутую/], ['всмятку', /всмятку/]];
const storage = [['охлаждённый', /охлажден/], ['замороженный', /заморожен/]];
const refining = [['рафинированный', /(?:^|\s)рафинирован/], ['нерафинированный', /нерафинирован/]];
const eggGrades = [['С0', /(?:^|\s)[сc]\s*[0оo](?=\s|$)/], ['С1', /(?:^|\s)[сc]\s*1(?=\s|$)/], ['С2', /(?:^|\s)[сc]\s*2(?=\s|$)/]];
const reasons = {
  duplicate_id: 'Совпадает исходный идентификатор карточки.',
  duplicate_gtin: 'Совпадает валидный GTIN после приведения GTIN-8/12/13/14 к 14 цифрам.',
  exact_identity: 'Совпадает действующая identity каталога: канонический бренд и название без размера фасовки.',
  normalized_identity: 'Совпадают бренд и название после дополнительной нормализации фасовки, написания бренда и процентов; требуется сверка исходных товаров.',
  reordered_tokens: 'Совпадают бренд и все слова названия, но отличается порядок слов; это сильное текстовое подозрение, не внешнее подтверждение.',
  safe_alias: 'Совпадает информативный продуктовый alias внутри одного бренда; состав и слишком общие aliases исключены.',
  semantic_similarity: 'Названия внутри одного бренда и категории близки по нормализованным словам; явных противоречий жирности, вкуса и приготовления не найдено.',
};

function auditTitle(name, brand) {
  const key = canonicalManufacturerBrand(brand);
  const aliases = brandGroups.filter(group => group.some(value => canonicalManufacturerBrand(value) === key)).flat();
  let text = ` ${normalize(name).replaceAll('ž', 'z')} `;
  for (const alias of [...new Set([normalize(brand).replaceAll('ž', 'z'), key, ...aliases])].sort((a, b) => b.length - a.length)) {
    if (alias) text = text.split(` ${alias} `).join(' ');
  }
  return identity({ name: text, brand: key }).slice(key.length + 1)
    .replace(/(\d+(?:\.\d+)?)\s*%/g, (_, value) => `${Number(value)}%`)
    .replace(/(?:^|\s)\d+(?:\.\d+)?\s*(?:kg|ml|g|l)(?=\s|$)/g, ' ')
    .replace(packWords, ' ').replace(/\s+/g, ' ').trim();
}

function stem(token) {
  if (token.includes('%') || /\d/.test(token) || token.length < 5) return token;
  if (/^(куриц|курин|цыплен)/.test(token)) return 'курица';
  if (/^(варен|отварн)/.test(token)) return 'вареный';
  if (/^творожн/.test(token)) return 'творог';
  const result = token.replace(/(?:иями|ями|ами|ого|ему|ому|ыми|ими|ая|яя|ое|ее|ый|ий|ой|ую|юю|ые|ие|ых|их|ом|ем|ам|ям|ах|ях|ов|ев|а|я|ы|и|у|ю|е|о)$/u, '');
  return result.length >= 3 ? result : token;
}

const markers = (text, groups) => groups.filter(([, expression]) => expression.test(text)).map(([key]) => key).sort();
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const keyOfPair = (left, right) => left < right ? `${left}|${right}` : `${right}|${left}`;

function describe(row, index) {
  const name = normalize(row.name);
  const title = auditTitle(row.name, row.brand);
  const variants = {
    fatPercent: [...new Set((name.match(/\d+(?:\.\d+)?\s*%/g) ?? []).map(value => `${Number(value.replace('%', '').trim())}%`))].sort(),
    flavors: markers(name, flavors), processing: markers(name, processing), shapes: markers(name, shapes),
    doneness: markers(name, doneness), storage: markers(name, storage), refining: markers(name, refining),
    eggGrades: markers(name, eggGrades),
    ready: /готовый|готовая|готовое|готовые/.test(name),
    sugarFree: /без сахара|без добавления сахара/.test(name),
    withSugar: /с сахаром/.test(name),
  };
  const aliasKeys = new Set((row.aliases ?? []).filter(alias => !ingredientPattern.test(normalize(alias)))
    .map(alias => auditTitle(alias, row.brand)).filter(alias => {
      const tokens = alias.split(' ').filter(token => token && !stopWords.has(token));
      return tokens.length >= 2 && tokens.some(token => token.length >= 4);
    }));
  return { index, row, brand: canonicalManufacturerBrand(row.brand), strictIdentity: identity(row), title,
    sorted: title.split(' ').sort().join(' '), originalSorted: identity(row).split('|')[1].split(' ').sort().join(' '),
    tokens: new Set(title.split(' ').filter(token => token && !stopWords.has(token)).map(stem)), aliasKeys, variants };
}

function variantDisagreements(left, right) {
  const conflicts = [];
  for (const [key, label] of [['fatPercent', 'разные явные проценты жирности/содержания'], ['flavors', 'разные явно указанные вкусы'],
    ['processing', 'разное приготовление'], ['shapes', 'разные формы продукта'],
    ['doneness', 'разная степень готовности яйца'], ['storage', 'охлаждённый и замороженный продукт'],
    ['refining', 'рафинированный и нерафинированный продукт'], ['eggGrades', 'разные категории яиц']]) {
    if (left.variants[key].length && right.variants[key].length && !same(left.variants[key], right.variants[key])) conflicts.push(label);
  }
  const leftRaw = left.variants.processing.includes('сырой'), rightRaw = right.variants.processing.includes('сырой');
  if ((leftRaw && right.variants.ready) || (rightRaw && left.variants.ready)) conflicts.push('сырой продукт и готовый продукт');
  if ((left.variants.sugarFree && right.variants.withSugar) || (right.variants.sugarFree && left.variants.withSugar)) conflicts.push('без сахара и с сахаром');
  return conflicts;
}

function sourceRow(item) {
  const row = item.row;
  return { index: item.index, id: row.id, name: row.name, brand: row.brand, category: row.category,
    nutrition: row.nutrition, basis: row.nutrition.basis, barcodes: row.barcodes,
    sourceType: row.sourceType, sources: row.sources, nutritionConflict: Boolean(row.nutritionConflict),
    normalizedTitle: item.title, variants: item.variants };
}

function addToIndex(map, key, index) {
  if (!map.has(key)) map.set(key, []);
  map.get(key).push(index);
}

export function auditDuplicates(rows) {
  const items = rows.map(describe), pairs = new Map(), brandBlocks = new Map();
  const idIndex = new Map(), gtinIndex = new Map(), identityIndex = new Map();
  const titleIndex = new Map(), sortedIndex = new Map(), originalSortedIndex = new Map(), aliasIndex = new Map();
  let ignoredIngredientAliases = 0, semanticComparisons = 0, variantExcludedPairs = 0, crossCategoryPairs = 0;
  const invalidGtins = [], variantExclusionExamples = [], ignoredSharedIngredientAliases = [];
  const addPair = (a, b, confidence, code, detail = {}) => {
    if (a === b) return;
    const key = keyOfPair(a, b);
    if (!pairs.has(key)) pairs.set(key, { indices: [Math.min(a, b), Math.max(a, b)], confidence, codes: new Set(), details: [] });
    const pair = pairs.get(key);
    if (confidence === 'confirmed') pair.confidence = 'confirmed';
    pair.codes.add(code);
    if (Object.keys(detail).length) pair.details.push({ code, ...detail });
  };
  const checkIndex = (map, code, confidence, variantGuard = false) => {
    for (const indices of map.values()) for (let a = 0; a < indices.length; a++) for (let b = a + 1; b < indices.length; b++) {
      if (!variantGuard || !variantDisagreements(items[indices[a]], items[indices[b]]).length) addPair(indices[a], indices[b], confidence, code);
    }
  };
  for (const item of items) {
    const { row, index, brand } = item;
    addToIndex(idIndex, row.id, index);
    addToIndex(identityIndex, item.strictIdentity, index);
    addToIndex(brandBlocks, brand, index);
    addToIndex(titleIndex, `${brand}|${item.title}`, index);
    addToIndex(sortedIndex, `${brand}|${item.sorted}`, index);
    addToIndex(originalSortedIndex, `${canonicalBrand(row.brand)}|${item.originalSorted}`, index);
    for (const code of new Set(row.barcodes ?? [])) {
      if (validGtin(code)) addToIndex(gtinIndex, code.padStart(14, '0'), index);
      else invalidGtins.push({ id: row.id, barcode: code });
    }
    for (const alias of row.aliases ?? []) {
      const normalized = normalize(alias);
      if (ingredientPattern.test(normalized)) ignoredIngredientAliases++;
      addToIndex(aliasIndex, `${brand}|${normalized}`, index);
    }
  }
  checkIndex(idIndex, 'duplicate_id', 'confirmed');
  checkIndex(gtinIndex, 'duplicate_gtin', 'confirmed');
  checkIndex(identityIndex, 'exact_identity', 'confirmed');
  checkIndex(titleIndex, 'normalized_identity', 'suspected', true);
  checkIndex(sortedIndex, 'reordered_tokens', 'suspected', true);
  checkIndex(originalSortedIndex, 'reordered_tokens', 'suspected', true);
  for (const [key, indices] of aliasIndex) {
    const unique = [...new Set(indices)];
    if (unique.length > 1 && ingredientPattern.test(key.slice(key.indexOf('|') + 1))) {
      ignoredSharedIngredientAliases.push({ alias: key.slice(key.indexOf('|') + 1), ids: unique.map(index => rows[index].id),
        reasonRussian: 'Общий состав/ингредиенты не доказывают, что это один продукт; совпадение не включено в дубли.' });
    }
  }
  for (const indices of brandBlocks.values()) {
    for (let a = 0; a < indices.length; a++) for (let b = a + 1; b < indices.length; b++) {
      const left = items[indices[a]], right = items[indices[b]];
      semanticComparisons++;
      const conflicts = variantDisagreements(left, right);
      if (conflicts.length) {
        variantExcludedPairs++;
        if (variantExclusionExamples.length < 80) variantExclusionExamples.push({ ids: [left.row.id, right.row.id],
          names: [left.row.name, right.row.name], reasonsRussian: conflicts });
        continue;
      }
      // Aliases are only supporting evidence; never confirm a product identity.
      if (left.aliasKeys.has(right.title) || right.aliasKeys.has(left.title) || [...left.aliasKeys].some(alias => right.aliasKeys.has(alias))) {
        addPair(left.index, right.index, 'suspected', 'safe_alias');
      }
      if (left.row.category !== right.row.category) { crossCategoryPairs++; continue; }
      const common = [...left.tokens].filter(token => right.tokens.has(token)).length;
      const union = new Set([...left.tokens, ...right.tokens]).size;
      const dice = 2 * common / (left.tokens.size + right.tokens.size);
      const minTokens = Math.min(left.tokens.size, right.tokens.size);
      const maxTokens = Math.max(left.tokens.size, right.tokens.size);
      const near = common >= 3 && dice >= 0.84 && common / union >= 0.7;
      const contained = common >= 2 && common === minTokens && maxTokens - minTokens <= 1;
      // Missing brand provides no ownership evidence: only identical token sets.
      if (left.brand ? (near || contained) : (common >= 3 && common === union)) {
        addPair(left.index, right.index, 'suspected', 'semantic_similarity',
          { sharedTokens: common, jaccard: Number((common / union).toFixed(4)), dice: Number(dice.toFixed(4)) });
      }
    }
  }
  const groups = [], coverage = items.map(item => ({ index: item.index, id: item.row.id, checked: true, groupIds: [] }));
  for (const confidence of ['confirmed', 'suspected']) {
    const edges = [...pairs.values()].filter(pair => pair.confidence === confidence), adjacency = new Map();
    for (const pair of edges) for (const [a, b] of [pair.indices, [...pair.indices].reverse()]) {
      if (!adjacency.has(a)) adjacency.set(a, new Set());
      adjacency.get(a).add(b);
    }
    const seen = new Set(); let number = 0;
    for (const start of [...adjacency.keys()].sort((a, b) => a - b)) {
      if (seen.has(start)) continue;
      const pending = [start], indices = [];
      while (pending.length) {
        const index = pending.pop(); if (seen.has(index)) continue;
        seen.add(index); indices.push(index); pending.push(...adjacency.get(index));
      }
      indices.sort((a, b) => a - b); const indexSet = new Set(indices);
      const evidence = edges.filter(pair => indexSet.has(pair.indices[0]) && indexSet.has(pair.indices[1]));
      const groupId = `${confidence}-${String(++number).padStart(4, '0')}`;
      const conflicts = [];
      for (let a = 0; a < indices.length; a++) for (let b = a + 1; b < indices.length; b++) {
        const disagreement = variantDisagreements(items[indices[a]], items[indices[b]]);
        if (disagreement.length) conflicts.push({ ids: [rows[indices[a]].id, rows[indices[b]].id], reasonsRussian: disagreement });
      }
      const codes = [...new Set(evidence.flatMap(pair => [...pair.codes]))];
      groups.push({ groupId, confidence, confidenceRussian: confidence === 'confirmed' ? 'Формально подтверждённое совпадение записей' : 'Подозрение, требуется ручная сверка источников',
        ids: indices.map(index => rows[index].id), reasonsRussian: codes.map(code => reasons[code]), reasonCodes: codes,
        nutritionValuesEqual: new Set(indices.map(index => JSON.stringify(rows[index].nutrition))).size === 1,
        rows: indices.map(index => sourceRow(items[index])), variantDisagreements: conflicts,
        reviewNoteRussian: confidence === 'suspected' ? 'Это связанная группа проверки, а не команда на объединение. Сходство может быть транзитивным; каждую пару нужно сверить отдельно.' : 'Совпадение идентификаторов/строгой identity не подтверждает достоверность КБЖУ; значения и источники сохранены.',
        pairEvidence: evidence.map(pair => ({ ids: pair.indices.map(index => rows[index].id), reasonCodes: [...pair.codes],
          reasonsRussian: [...pair.codes].map(code => reasons[code]), details: pair.details,
          incompleteVariantEvidenceRussian: ['fatPercent', 'flavors', 'processing', 'doneness', 'storage', 'shapes']
            .filter(key => Boolean(items[pair.indices[0]].variants[key].length) !== Boolean(items[pair.indices[1]].variants[key].length))
            .map(key => `Признак ${key} указан только у одной записи; отсутствие данных не означает равенства.`) })) });
      for (const index of indices) coverage[index].groupIds.push(groupId);
    }
  }
  const confirmedGroups = groups.filter(group => group.confidence === 'confirmed');
  const suspectedGroups = groups.filter(group => group.confidence === 'suspected');
  return {
    summary: { total: rows.length, checked: coverage.filter(row => row.checked).length,
      confirmedGroups: confirmedGroups.length, confirmedRows: new Set(confirmedGroups.flatMap(group => group.ids)).size,
      suspectedGroups: suspectedGroups.length, suspectedRows: new Set(suspectedGroups.flatMap(group => group.ids)).size,
      strongTextSuspectedGroups: suspectedGroups.filter(group => group.reasonCodes.some(code => code !== 'semantic_similarity')).length,
      semanticOnlySuspectedGroups: suspectedGroups.filter(group => group.reasonCodes.every(code => code === 'semantic_similarity')).length,
      suspectedGroupsWithTransitiveVariantDisagreements: suspectedGroups.filter(group => group.variantDisagreements.length).length,
      suspectedGroupsBySource: {
        geminiOnly: suspectedGroups.filter(group => group.rows.every(row => row.sourceType === 'gemini')).length,
        openfoodfactsOnly: suspectedGroups.filter(group => group.rows.every(row => row.sourceType === 'openfoodfacts')).length,
        mixed: suspectedGroups.filter(group => new Set(group.rows.map(row => row.sourceType)).size > 1).length,
      },
      rowsWithNoDuplicateSignals: coverage.filter(row => !row.groupIds.length).length,
      pairSignals: pairs.size, brandBlocks: brandBlocks.size, semanticComparisons, variantExcludedPairs, crossCategoryPairs,
      missingBrandRows: items.filter(item => !item.brand).length, invalidGtins: invalidGtins.length,
      currentNutritionConflictRows: rows.filter(row => row.nutritionConflict).length, ignoredIngredientAliases,
      originalTokenSortGroupsBeforeVariantGuard: [...originalSortedIndex.values()].filter(indices => indices.length > 1).length,
      reasonPairCounts: Object.fromEntries(Object.keys(reasons).map(code => [code, [...pairs.values()].filter(pair => pair.codes.has(code)).length])) },
    groups, coverage, ignoredSharedIngredientAliases, variantExclusionExamples, invalidGtins,
  };
}

function selfChecks() {
  assert.equal(auditTitle('Творог 5,0% 200 г упаковка', 'Тест'), auditTitle('Творог 5% 400 г', 'Тест'));
  assert.ok(ingredientPattern.test(normalize('Молоко нормализованное, закваска.')));
  const make = name => describe({ name, brand: 'Тест', aliases: [] }, 0);
  assert.ok(variantDisagreements(make('Творог 5%'), make('Творог 9%')).length);
  assert.ok(variantDisagreements(make('Йогурт клубника'), make('Йогурт ваниль')).length);
  assert.ok(variantDisagreements(make('Грудка куриная сырая'), make('Грудка куриная готовая')).length);
  assert.ok(variantDisagreements(make('Яйцо варёное вкрутую'), make('Яйцо варёное всмятку')).length);
  assert.ok(variantDisagreements(make('Филе сырое охлаждённое'), make('Филе сырое замороженное')).length);
  assert.equal('4810268031793'.padStart(14, '0'), '04810268031793');
}

export function writeBaselineDuplicateAudit() {
  selfChecks();
  const raw = Object.fromEntries(Object.entries(files).map(([key, filename]) => [key, fs.readFileSync(path.join(root, filename), 'utf8')]));
  const full = JSON.parse(raw.full), runtime = JSON.parse(raw.runtime), provenance = JSON.parse(raw.provenance);
  const count = provenance.baseline.count;
  assert.equal(count, 10000, 'Задача охватывает ровно исходные 10 000 карточек.');
  assert.equal(full.length, count, 'Full-артефакт должен содержать исходную базу.');
  assert.ok(runtime.length >= count);
  const prefix = runtime.slice(0, count);
  assert.equal(sha256(JSON.stringify(prefix)), provenance.baseline.rowsSha256, 'Исходный runtime prefix изменён.');
  const projected = full.map(row => [row.id, row.name, row.brand, row.category, row.nutrition.kcal, row.nutrition.protein,
    row.nutrition.fat, row.nutrition.carbs, row.nutrition.basis, row.aliases, row.barcodes, row.market,
    row.sourceType, Boolean(row.nutritionConflict), row.sources[0].url ?? null]);
  assert.deepEqual(prefix, projected, 'Full и runtime исходных карточек расходятся.');
  const result = auditDuplicates(full);
  assert.equal(result.coverage.length, count);
  assert.ok(result.coverage.every(row => row.checked === true));
  const report = { schemaVersion: 1, auditDate: '2026-10-29', generatedAt: new Date().toISOString(),
    titleRussian: 'Проверка дублей всех исходных 10 000 карточек питания',
    scopeRussian: 'Только исходный runtime-prefix и исходный full-артефакт. Новые manufacturer-карточки исключены. Данные не изменялись; Production и сеть не использовались.',
    baseline: { count, runtimePrefixMatchesFull: true, expectedRowsSha256: provenance.baseline.rowsSha256,
      actualRowsSha256: sha256(JSON.stringify(prefix)), inputFiles: Object.fromEntries(Object.entries(files).map(([key, filename]) => [key, { path: filename, sha256: sha256(raw[key]) }])) },
    methodologyRussian: [
      'Для всех записей проверены id, валидные GTIN-14 и действующая canonical-brand+identity; такие совпадения выделены как формальные.',
      'Дополнительные нормализации фасовки/процентов/бренда, перестановки слов, безопасные aliases и близкие названия дают только подозрения.',
      'Семантические сравнения выполняются внутри бренд-блоков, а не между всеми 50 миллионами пар; близость слов учитывает ограниченную русскую морфологию.',
      'Явно разные проценты, вкусы, формы и приготовление исключают текстовый матч. Сырой и готовый продукт не считаются одинаковыми.',
      'Совпадение КБЖУ не используется как самостоятельное доказательство. Общий состав не используется как продуктовая identity.',
      'Подозрительные группы — связанные компоненты графа пар; транзитивное сходство не означает, что можно объединить всю группу.',
    ],
    limitationsRussian: [
      'Это полный локальный алгоритмический проход, а не ручная сверка каждой упаковки или сайта производителя.',
      'Без валидного общего GTIN или строгой identity текстовое сходство не подтверждает реальную идентичность SKU.',
      'Словарь вкусов/форм/морфологии конечен; сильно разные пересказы, неизвестные варианты брендов и ошибки исходных данных могут остаться незамеченными.',
      '249 карточек без бренда сравниваются с повышенными ограничениями; товары разных неустановленных производителей нельзя уверенно объединять.',
      'Данные Gemini с basis=unknown и community-источники OFF не становятся проверенными от совпадения названия или КБЖУ.',
      'Семантическое сравнение ограничено одной категорией, но id/GTIN/identity/token-sort/alias проверяются независимо от категории.',
      'Ранее объединённые member-записи внутри одной карточки не удалялись и не пересобирались; их nutritionConflict сохранён.',
    ], ...result };
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ output, ...report.summary }, null, 2));
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) writeBaselineDuplicateAudit();
