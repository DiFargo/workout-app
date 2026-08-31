#!/usr/bin/env node

/**
 * Validate the generated nutrition-catalog-verified-v2 artifacts without
 * rebuilding them.  This is deliberately separate from the builder so a
 * release check can validate the exact files that will be published.
 *
 * Usage:
 *   node scripts/validate-nutrition-catalog.mjs --reference <directory> [--sku <directory>] [--min-total 5000]
 */

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { isDeepStrictEqual } from "node:util";
import { pathToFileURL } from "node:url";

const REQUIRED_ARTIFACTS = [
  "foods.full.json",
  "foods.compact.json",
  "alias-exact-index.json",
  "alias-prefix-index.json",
  "search-token-index.json",
  "barcode-index.json",
  "provenance.json",
  "catalog.meta.json"
];
const EXPECTED_SCHEMA_VERSION = "nutrition-catalog-verified-v2";
const MACRO_SCALE = 1000;
const BARCODE_VALIDATION_SOURCE_NUMERIC_OR_GTIN = "source_numeric_or_gtin";
const VALID_RECORD_TYPES = new Set(["sku", "reference_food"]);
const VALID_VERIFICATION_STATUSES = new Set([
  "verified",
  "label_photo_present",
  "source_record"
]);
const FORBIDDEN_EVIDENCE_MARKER = /\b(?:estimate|estimated|approx(?:imate)?|derived|inferred|calculated)\b|приблиз|расч[её]т/i;
const MAX_REPORTED_ERRORS = 500;

export class CatalogArtifactValidationError extends Error {
  constructor(errors) {
    super(`Catalog artifact validation failed with ${errors.length} issue${errors.length === 1 ? "" : "s"}.`);
    this.name = "CatalogArtifactValidationError";
    this.errors = errors;
  }
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function addIssue(issues, message) {
  if (issues.length < MAX_REPORTED_ERRORS) {
    issues.push(message);
  } else if (issues.length === MAX_REPORTED_ERRORS) {
    issues.push(`More than ${MAX_REPORTED_ERRORS} issues found; remaining issues were omitted.`);
  }
}

function hasNonEmptyString(value) {
  return typeof value === "string" && Boolean(value.trim());
}

function isIsoDate(value) {
  return hasNonEmptyString(value)
    && /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})?)?$/.test(value)
    && !Number.isNaN(Date.parse(value));
}

function isHttpUrl(value) {
  if (!hasNonEmptyString(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export function validateGtin(value) {
  if (typeof value !== "string" || !/^(?:\d{8}|\d{12,14})$/.test(value) || /^(\d)\1+$/.test(value)) {
    return false;
  }

  let sum = 0;
  for (let index = value.length - 2, position = 0; index >= 0; index -= 1, position += 1) {
    sum += Number(value[index]) * (position % 2 === 0 ? 3 : 1);
  }
  return (10 - (sum % 10)) % 10 === Number(value.at(-1));
}

function validateSourceNumericProductCode(value) {
  return typeof value === "string"
    && /^\d{8,14}$/.test(value)
    && !/^(\d)\1+$/.test(value);
}

function allowsSourceNumericProductCodes(metadata) {
  return metadata?.barcodeValidation === BARCODE_VALIDATION_SOURCE_NUMERIC_OR_GTIN;
}

function collectForbiddenEvidenceMarkers(value, location, issues) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectForbiddenEvidenceMarkers(item, `${location}[${index}]`, issues));
    return;
  }
  if (!isPlainObject(value)) return;

  Object.entries(value).forEach(([key, child]) => {
    const childLocation = `${location}.${key}`;
    if (FORBIDDEN_EVIDENCE_MARKER.test(key)
      || ((key === "status" || key === "method" || key === "quality")
        && typeof child === "string"
        && FORBIDDEN_EVIDENCE_MARKER.test(child))) {
      addIssue(issues, `${childLocation} contains an estimate/derivation marker`);
    }
    collectForbiddenEvidenceMarkers(child, childLocation, issues);
  });
}

function validateNumber(value, location, maximum, issues) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    addIssue(issues, `${location} must be a finite number`);
    return;
  }
  if (value < 0 || value > maximum) {
    addIssue(issues, `${location} must be between 0 and ${maximum}`);
    return;
  }
  if (Math.abs(value * MACRO_SCALE - Math.round(value * MACRO_SCALE)) > 1e-8) {
    addIssue(issues, `${location} must have no more than three decimal places`);
  }
}

