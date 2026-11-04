import { createHash } from 'node:crypto';
import {
  brandGroups, canonicalBrand, identity, normalize, nutritionProblems, validGtin,
} from './belarusPersonalCatalog.mjs';

// Import-only spelling equivalents: do not regroup the published baseline.
const importBrandGroups = [['свежа', 'sveza', 'sveža', 'svezha'], ['ганна', 'ganna']];
const nutritionKeys = ['kcal', 'protein', 'fat', 'carbs'];
const ingredientAlias = /состав|ингредиент|нормализованн|закваск|эмульгатор|стабилизатор|ароматизатор|вода питьевая|молоко сухое|сухое молоко|подсолнечное масло|масло подсолнечное|мука.*вода/;
const flavorGroups = [
  ['plain', /натуральн|без добавок/], ['vanilla', /ванил|vanill/],
  ['strawberry', /клубник|землян|strawber/], ['blueberry', /черник|голубик|blueber/],
  ['raspberry', /малин|raspber/], ['cherry', /вишн|cherry/],
  ['peach', /персик|peach/], ['mango', /манго|mango/], ['banana', /банан|banana/],
  ['chocolate', /шоколад|какао|chocol/], ['caramel', /карамел|caramel/],
  ['coconut', /кокос|coconut/], ['kiwi', /киви|kiwi/], ['apple', /яблок|apple/],
  ['pear', /груш|pear/], ['apricot', /абрикос|apricot/], ['prune', /чернослив|prune/],
  ['pineapple', /ананас|pineapple/], ['lemon', /лимон|lemon/],
];
const shapeGroups = [
  ['spirals', /спирал/], ['spaghetti', /спагет/], ['penne', /перья|пенне/],
  ['shells', /ракушк/], ['elbows', /рожки/], ['raw', /сырой|сырая|сырое/],
  ['cooked', /варен|отварн/], ['smoked', /копчен/],
];

export function canonicalManufacturerBrand(value) {
  const key = normalize(value).replaceAll('ž', 'z');
  return importBrandGroups.find(group => group.includes(key))?.[0] ?? canonicalBrand(key);
}

function titleIdentity(name, brand) {
  const brandKey = canonicalManufacturerBrand(brand);
  const aliases = [...importBrandGroups, ...brandGroups]
    .filter(group => group.some(value => canonicalManufacturerBrand(value) === brandKey))
    .flat();
  let title = ` ${normalize(name).replaceAll('ž', 'z')} `;
  for (const alias of [...new Set([brandKey, normalize(brand), ...aliases])].sort((a, b) => b.length - a.length)) {
    if (alias) title = title.split(` ${alias} `).join(' ');
  }
  title = title.replace(/(\d+(?:\.\d+)?)\s*%/g, (_, number) => `${Number(number)}%`)
    .replace(/(?:^|\s)\d+(?:\.\d+)?\s*(?:kg|ml|g|l)(?=\s|$)/g, ' ')
    .replace(/(?:^|\s)(?:пачка|пачке|бутылка|бутылке|банка|банке|стакан|стакане)(?=\s|$)/g, ' ');
  return identity({ name: title, brand: brandKey });
}

function httpsUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' && url.hostname && !url.username && !url.password ? url : null;
  } catch { return null; }
}

function validCheckedAt(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2}))?$/.test(value)) return false;
  const calendarDate = value.slice(0, 10);
  const day = new Date(`${calendarDate}T00:00:00.000Z`);
  return Number.isFinite(day.getTime()) && day.toISOString().slice(0, 10) === calendarDate && Number.isFinite(Date.parse(value));
}

export function normalizedManufacturerGtin(code) {
  return typeof code === 'string' && validGtin(code) ? code.padStart(14, '0') : null;
}

export function manufacturerFoodId(candidate) {
  const url = httpsUrl(candidate?.source?.url);
  if (!url) throw new TypeError('Manufacturer product URL must use HTTPS');
  url.hash = '';
  url.searchParams.sort();
  const key = `${url.href}|${titleIdentity(candidate.name, candidate.brand)}`;
  return `manufacturer-${createHash('sha256').update(key).digest('hex').slice(0, 20)}`;
}

function candidateProblems(candidate) {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return ['invalid_candidate'];
  const issues = [];
  for (const key of ['name', 'brand', 'manufacturer', 'category']) {
    if (typeof candidate[key] !== 'string' || !candidate[key].trim()) issues.push(`missing_${key}`);
  }
  if (candidate.manufacturerCountry !== 'BY') issues.push('manufacturer_country_not_BY');
  const nutrition = candidate.nutrition ?? {};
  if (nutrition.basis !== '100g') issues.push('nutrition_basis_must_be_100g');
  issues.push(...nutritionProblems(nutrition));
  if (!Array.isArray(candidate.barcodes)) issues.push('invalid_barcodes');
  else if (candidate.barcodes.some(code => !normalizedManufacturerGtin(code))) issues.push('invalid_gtin');
  if (!Array.isArray(candidate.aliases) || candidate.aliases.some(alias => typeof alias !== 'string' || !alias.trim())) issues.push('invalid_aliases');
  const source = candidate.source ?? {};
  if (!httpsUrl(source.url)) issues.push('invalid_source_url');
  if (!httpsUrl(source.manufacturerEvidenceUrl)) issues.push('invalid_manufacturer_evidence_url');
  if (!validCheckedAt(source.checkedAt)) issues.push('invalid_checked_at');
  if (typeof source.basisText !== 'string' || !/(?:^|\s)100\s*(?:г(?:р(?:амм(?:ов|а)?)?)?|g(?:rams?)?)(?=[\s.,;:)]|$)/iu.test(source.basisText)) issues.push('missing_100g_basis_evidence');
  return [...new Set(issues)];
}

