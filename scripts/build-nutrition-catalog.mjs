#!/usr/bin/env node

/**
 * Build a source-backed nutrition catalog from canonical product records.
 *
 * Input shape:
 * {
 *   "schemaVersion": 1,
 *   "records": [{
 *     "name": "...", "brand": "...", "barcode": "481...",
 *     "nutrition": { "basis": "100g", "calories": 0, "protein": 0, "fat": 0, "carbs": 0 },
 *     "source": { "kind": "...", "recordId": "...", "url": "https://...", "retrievedAt": "...", "license": "...", "marketScope": "belarus" },
 *     "verification": { "status": "label_photo_present", "method": "...", "verifiedAt": "...", "evidenceUrl": "https://..." }
 *   }]
 * }
 *
 * The builder deliberately refuses estimates, incomplete provenance and
 * duplicate GTIN/source records. It never fills in, rounds, or derives a
 * nutritional value.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const MACRO_SCALE = 1000;
const MIN_PREFIX_LENGTH = 2;
const MAX_PREFIX_LENGTH = 7;
const REQUIRED_NUTRITION_FIELDS = ["calories", "protein", "fat", "carbs"];
const ESTIMATE_MARKER = /estimate|approx|derived|inferred|calculated|расч[её]т|приблиз/i;
const ALLOWED_VERIFICATION_STATUSES = new Set([
  "verified",
  "label_photo_present",
  "source_record"
]);
const ALLOWED_RECORD_TYPES = new Set(["sku", "reference_food"]);

export class CatalogValidationError extends Error {
  constructor(errors) {
    super(`Catalog validation failed with ${errors.length} error${errors.length === 1 ? "" : "s"}.`);
    this.name = "CatalogValidationError";
    this.errors = errors;
  }
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function compareStrings(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function requiredString(value, field, errors) {
  if (typeof value !== "string" || !value.trim()) {
    errors.push(`${field} must be a non-empty string`);
    return "";
  }

  return value.trim();
}

function requiredIsoDate(value, field, errors) {
  const normalized = requiredString(value, field, errors);
  if (!normalized) return "";

  if (!/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})?)?$/.test(normalized)
    || Number.isNaN(Date.parse(normalized))) {
    errors.push(`${field} must be a valid ISO-8601 date or timestamp`);
  }

  return normalized;
}

function requiredHttpUrl(value, field, errors) {
  const normalized = requiredString(value, field, errors);
  if (!normalized) return "";

  try {
    const parsed = new URL(normalized);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      errors.push(`${field} must use http or https`);
    }
  } catch {
    errors.push(`${field} must be a valid URL`);
  }

  return normalized;
}

function optionalHttpUrl(value, field, errors) {
  if (value === undefined || value === null || value === "") return "";
  return requiredHttpUrl(value, field, errors);
}

function optionalIsoDate(value, field, errors) {
  if (value === undefined || value === null || value === "") return "";
  return requiredIsoDate(value, field, errors);
}

function addError(errors, recordIndex, field, message) {
  errors.push(`records[${recordIndex}].${field} ${message}`);
}

function hasEstimateMarker(value, path = "") {
  if (Array.isArray(value)) {
    return value.some((item, index) => hasEstimateMarker(item, `${path}[${index}]`));
  }

  if (!isPlainObject(value)) return false;

  return Object.entries(value).some(([key, child]) => {
    const childPath = path ? `${path}.${key}` : key;
    if (ESTIMATE_MARKER.test(key) && child !== false && child !== null && child !== undefined && child !== "") {
      return true;
    }

    if ((key === "status" || key === "method" || key === "quality")
      && typeof child === "string" && ESTIMATE_MARKER.test(child)) {
      return true;
    }

    return hasEstimateMarker(child, childPath);
  });
}

function validateScaledNumber(value, field, errors, recordIndex, maximum) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    addError(errors, recordIndex, field, "must be a finite number");
    return 0;
  }

  if (value < 0 || value > maximum) {
    addError(errors, recordIndex, field, `must be between 0 and ${maximum}`);
    return 0;
  }

  const scaled = value * MACRO_SCALE;
  const rounded = Math.round(scaled);
  if (Math.abs(scaled - rounded) > 1e-8) {
    addError(errors, recordIndex, field, `must have no more than ${String(MACRO_SCALE).length - 1} decimal places`);
    return 0;
  }

  return rounded;
}

export function validateGtin(value) {
  if (typeof value !== "string" || !/^(?:\d{8}|\d{12,14})$/.test(value) || /^(\d)\1+$/.test(value)) {
    return false;
  }

  let sum = 0;
  for (let index = value.length - 2, position = 0; index >= 0; index -= 1, position += 1) {
    const digit = Number(value[index]);
    sum += digit * (position % 2 === 0 ? 3 : 1);
  }

  return (10 - (sum % 10)) % 10 === Number(value.at(-1));
}

export function normalizeSearchText(input = "") {
  return String(input || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^\p{L}\p{N}\s%.-]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function uniqueNormalizedTerms(values) {
  const seen = new Set();
  const terms = [];

  values.forEach((value) => {
    const normalized = normalizeSearchText(value);
    if (normalized && !seen.has(normalized)) {
      seen.add(normalized);
      terms.push(normalized);
    }
  });

  return terms;
}

function tokenizeSearchTerms(terms) {
  const tokens = new Set();

  terms.forEach((term) => {
    term.split(" ").forEach((token) => {
      if (!token) return;
      tokens.add(token);
      token.split(/[.-]+/).forEach((part) => {
        if (part) tokens.add(part);
      });
    });
  });

  return [...tokens].sort(compareStrings);
}

function addToIndex(index, term, id) {
  if (!term) return;
  const matches = index.get(term) || new Set();
  matches.add(id);
  index.set(term, matches);
}

function finalizeSetIndex(index) {
  return Object.fromEntries(
    [...index.entries()]
      .sort(([left], [right]) => compareStrings(left, right))
      .map(([term, ids]) => [term, [...ids].sort(compareStrings)])
  );
}

function finalizeValueIndex(index) {
  return Object.fromEntries(
    [...index.entries()].sort(([left], [right]) => compareStrings(left, right))
  );
}

function getRecordsFromInput(input) {
  if (Array.isArray(input)) return input;
  if (isPlainObject(input) && Array.isArray(input.records)) return input.records;
  throw new CatalogValidationError(["Input must be an array of product records or an object with a records array."]);
}

function normalizeAliases(value, recordIndex, errors) {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    addError(errors, recordIndex, "aliases", "must be an array when supplied");
    return [];
  }

  const aliases = [];
  const seen = new Set();
  value.forEach((alias, aliasIndex) => {
    if (typeof alias !== "string" || !alias.trim()) {
      addError(errors, recordIndex, `aliases[${aliasIndex}]`, "must be a non-empty string");
      return;
    }

    const trimmed = alias.trim();
    const normalized = normalizeSearchText(trimmed);
    if (!seen.has(normalized)) {
      seen.add(normalized);
      aliases.push(trimmed);
    }
  });

  return aliases;
}

function optionalString(value, field, recordIndex, errors) {
  if (value === undefined || value === null || value === "") return "";
  if (typeof value !== "string") {
    addError(errors, recordIndex, field, "must be a string when supplied");
    return "";
  }

  return value.trim();
}

function optionalStringArray(value, field, recordIndex, errors) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    addError(errors, recordIndex, field, "must be an array when supplied");
    return [];
  }

  const values = [];
  const seen = new Set();
  value.forEach((item, itemIndex) => {
    const normalized = optionalString(item, `${field}[${itemIndex}]`, recordIndex, errors);
    if (normalized && !seen.has(normalized)) {
      seen.add(normalized);
      values.push(normalized);
    }
  });
  return values;
}

function stableIdComponent(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/gu, "");
}

function normalizeRecord(record, recordIndex, errors) {
  if (!isPlainObject(record)) {
    errors.push(`records[${recordIndex}] must be an object`);
    return null;
  }

  const name = requiredString(record.name, `records[${recordIndex}].name`, errors);
  const brand = optionalString(record.brand, "brand", recordIndex, errors);
  const recordType = optionalString(record.recordType, "recordType", recordIndex, errors) || "sku";
  if (!ALLOWED_RECORD_TYPES.has(recordType)) {
    addError(errors, recordIndex, "recordType", 'must be "sku" or "reference_food"');
  }

  const barcode = recordType === "sku"
    ? requiredString(record.barcode, `records[${recordIndex}].barcode`, errors)
    : optionalString(record.barcode, "barcode", recordIndex, errors);
  if (barcode && !validateGtin(barcode)) {
    addError(errors, recordIndex, "barcode", "must be a valid GTIN-8, GTIN-12, GTIN-13, or GTIN-14 string");
  }

  if (!isPlainObject(record.nutrition)) {
    addError(errors, recordIndex, "nutrition", "must be an object");
  }
  const nutrition = record.nutrition || {};
  if (nutrition.basis !== "100g") {
    addError(errors, recordIndex, "nutrition.basis", 'must be exactly "100g"');
  }
  if (hasEstimateMarker(nutrition)) {
    addError(errors, recordIndex, "nutrition", "must not contain estimates or derived values");
  }

  const kcal1000 = validateScaledNumber(nutrition.calories, "nutrition.calories", errors, recordIndex, 1000);
  const protein1000 = validateScaledNumber(nutrition.protein, "nutrition.protein", errors, recordIndex, 100);
  const fat1000 = validateScaledNumber(nutrition.fat, "nutrition.fat", errors, recordIndex, 100);
  const carbs1000 = validateScaledNumber(nutrition.carbs, "nutrition.carbs", errors, recordIndex, 100);
  REQUIRED_NUTRITION_FIELDS.forEach((field) => {
    if (!(field in nutrition)) addError(errors, recordIndex, `nutrition.${field}`, "is required");
  });

  if (!isPlainObject(record.source)) {
    addError(errors, recordIndex, "source", "must be an object with provenance fields");
  }
  const source = record.source || {};
  // provider is retained as a backwards-compatible input alias for kind.
  const kind = requiredString(source.kind ?? source.provider, `records[${recordIndex}].source.kind`, errors);
  const recordId = optionalString(source.recordId, "source.recordId", recordIndex, errors);
  const sourceUrl = requiredHttpUrl(source.url, `records[${recordIndex}].source.url`, errors);
  const retrievedAt = requiredIsoDate(source.retrievedAt, `records[${recordIndex}].source.retrievedAt`, errors);
  const license = requiredString(source.license, `records[${recordIndex}].source.license`, errors);
  const marketScope = optionalString(source.marketScope, "source.marketScope", recordIndex, errors);
  const exportUrl = optionalHttpUrl(source.exportUrl, `records[${recordIndex}].source.exportUrl`, errors);
  const sourceUpdatedAt = optionalIsoDate(source.sourceUpdatedAt, `records[${recordIndex}].source.sourceUpdatedAt`, errors);
  const marketTags = optionalStringArray(source.marketTags, "source.marketTags", recordIndex, errors);
  if (recordType === "reference_food" && !recordId) {
    addError(errors, recordIndex, "source.recordId", "is required for reference_food records");
  }

  if (!isPlainObject(record.verification)) {
    addError(errors, recordIndex, "verification", "must be an object with evidence fields");
  }
  const verification = record.verification || {};
  if (hasEstimateMarker(verification)) {
    addError(errors, recordIndex, "verification", "must not contain estimates or derived values");
  }
  const status = requiredString(verification.status, `records[${recordIndex}].verification.status`, errors).toLowerCase();
  if (status && !ALLOWED_VERIFICATION_STATUSES.has(status)) {
    addError(errors, recordIndex, "verification.status", 'must be "verified", "label_photo_present", or "source_record"');
  }
  const method = requiredString(verification.method, `records[${recordIndex}].verification.method`, errors);
  const verifiedAt = requiredIsoDate(verification.verifiedAt, `records[${recordIndex}].verification.verifiedAt`, errors);
  const evidenceUrl = requiredHttpUrl(verification.evidenceUrl, `records[${recordIndex}].verification.evidenceUrl`, errors);

  const aliases = normalizeAliases(record.aliases, recordIndex, errors);
  const category = optionalString(record.category, "category", recordIndex, errors);
  const quantity = optionalString(record.quantity, "quantity", recordIndex, errors);

  const exactTerms = uniqueNormalizedTerms([
    name,
    brand,
    brand ? `${brand} ${name}` : "",
    ...aliases
  ]);
  const searchTerms = uniqueNormalizedTerms([...exactTerms, quantity]);
  const searchText = searchTerms.join(" ");
  const id = recordType === "sku"
    ? `sku-${barcode}`
    : `ref-${stableIdComponent(kind)}-${stableIdComponent(recordId)}`;

  return {
    id,
    recordType,
    name,
    brand,
    barcode,
    category,
    quantity,
    aliases,
    exactTerms,
    searchText,
    tokens: tokenizeSearchTerms(searchTerms),
    nutrition: {
      calories: nutrition.calories,
      protein: nutrition.protein,
      fat: nutrition.fat,
      carbs: nutrition.carbs,
      kcal1000,
      protein1000,
      fat1000,
      carbs1000
    },
    source: {
      kind,
      ...(recordId ? { recordId } : {}),
      url: sourceUrl,
      retrievedAt,
      license,
      ...(marketScope ? { marketScope } : {}),
      ...(exportUrl ? { exportUrl } : {}),
      ...(sourceUpdatedAt ? { sourceUpdatedAt } : {}),
      ...(marketTags.length ? { marketTags } : {})
    },
    verification: {
      status,
      method,
      verifiedAt,
      evidenceUrl
    }
  };
}

function normalizeMinimumRecords(value) {
  if (value === undefined) return 1;
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new CatalogValidationError(["minRecords must be a positive integer."]);
  }
  return value;
}

/**
 * Validates canonical product records and returns deterministic catalog artifacts.
 * The result is intentionally not written to the application's live catalog.
 */