function validateScaledNumber(value, location, maximum, issues) {
  if (!Number.isSafeInteger(value)) {
    addIssue(issues, `${location} must be a safe integer scaled by ${MACRO_SCALE}`);
    return;
  }
  if (value < 0 || value > maximum * MACRO_SCALE) {
    addIssue(issues, `${location} must be between 0 and ${maximum * MACRO_SCALE}`);
  }
}

function validateSourceAndEvidence(source, verification, location, recordType, issues) {
  if (!isPlainObject(source)) {
    addIssue(issues, `${location}.source must be an object`);
    return;
  }
  if (!hasNonEmptyString(source.kind)) addIssue(issues, `${location}.source.kind must be a non-empty string`);
  if (!isHttpUrl(source.url)) addIssue(issues, `${location}.source.url must be an http(s) URL`);
  if (!isIsoDate(source.retrievedAt)) addIssue(issues, `${location}.source.retrievedAt must be an ISO-8601 timestamp`);
  if (!hasNonEmptyString(source.license)) addIssue(issues, `${location}.source.license must be a non-empty string`);
  if (source.marketScope !== undefined && !hasNonEmptyString(source.marketScope)) {
    addIssue(issues, `${location}.source.marketScope must be a non-empty string when supplied`);
  }
  if (source.exportUrl !== undefined && !isHttpUrl(source.exportUrl)) {
    addIssue(issues, `${location}.source.exportUrl must be an http(s) URL when supplied`);
  }
  if (source.sourceUpdatedAt !== undefined && !isIsoDate(source.sourceUpdatedAt)) {
    addIssue(issues, `${location}.source.sourceUpdatedAt must be an ISO-8601 timestamp when supplied`);
  }
  if (source.marketTags !== undefined && (!Array.isArray(source.marketTags)
    || source.marketTags.some((tag) => !hasNonEmptyString(tag)))) {
    addIssue(issues, `${location}.source.marketTags must be an array of non-empty strings when supplied`);
  }
  if (recordType === "reference_food" && !hasNonEmptyString(source.recordId)) {
    addIssue(issues, `${location}.source.recordId is required for reference_food records`);
  }

  if (!isPlainObject(verification)) {
    addIssue(issues, `${location}.verification must be an object`);
    return;
  }
  if (!VALID_VERIFICATION_STATUSES.has(verification.status)) {
    addIssue(issues, `${location}.verification.status must be source_record, label_photo_present, or verified`);
  }
  if (!hasNonEmptyString(verification.method)) {
    addIssue(issues, `${location}.verification.method must be a non-empty string`);
  }
  if (!isIsoDate(verification.verifiedAt)) {
    addIssue(issues, `${location}.verification.verifiedAt must be an ISO-8601 timestamp`);
  }
  if (!isHttpUrl(verification.evidenceUrl)) {
    addIssue(issues, `${location}.verification.evidenceUrl must be an http(s) URL`);
  }
  collectForbiddenEvidenceMarkers(source, `${location}.source`, issues);
  collectForbiddenEvidenceMarkers(verification, `${location}.verification`, issues);
}