function descriptor(row) {
  const key = titleIdentity(row[1], row[2]);
  const title = key.slice(key.indexOf('|') + 1);
  const aliasKeys = new Set((row[9] ?? []).filter(alias => !ingredientAlias.test(normalize(alias)))
    .map(alias => titleIdentity(alias, row[2]))
    .filter(alias => alias.slice(alias.indexOf('|') + 1).split(' ').filter(Boolean).length >= 2));
  return {
    row, id: row[0], key, brand: canonicalManufacturerBrand(row[2]), title,
    tokens: new Set(title.split(' ').filter(token => token && !['и', 'с', 'со', 'в', 'на', 'для', 'из'].includes(token))),
    sorted: title.split(' ').sort().join(' '), aliasKeys,
  };
}

function markers(title, groups) {
  return groups.filter(([, expression]) => expression.test(title)).map(([key]) => key).sort().join('|');
}

function variantConflict(left, right) {
  const percentages = title => [...new Set(title.match(/\d+(?:\.\d+)?%/g) ?? [])].sort().join('|');
  for (const [a, b] of [
    [percentages(left.title), percentages(right.title)],
    [markers(left.title, flavorGroups), markers(right.title, flavorGroups)],
    [markers(left.title, shapeGroups), markers(right.title, shapeGroups)],
  ]) if (a && b && a !== b) return true;
  return false;
}

function suspicion(left, right) {
  if (variantConflict(left, right)) return null;
  if (left.sorted === right.sorted) return 'reordered_identity';
  if (left.aliasKeys.has(right.key) || right.aliasKeys.has(left.key) || [...left.aliasKeys].some(key => right.aliasKeys.has(key))) return 'alias_match';
  const common = [...left.tokens].filter(token => right.tokens.has(token)).length;
  const union = new Set([...left.tokens, ...right.tokens]).size;
  return common >= 2 && common / union >= 0.72 ? 'similar_title' : null;
}

function differsInNutrition(candidate, row) {
  return candidate.nutrition.basis !== row[8]
    || nutritionKeys.some((key, index) => candidate.nutrition[key] !== row[index + 4]);
}

/**
 * No filesystem/network access. Existing tuples and their nested values are never
 * mutated. `added` contains new compact tuples (optional [15] = source title).
 * Reports contain candidateIndex, name, brand, reasons and matchingIds when relevant.
 * Full provenance remains in the input candidate; use manufacturerFoodId to join it.
 */
export function appendManufacturerFoods({ existingRows, candidates }) {
  if (!Array.isArray(existingRows) || !Array.isArray(candidates)) throw new TypeError('existingRows and candidates must be arrays');
  const rows = [...existingRows], added = [], rejected = [], duplicates = [], suspected = [];
  const byGtin = new Map(), byIdentity = new Map(), byBrand = new Map(), byId = new Map();
  const addIndex = row => {
    const item = descriptor(row);
    byId.set(item.id, item);
    for (const [map, key] of [[byIdentity, item.key], [byBrand, item.brand]]) {
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(item);
    }
    for (const code of row[10] ?? []) {
      const key = normalizedManufacturerGtin(code);
      if (!key) continue;
      if (!byGtin.has(key)) byGtin.set(key, []);
      byGtin.get(key).push(item);
    }
  };
  for (const row of existingRows) addIndex(row);
  for (const [candidateIndex, candidate] of candidates.entries()) {
    const report = { candidateIndex, name: candidate?.name ?? '', brand: candidate?.brand ?? '' };
    const problems = candidateProblems(candidate);
    if (problems.length) { rejected.push({ ...report, reasons: problems }); continue; }
    const n = candidate.nutrition;
    // Search-only derivation: the worker's historical brand vocabulary stays intact.
    const brandAliases = importBrandGroups.find(group => group[0] === canonicalManufacturerBrand(candidate.brand)) ?? [];
    const row = [manufacturerFoodId(candidate), candidate.name.trim(), candidate.brand.trim(), candidate.category.trim(),
      n.kcal, n.protein, n.fat, n.carbs, '100g', [...new Set([...candidate.aliases.map(alias => alias.trim()), ...brandAliases])],
      [...new Set(candidate.barcodes)], 'unknown', 'manufacturer', false, candidate.source.url.trim(),
      `Производитель: ${candidate.manufacturer.trim()}`];
    const item = descriptor(row);
    const codeMatches = candidate.barcodes.flatMap(code => byGtin.get(normalizedManufacturerGtin(code)) ?? []);
    const exactMatches = codeMatches.length ? codeMatches : byIdentity.get(item.key) ?? [];
    if (exactMatches.length) {
      const matches = [...new Map(exactMatches.map(match => [match.id, match])).values()];
      duplicates.push({ ...report, reasons: [codeMatches.length ? 'gtin_match' : 'identity_match'],
        matchingIds: matches.map(match => match.id), nutritionConflict: matches.some(match => differsInNutrition(candidate, match.row)),
        variantConflict: matches.some(match => variantConflict(item, match)) });
      continue;
    }
    const ambiguous = (byBrand.get(item.brand) ?? []).map(match => ({ match, reason: suspicion(item, match) })).filter(match => match.reason);
    if (ambiguous.length) {
      suspected.push({ ...report, reasons: [...new Set(ambiguous.map(match => match.reason))],
        matchingIds: [...new Set(ambiguous.map(({ match }) => match.id))] });
      continue;
    }
    if (byId.has(row[0])) {
      rejected.push({ ...report, reasons: ['generated_id_collision'] });
      continue;
    }
    rows.push(row); added.push(row); addIndex(row);
  }
  return { rows, added, rejected, duplicates, suspected };
}