export function buildNutritionCatalog(input, { minRecords } = {}) {
  const records = getRecordsFromInput(input);
  const minimum = normalizeMinimumRecords(minRecords);
  const errors = [];
  const seenBarcodes = new Map();
  const seenSources = new Map();
  const seenSourceUrls = new Map();
  const normalizedRecords = [];

  records.forEach((record, recordIndex) => {
    const normalized = normalizeRecord(record, recordIndex, errors);
    if (!normalized) return;

    if (normalized.barcode) {
      const duplicateIndex = seenBarcodes.get(normalized.barcode);
      if (duplicateIndex !== undefined) {
        addError(errors, recordIndex, "barcode", `duplicates records[${duplicateIndex}].barcode`);
      } else {
        seenBarcodes.set(normalized.barcode, recordIndex);
      }
    }

    if (normalized.source.kind && normalized.source.url) {
      const sourceKey = `${normalized.source.kind.toLowerCase()}\u0000${normalized.source.recordId || normalized.source.url}`;
      const duplicateIndex = seenSources.get(sourceKey);
      if (duplicateIndex !== undefined) {
        addError(errors, recordIndex, "source", `duplicates records[${duplicateIndex}] source.kind + source record identifier`);
      } else {
        seenSources.set(sourceKey, recordIndex);
      }

      const sourceUrlKey = `${normalized.source.kind.toLowerCase()}\u0000${normalized.source.url}`;
      const duplicateUrlIndex = seenSourceUrls.get(sourceUrlKey);
      if (duplicateUrlIndex !== undefined) {
        addError(errors, recordIndex, "source.url", `duplicates records[${duplicateUrlIndex}].source.url for the same source kind`);
      } else {
        seenSourceUrls.set(sourceUrlKey, recordIndex);
      }
    }

    normalizedRecords.push(normalized);
  });

  if (records.length < minimum) {
    errors.push(`Input contains ${records.length} records, but minRecords requires at least ${minimum}.`);
  }
  if (errors.length) throw new CatalogValidationError(errors);

  normalizedRecords.sort((left, right) => compareStrings(left.id, right.id));

  const exactIndex = new Map();
  const prefixIndex = new Map();
  const tokenIndex = new Map();
  const barcodeIndex = new Map();
  const provenance = {};
  const fullFoods = [];
  const compactFoods = [];

  normalizedRecords.forEach((record) => {
    if (record.barcode) barcodeIndex.set(record.barcode, record.id);
    provenance[record.id] = {
      source: record.source,
      verification: record.verification
    };

    record.exactTerms.forEach((term) => addToIndex(exactIndex, term, record.id));
    record.tokens.forEach((token) => {
      addToIndex(tokenIndex, token, record.id);
      const maximum = Math.min(MAX_PREFIX_LENGTH, token.length);
      for (let length = MIN_PREFIX_LENGTH; length <= maximum; length += 1) {
        addToIndex(prefixIndex, token.slice(0, length), record.id);
      }
    });

    fullFoods.push({
      id: record.id,
      recordType: record.recordType,
      name: record.name,
      brand: record.brand,
      barcode: record.barcode,
      category: record.category,
      quantity: record.quantity,
      basisUnit: "g",
      calories: record.nutrition.calories,
      protein: record.nutrition.protein,
      fat: record.nutrition.fat,
      carbs: record.nutrition.carbs,
      aliases: record.aliases,
      searchableText: record.searchText,
      source: record.source,
      verification: record.verification
    });

    compactFoods.push({
      id: record.id,
      rt: record.recordType,
      n: record.name,
      b: record.brand,
      ...(record.barcode ? { bc: record.barcode } : {}),
      ...(record.category ? { c: record.category } : {}),
      ...(record.quantity ? { q: record.quantity } : {}),
      ...(record.aliases.length ? { a: record.aliases } : {}),
      u: "g",
      k1000: record.nutrition.kcal1000,
      p1000: record.nutrition.protein1000,
      f1000: record.nutrition.fat1000,
      h1000: record.nutrition.carbs1000,
      x: record.searchText,
      pr: record.id
    });
  });

  const sourceKinds = [...new Set(normalizedRecords.map((record) => record.source.kind))].sort(compareStrings);
  const generatedAt = isPlainObject(input) && typeof input.generatedAt === "string" && !Number.isNaN(Date.parse(input.generatedAt))
    ? input.generatedAt
    : new Date().toISOString();

  const artifacts = {
    "foods.full.json": fullFoods,
    "foods.compact.json": compactFoods,
    "alias-exact-index.json": finalizeSetIndex(exactIndex),
    "alias-prefix-index.json": finalizeSetIndex(prefixIndex),
    "search-token-index.json": finalizeSetIndex(tokenIndex),
    "barcode-index.json": finalizeValueIndex(barcodeIndex),
    "provenance.json": provenance,
    "catalog.meta.json": {
      schemaVersion: "nutrition-catalog-verified-v2",
      generatedAt,
      productCount: normalizedRecords.length,
      minimumRequiredRecords: minimum,
      sourceKinds,
      verificationRequirement: "source_record, label_photo_present, or verified, always with evidenceUrl",
      compactNutritionScale: MACRO_SCALE,
      indexes: {
        exact: "alias-exact-index.json (normalized term -> array of product ids)",
        prefix: `alias-prefix-index.json (${MIN_PREFIX_LENGTH}-${MAX_PREFIX_LENGTH} character token prefix -> array of product ids)`,
        token: "search-token-index.json (normalized token -> array of product ids)",
        barcode: "barcode-index.json (GTIN -> product id)"
      }
    }
  };

  return {
    artifacts,
    report: {
      productCount: normalizedRecords.length,
      exactTerms: exactIndex.size,
      prefixes: prefixIndex.size,
      tokens: tokenIndex.size,
      barcodes: barcodeIndex.size,
      sourceKinds
    }
  };
}

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch (error) {
    if (error && error.code === "ENOENT") return false;
    throw error;
  }
}