function validateFullFoods(fullFoods, expectedRecordType, issues, { allowSourceNumericProductCodes = false } = {}) {
  const byId = new Map();
  const barcodes = new Map();

  fullFoods.forEach((food, index) => {
    const location = `foods.full.json[${index}]`;
    if (!isPlainObject(food)) {
      addIssue(issues, `${location} must be an object`);
      return;
    }
    if (!hasNonEmptyString(food.id)) {
      addIssue(issues, `${location}.id must be a non-empty string`);
      return;
    }
    if (byId.has(food.id)) addIssue(issues, `${location}.id duplicates ${food.id}`);
    else byId.set(food.id, food);

    if (!VALID_RECORD_TYPES.has(food.recordType)) {
      addIssue(issues, `${location}.recordType must be sku or reference_food`);
    }
    if (expectedRecordType && food.recordType !== expectedRecordType) {
      addIssue(issues, `${location}.recordType must be ${expectedRecordType} in this catalog layer`);
    }
    if (!hasNonEmptyString(food.name)) addIssue(issues, `${location}.name must be a non-empty string`);
    if (typeof food.brand !== "string") addIssue(issues, `${location}.brand must be a string`);
    if (typeof food.barcode !== "string") addIssue(issues, `${location}.barcode must be a string`);
    if (food.basisUnit !== "g") addIssue(issues, `${location}.basisUnit must be g`);
    if (!Array.isArray(food.aliases) || food.aliases.some((alias) => !hasNonEmptyString(alias))) {
      addIssue(issues, `${location}.aliases must be an array of non-empty strings`);
    }
    if (!hasNonEmptyString(food.searchableText)) {
      addIssue(issues, `${location}.searchableText must be a non-empty string`);
    }

    validateNumber(food.calories, `${location}.calories`, 1000, issues);
    validateNumber(food.protein, `${location}.protein`, 100, issues);
    validateNumber(food.fat, `${location}.fat`, 100, issues);
    validateNumber(food.carbs, `${location}.carbs`, 100, issues);

    if (food.recordType === "sku") {
      if (!validateGtin(food.barcode)
        && !(allowSourceNumericProductCodes && validateSourceNumericProductCode(food.barcode))) {
        addIssue(issues, `${location}.barcode must be a valid GTIN or source numeric product code for a sku`);
      }
      if (food.id !== `sku-${food.barcode}`) addIssue(issues, `${location}.id must equal sku-<barcode>`);
    } else if (food.recordType === "reference_food") {
      if (!food.id.startsWith("ref-")) addIssue(issues, `${location}.id must start with ref-`);
      if (food.barcode && !validateGtin(food.barcode)
        && !(allowSourceNumericProductCodes && validateSourceNumericProductCode(food.barcode))) {
        addIssue(issues, `${location}.barcode must be a valid GTIN or source numeric product code when supplied for reference_food`);
      }
    }

    if (food.barcode) {
      const existing = barcodes.get(food.barcode);
      if (existing) addIssue(issues, `${location}.barcode duplicates ${existing}`);
      else barcodes.set(food.barcode, food.id);
    }
    validateSourceAndEvidence(food.source, food.verification, location, food.recordType, issues);
    collectForbiddenEvidenceMarkers(food, location, issues);
  });

  return { byId, barcodes };
}

function validateCompactFoods(compactFoods, fullById, issues) {
  const compactById = new Map();
  compactFoods.forEach((food, index) => {
    const location = `foods.compact.json[${index}]`;
    if (!isPlainObject(food)) {
      addIssue(issues, `${location} must be an object`);
      return;
    }
    if (!hasNonEmptyString(food.id)) {
      addIssue(issues, `${location}.id must be a non-empty string`);
      return;
    }
    if (compactById.has(food.id)) addIssue(issues, `${location}.id duplicates ${food.id}`);
    else compactById.set(food.id, food);

    const fullFood = fullById.get(food.id);
    if (!fullFood) {
      addIssue(issues, `${location}.id does not exist in foods.full.json`);
      return;
    }
    if (food.rt !== fullFood.recordType) addIssue(issues, `${location}.rt does not match foods.full.json`);
    if (food.n !== fullFood.name) addIssue(issues, `${location}.n does not match foods.full.json name`);
    if (food.b !== fullFood.brand) addIssue(issues, `${location}.b does not match foods.full.json brand`);
    if (food.u !== "g") addIssue(issues, `${location}.u must be g`);
    if (food.x !== fullFood.searchableText) addIssue(issues, `${location}.x does not match foods.full.json searchableText`);
    if (food.pr !== food.id) addIssue(issues, `${location}.pr must equal its id`);
    if (fullFood.barcode) {
      if (food.bc !== fullFood.barcode) addIssue(issues, `${location}.bc does not match foods.full.json barcode`);
    } else if (food.bc !== undefined && food.bc !== "") {
      addIssue(issues, `${location}.bc must be omitted for a food without a barcode`);
    }

    const fields = [
      ["k1000", "calories", 1000],
      ["p1000", "protein", 100],
      ["f1000", "fat", 100],
      ["h1000", "carbs", 100]
    ];
    fields.forEach(([compactField, fullField, maximum]) => {
      validateScaledNumber(food[compactField], `${location}.${compactField}`, maximum, issues);
      if (Number.isSafeInteger(food[compactField])
        && Math.abs(food[compactField] - Math.round(fullFood[fullField] * MACRO_SCALE)) > 0) {
        addIssue(issues, `${location}.${compactField} does not match foods.full.json ${fullField}`);
      }
    });
  });

  fullById.forEach((_, id) => {
    if (!compactById.has(id)) addIssue(issues, `foods.compact.json is missing ${id}`);
  });
  return compactById;
}

function validateSetIndex(index, filename, validIds, issues) {
  if (!isPlainObject(index)) {
    addIssue(issues, `${filename} must be an object`);
    return;
  }
  Object.entries(index).forEach(([term, ids]) => {
    if (!hasNonEmptyString(term)) addIssue(issues, `${filename} contains an empty index term`);
    if (!Array.isArray(ids) || !ids.length) {
      addIssue(issues, `${filename}[${JSON.stringify(term)}] must be a non-empty array of ids`);
      return;
    }
    const seen = new Set();
    ids.forEach((id, indexPosition) => {
      if (!hasNonEmptyString(id)) {
        addIssue(issues, `${filename}[${JSON.stringify(term)}][${indexPosition}] must be a non-empty id`);
      } else if (!validIds.has(id)) {
        addIssue(issues, `${filename}[${JSON.stringify(term)}] points to missing id ${id}`);
      }
      if (seen.has(id)) addIssue(issues, `${filename}[${JSON.stringify(term)}] contains duplicate id ${id}`);
      seen.add(id);
    });
  });
}

function validateBarcodeIndex(index, validIds, fullBarcodes, issues, { allowSourceNumericProductCodes = false } = {}) {
  if (!isPlainObject(index)) {
    addIssue(issues, "barcode-index.json must be an object");
    return;
  }
  Object.entries(index).forEach(([barcode, id]) => {
    if (!validateGtin(barcode)
      && !(allowSourceNumericProductCodes && validateSourceNumericProductCode(barcode))) {
      addIssue(issues, `barcode-index.json key ${barcode} is not a valid GTIN or source numeric product code`);
    }
    if (!hasNonEmptyString(id) || !validIds.has(id)) {
      addIssue(issues, `barcode-index.json[${JSON.stringify(barcode)}] points to missing id ${id}`);
      return;
    }
    if (fullBarcodes.get(barcode) !== id) {
      addIssue(issues, `barcode-index.json[${JSON.stringify(barcode)}] does not match the food barcode`);
    }
  });
  fullBarcodes.forEach((id, barcode) => {
    if (index[barcode] !== id) addIssue(issues, `barcode-index.json is missing ${barcode} -> ${id}`);
  });
}

function validateProvenance(provenance, fullById, issues) {
  if (!isPlainObject(provenance)) {
    addIssue(issues, "provenance.json must be an object");
    return;
  }
  Object.entries(provenance).forEach(([id, value]) => {
    const food = fullById.get(id);
    if (!food) {
      addIssue(issues, `provenance.json points to missing id ${id}`);
      return;
    }
    if (!isPlainObject(value)) {
      addIssue(issues, `provenance.json[${JSON.stringify(id)}] must be an object`);
      return;
    }
    if (!isDeepStrictEqual(value.source, food.source)) {
      addIssue(issues, `provenance.json[${JSON.stringify(id)}].source does not match foods.full.json`);
    }
    if (!isDeepStrictEqual(value.verification, food.verification)) {
      addIssue(issues, `provenance.json[${JSON.stringify(id)}].verification does not match foods.full.json`);
    }
  });
  fullById.forEach((_, id) => {
    if (!Object.hasOwn(provenance, id)) addIssue(issues, `provenance.json is missing ${id}`);
  });
}

function validateMetadata(metadata, fullFoods, compactFoods, provenance, issues) {
  if (!isPlainObject(metadata)) {
    addIssue(issues, "catalog.meta.json must be an object");
    return;
  }
  if (metadata.schemaVersion !== EXPECTED_SCHEMA_VERSION) {
    addIssue(issues, `catalog.meta.json.schemaVersion must be ${EXPECTED_SCHEMA_VERSION}`);
  }
  if (!isIsoDate(metadata.generatedAt)) addIssue(issues, "catalog.meta.json.generatedAt must be an ISO-8601 timestamp");
  if (!Number.isSafeInteger(metadata.productCount) || metadata.productCount < 1) {
    addIssue(issues, "catalog.meta.json.productCount must be a positive integer");
  }
  if (!Number.isSafeInteger(metadata.minimumRequiredRecords) || metadata.minimumRequiredRecords < 1) {
    addIssue(issues, "catalog.meta.json.minimumRequiredRecords must be a positive integer");
  }
  if (metadata.productCount !== fullFoods.length
    || metadata.productCount !== compactFoods.length
    || metadata.productCount !== Object.keys(provenance).length) {
    addIssue(issues, "catalog.meta.json.productCount must match full, compact, and provenance record counts");
  }
  if (metadata.productCount < metadata.minimumRequiredRecords) {
    addIssue(issues, "catalog.meta.json.productCount is below minimumRequiredRecords");
  }
  if (metadata.compactNutritionScale !== MACRO_SCALE) {
    addIssue(issues, `catalog.meta.json.compactNutritionScale must be ${MACRO_SCALE}`);
  }
  if (metadata.barcodeValidation !== undefined
    && metadata.barcodeValidation !== BARCODE_VALIDATION_SOURCE_NUMERIC_OR_GTIN) {
    addIssue(issues, `catalog.meta.json.barcodeValidation must be ${BARCODE_VALIDATION_SOURCE_NUMERIC_OR_GTIN} when supplied`);
  }
  if (!Array.isArray(metadata.sourceKinds) || !metadata.sourceKinds.length
    || metadata.sourceKinds.some((kind) => !hasNonEmptyString(kind))) {
    addIssue(issues, "catalog.meta.json.sourceKinds must be a non-empty array of strings");
  } else {
    const actualKinds = [...new Set(fullFoods.map((food) => food.source?.kind).filter(Boolean))].sort();
    const metadataKinds = [...new Set(metadata.sourceKinds)].sort();
    if (!isDeepStrictEqual(metadataKinds, actualKinds)) {
      addIssue(issues, "catalog.meta.json.sourceKinds does not match foods.full.json provenance");
    }
  }
}