/**
 * Writes artifacts only to a new, previously nonexistent directory. This keeps
 * a bad import from replacing an existing production catalog.
 */
export async function writeNutritionCatalog(outputDirectory, catalog) {
  const output = path.resolve(outputDirectory);
  if (await pathExists(output)) {
    throw new Error(`Refusing to overwrite existing output directory: ${output}`);
  }

  const parent = path.dirname(output);
  await fs.mkdir(parent, { recursive: true });
  const staging = `${output}.staging-${process.pid}-${Date.now()}`;
  await fs.mkdir(staging, { recursive: false });

  try {
    await Promise.all(Object.entries(catalog.artifacts).map(async ([filename, value]) => {
      const destination = path.join(staging, filename);
      await fs.writeFile(destination, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    }));
    await fs.rename(staging, output);
  } catch (error) {
    await fs.rm(staging, { recursive: true, force: true });
    throw error;
  }
}

function parsePositiveInteger(value, flag) {
  if (!/^\d+$/.test(value || "")) throw new Error(`${flag} must be a positive integer`);
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 1) throw new Error(`${flag} must be a positive integer`);
  return number;
}

function parseCliArgs(argv) {
  const args = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      args.help = true;
    } else if (arg === "--input" || arg === "--out" || arg === "--min-records") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) throw new Error(`${arg} requires a value`);
      args[arg.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = value;
      index += 1;
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  if (args.help) return args;
  if (!args.input || !args.out) throw new Error("Both --input and --out are required.");
  if (args.minRecords !== undefined) args.minRecords = parsePositiveInteger(args.minRecords, "--min-records");
  return args;
}

function printUsage() {
  console.log(`Usage: node scripts/build-nutrition-catalog.mjs --input <canonical-skus.json> --out <new-directory> [--min-records 5000]

The input must contain an array (or { records: [...] }) of exact SKU records.
Each record requires name, nutrition values per 100g, source provenance, and a
verification status with an evidence URL. SKU records require a GTIN barcode;
reference_food records use a source record ID instead.
The output directory must not already exist. The CLI requires 5,000 records by
default; use --min-records explicitly for a smaller review dataset.`);
}

async function runCli() {
  const args = parseCliArgs(process.argv.slice(2));
  if (args.help) {
    printUsage();
    return;
  }

  let input;
  try {
    input = JSON.parse(await fs.readFile(path.resolve(args.input), "utf8"));
  } catch (error) {
    throw new Error(`Cannot read valid JSON from ${args.input}: ${error.message}`);
  }

  const catalog = buildNutritionCatalog(input, { minRecords: args.minRecords ?? 5000 });
  await writeNutritionCatalog(args.out, catalog);
  console.log(JSON.stringify(catalog.report, null, 2));
}

const executedAsScript = process.argv[1]
  && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (executedAsScript) {
  runCli().catch((error) => {
    if (error instanceof CatalogValidationError) {
      console.error(error.message);
      error.errors.forEach((item) => console.error(`- ${item}`));
    } else {
      console.error(error.message);
    }
    process.exitCode = 1;
  });
}

export const nutritionCatalogFormat = {
  macroScale: MACRO_SCALE,
  minPrefixLength: MIN_PREFIX_LENGTH,
  maxPrefixLength: MAX_PREFIX_LENGTH,
  currentFile: fileURLToPath(import.meta.url)
};