async function readArtifacts(directory, issues) {
  const resolvedDirectory = path.resolve(directory);
  const pairs = await Promise.all(REQUIRED_ARTIFACTS.map(async (filename) => {
    const filePath = path.join(resolvedDirectory, filename);
    try {
      return [filename, JSON.parse(await fs.readFile(filePath, "utf8"))];
    } catch (error) {
      addIssue(issues, `${filePath}: cannot read valid JSON (${error.message})`);
      return [filename, undefined];
    }
  }));
  return { directory: resolvedDirectory, artifacts: Object.fromEntries(pairs) };
}

async function inspectCatalogDirectory(directory, { expectedRecordType } = {}) {
  const issues = [];
  const { directory: resolvedDirectory, artifacts } = await readArtifacts(directory, issues);
  const fullFoods = artifacts["foods.full.json"];
  const compactFoods = artifacts["foods.compact.json"];
  const provenance = artifacts["provenance.json"];

  if (!Array.isArray(fullFoods)) addIssue(issues, "foods.full.json must be an array");
  if (!Array.isArray(compactFoods)) addIssue(issues, "foods.compact.json must be an array");
  if (!isPlainObject(provenance)) addIssue(issues, "provenance.json must be an object");
  if (!Array.isArray(fullFoods) || !Array.isArray(compactFoods) || !isPlainObject(provenance)) {
    return { issues, report: null };
  }

  const allowSourceNumericProductCodes = allowsSourceNumericProductCodes(artifacts["catalog.meta.json"]);
  const { byId: fullById, barcodes } = validateFullFoods(
    fullFoods,
    expectedRecordType,
    issues,
    { allowSourceNumericProductCodes }
  );
  validateCompactFoods(compactFoods, fullById, issues);
  validateProvenance(provenance, fullById, issues);
  validateSetIndex(artifacts["alias-exact-index.json"], "alias-exact-index.json", fullById, issues);
  validateSetIndex(artifacts["alias-prefix-index.json"], "alias-prefix-index.json", fullById, issues);
  validateSetIndex(artifacts["search-token-index.json"], "search-token-index.json", fullById, issues);
  validateBarcodeIndex(
    artifacts["barcode-index.json"],
    fullById,
    barcodes,
    issues,
    { allowSourceNumericProductCodes }
  );
  validateMetadata(artifacts["catalog.meta.json"], fullFoods, compactFoods, provenance, issues);

  const recordTypeCounts = fullFoods.reduce((counts, food) => {
    if (VALID_RECORD_TYPES.has(food?.recordType)) {
      counts[food.recordType] = (counts[food.recordType] || 0) + 1;
    }
    return counts;
  }, { sku: 0, reference_food: 0 });

  return {
    issues,
    report: {
      directory: resolvedDirectory,
      productCount: fullFoods.length,
      barcodeCount: barcodes.size,
      recordTypeCounts
    },
    barcodeEntries: [...barcodes.entries()].map(([barcode, id]) => ({ barcode, id })),
    ids: [...fullById.keys()]
  };
}

/** Validate one generated catalog directory. */
export async function validateCatalogDirectory(directory, options = {}) {
  const inspected = await inspectCatalogDirectory(directory, options);
  if (inspected.issues.length) throw new CatalogArtifactValidationError(inspected.issues);
  return inspected.report;
}

/**
 * Validate the separately published reference and SKU catalog layers.  The
 * SKU layer is optional while it is being built, but any supplied layer must
 * have the matching record type and cannot duplicate a barcode or id.
 */
export async function validateCatalogSources({ referenceDirectory, skuDirectory, minTotal = 1 } = {}) {
  const issues = [];
  const inspections = [];

  if (!referenceDirectory && !skuDirectory) {
    throw new CatalogArtifactValidationError(["Pass --reference and/or --sku with a catalog directory."]);
  }
  if (!Number.isSafeInteger(minTotal) || minTotal < 1) {
    throw new CatalogArtifactValidationError(["minTotal must be a positive integer."]);
  }

  if (referenceDirectory) {
    const inspection = await inspectCatalogDirectory(referenceDirectory, { expectedRecordType: "reference_food" });
    inspection.issues.forEach((issue) => addIssue(issues, `[reference] ${issue}`));
    inspections.push({ layer: "reference", ...inspection });
  }
  if (skuDirectory) {
    const inspection = await inspectCatalogDirectory(skuDirectory, { expectedRecordType: "sku" });
    inspection.issues.forEach((issue) => addIssue(issues, `[sku] ${issue}`));
    inspections.push({ layer: "sku", ...inspection });
  }

  const seenBarcodes = new Map();
  const seenIds = new Map();
  inspections.forEach(({ layer, barcodeEntries = [], ids = [] }) => {
    ids.forEach((id) => {
      const existingLayer = seenIds.get(id);
      if (existingLayer) addIssue(issues, `[${layer}] id ${id} duplicates the ${existingLayer} layer`);
      else seenIds.set(id, layer);
    });
    barcodeEntries.forEach(({ barcode, id }) => {
      const existing = seenBarcodes.get(barcode);
      if (existing) addIssue(issues, `[${layer}] barcode ${barcode} (${id}) duplicates ${existing.layer} (${existing.id})`);
      else seenBarcodes.set(barcode, { layer, id });
    });
  });

  const validReports = inspections.map(({ layer, report }) => ({ layer, ...report }));
  const totalProductCount = validReports.reduce((total, report) => total + (report?.productCount || 0), 0);
  if (totalProductCount < minTotal) {
    addIssue(issues, `Combined product count ${totalProductCount} is below required minimum ${minTotal}`);
  }
  if (issues.length) throw new CatalogArtifactValidationError(issues);

  return {
    totalProductCount,
    totalBarcodeCount: seenBarcodes.size,
    layers: validReports
  };
}

function parsePositiveInteger(value, flag) {
  if (!/^\d+$/.test(value || "")) throw new Error(`${flag} must be a positive integer`);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) throw new Error(`${flag} must be a positive integer`);
  return parsed;
}

function parseCliArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      args.help = true;
    } else if (arg === "--reference" || arg === "--sku" || arg === "--min-total") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) throw new Error(`${arg} requires a value`);
      if (arg === "--min-total") args.minTotal = parsePositiveInteger(value, arg);
      else args[arg.slice(2)] = value;
      index += 1;
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }
  if (!args.help && !args.reference && !args.sku) {
    throw new Error("Pass --reference and/or --sku with a catalog directory.");
  }
  return args;
}

function printUsage() {
  console.log(`Usage: node scripts/validate-nutrition-catalog.mjs --reference <directory> [--sku <directory>] [--min-total 5000]

Checks v2 full/compact records, macros, GTIN and record-type rules, all index
targets, duplicate barcodes, provenance/evidence URLs, and metadata counts.
The SKU layer is optional while it is being prepared.`);
}

async function runCli() {
  const args = parseCliArgs(process.argv.slice(2));
  if (args.help) {
    printUsage();
    return;
  }
  const report = await validateCatalogSources({
    referenceDirectory: args.reference,
    skuDirectory: args.sku,
    minTotal: args.minTotal ?? 1
  });
  console.log(JSON.stringify(report, null, 2));
}

const executedAsScript = process.argv[1]
  && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (executedAsScript) {
  runCli().catch((error) => {
    if (error instanceof CatalogArtifactValidationError) {
      console.error(error.message);
      error.errors.forEach((issue) => console.error(`- ${issue}`));
    } else {
      console.error(error.message);
    }
    process.exitCode = 1;
  });
}
