import { createReadStream } from "node:fs";
import { access, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { StringDecoder } from "node:string_decoder";
import { createGunzip } from "node:zlib";

const OFF_EXPORT_URL = "https://static.openfoodfacts.org/data/en.openfoodfacts.org.products.csv.gz";
const OFF_PRODUCT_URL = "https://world.openfoodfacts.org/product/";
const REQUIRED_COLUMNS = [
  "code",
  "product_name",
  "brands",
  "quantity",
  "categories",
  "main_category",
  "countries_tags",
  "states_tags",
  "data_quality_errors_tags",
  "last_modified_datetime",
  "unique_scans_n",
  "energy-kcal_100g",
  "fat_100g",
  "carbohydrates_100g",
  "proteins_100g"
];

function fail(message) {
  throw new Error(message);
}

function parseArgs(argv) {
  const args = {};

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!argument.startsWith("--")) fail(`Unexpected argument: ${argument}`);

    const [rawKey, inlineValue] = argument.slice(2).split("=", 2);
    const key = rawKey.trim();
    if (!key) fail("Empty option name");

    if (inlineValue !== undefined) {
      args[key] = inlineValue;
      continue;
    }

    const next = argv[index + 1];
    if (!next || next.startsWith("--")) fail(`Missing value for --${key}`);
    args[key] = next;
    index += 1;
  }

  return args;
}

function parsePositiveInteger(value, optionName) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1) {
    fail(`--${optionName} must be a positive integer`);
  }
  return parsed;
}

function normalizeText(value, maxLength = 240) {
  const text = String(value || "")
    .normalize("NFKC")
    .replace(/\s+/gu, " ")
    .trim();

  return text.length <= maxLength ? text : "";
}

function parseNumber(value) {
  const text = String(value ?? "").trim();
  if (!text) return null;

  const parsed = Number(text.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function hasSupportedNutritionPrecision(value) {
  return /^\d+(?:[.,]\d{1,3})?$/u.test(String(value ?? "").trim());
}

function parseTagSet(value) {
  return new Set(
    String(value || "")
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean)
  );
}

function isValidGtin(code) {
  if (!/^\d{8}$|^\d{12,14}$/.test(code) || /^(\d)\1+$/.test(code)) return false;

  const digits = [...code].map(Number);
  const checkDigit = digits.pop();
  const sum = digits
    .reverse()
    .reduce((total, digit, index) => total + digit * (index % 2 === 0 ? 3 : 1), 0);

  return (10 - (sum % 10)) % 10 === checkDigit;
}

function isPlausibleNutrition(nutrition) {
  return (
    nutrition.calories >= 0 && nutrition.calories <= 1000 &&
    nutrition.protein >= 0 && nutrition.protein <= 100 &&
    nutrition.fat >= 0 && nutrition.fat <= 100 &&
    nutrition.carbs >= 0 && nutrition.carbs <= 100
  );
}

function asIsoDate(value, fallback) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : fallback;
}

function isHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function createDelimitedParser(onRow, delimiter) {
  let field = "";
  let row = [];
  let state = "plain";

  const endField = () => {
    row.push(field);
    field = "";
  };

  const endRow = () => {
    endField();
    onRow(row);
    row = [];
  };

  const processPlainCharacter = (character) => {
    if (character === delimiter) {
      endField();
      return;
    }

    if (character === "\n") {
      endRow();
      return;
    }

    if (character === "\r") return;

    if (character === '"' && !field) {
      state = "quoted";
      return;
    }

    field += character;
  };

  return {
    write(chunk) {
      for (const character of chunk) {
        if (state === "quoted") {
          if (character === '"') state = "afterQuote";
          else field += character;
          continue;
        }

        if (state === "afterQuote") {
          if (character === '"') {
            field += '"';
            state = "quoted";
            continue;
          }

          state = "plain";
        }

        processPlainCharacter(character);
      }
    },
    end() {
      if (state === "quoted") fail("Unterminated quoted TSV field");
      if (field || row.length) endRow();
    }
  };
}

function getRequiredColumnIndexes(header) {
  const indexes = new Map();
  header.forEach((name, index) => {
    indexes.set(name.replace(/^\uFEFF/u, ""), index);
  });

  const missing = REQUIRED_COLUMNS.filter((column) => !indexes.has(column));
  if (missing.length) fail(`Open Food Facts export is missing columns: ${missing.join(", ")}`);

  return indexes;
}

function rowValue(row, indexes, column) {
  return row[indexes.get(column)] || "";
}

function sourceScope(countries, requestedScopes) {
  if (requestedScopes.includes("belarus") && countries.has("en:belarus")) return "belarus";
  if (requestedScopes.includes("russia") && countries.has("en:russia")) return "russia";
  return null;
}

function makeCandidate(row, indexes, context) {
  const code = normalizeText(rowValue(row, indexes, "code"), 20);
  if (!isValidGtin(code)) return { reason: "invalid_gtin" };

  const countries = parseTagSet(rowValue(row, indexes, "countries_tags"));
  const marketScope = sourceScope(countries, context.marketScopes);
  if (!marketScope) return { reason: "outside_market_scope" };

  const states = parseTagSet(rowValue(row, indexes, "states_tags"));
  if (!states.has("en:nutrition-facts-completed")) return { reason: "nutrition_not_completed" };

  const dataQualityErrors = normalizeText(rowValue(row, indexes, "data_quality_errors_tags"), 1000);
  if (dataQualityErrors) return { reason: "source_data_quality_error" };

  const name = normalizeText(rowValue(row, indexes, "product_name"));
  if (name.length < 2) return { reason: "missing_name" };

  const sourceUrl = `${OFF_PRODUCT_URL}${code}`;
  const nutritionPhotoUrl = normalizeText(rowValue(row, indexes, "image_nutrition_url"), 1000);
  const hasSelectedNutritionPhoto = states.has("en:nutrition-photo-selected") && isHttpUrl(nutritionPhotoUrl);

  const nutritionValues = {
    calories: rowValue(row, indexes, "energy-kcal_100g"),
    protein: rowValue(row, indexes, "proteins_100g"),
    fat: rowValue(row, indexes, "fat_100g"),
    carbs: rowValue(row, indexes, "carbohydrates_100g")
  };
  const nutrition = {
    basis: "100g",
    calories: parseNumber(nutritionValues.calories),
    protein: parseNumber(nutritionValues.protein),
    fat: parseNumber(nutritionValues.fat),
    carbs: parseNumber(nutritionValues.carbs)
  };

  if (Object.values(nutrition).some((value) => value === null)) return { reason: "missing_macros" };
  if (!Object.values(nutritionValues).every(hasSupportedNutritionPrecision)) {
    return { reason: "unsupported_nutrition_precision" };
  }
  if (!isPlausibleNutrition(nutrition)) return { reason: "implausible_macros" };

  const brand = normalizeText(rowValue(row, indexes, "brands"));
  const quantity = normalizeText(rowValue(row, indexes, "quantity"), 100);
  const category = normalizeText(
    rowValue(row, indexes, "main_category") || rowValue(row, indexes, "categories"),
    240
  );
  const sourceUpdatedAt = asIsoDate(
    rowValue(row, indexes, "last_modified_datetime"),
    context.retrievedAt
  );
  const uniqueScans = parseNumber(rowValue(row, indexes, "unique_scans_n")) || 0;
  const aliases = brand && brand.toLocaleLowerCase("ru") !== name.toLocaleLowerCase("ru")
    ? [`${brand} ${name}`]
    : [];

  return {
    record: {
      name,
      brand,
      barcode: code,
      nutrition,
      aliases,
      category,
      quantity,
      source: {
        provider: "Open Food Facts",
        recordId: code,
        url: sourceUrl,
        exportUrl: context.sourceExportUrl,
        retrievedAt: context.retrievedAt,
        sourceUpdatedAt,
        license: "ODbL-1.0",
        marketScope,
        marketTags: [...countries].filter((tag) => tag === "en:belarus" || tag === "en:russia")
      },
      verification: {
        status: hasSelectedNutritionPhoto ? "label_photo_present" : "source_record",
        method: hasSelectedNutritionPhoto ? "selected_nutrition_label_photo" : "structured_source_record",
        verifiedAt: context.retrievedAt,
        evidenceUrl: hasSelectedNutritionPhoto ? nutritionPhotoUrl : sourceUrl
      }
    },
    uniqueScans,
    marketPriority: marketScope === "belarus" ? 0 : 1,
    sourceUpdatedAt
  };
}

function compareCandidates(left, right) {
  if (left.marketPriority !== right.marketPriority) return left.marketPriority - right.marketPriority;
  if (left.uniqueScans !== right.uniqueScans) return right.uniqueScans - left.uniqueScans;
  if (left.sourceUpdatedAt !== right.sourceUpdatedAt) return right.sourceUpdatedAt.localeCompare(left.sourceUpdatedAt);
  return left.record.barcode.localeCompare(right.record.barcode);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.input || !args.output) {
    fail("Usage: node scripts/import-openfoodfacts-catalog.mjs --input <products.csv[.gz]> --output <canonical-skus.json> [--format tsv|csv] [--source-url <official-export-url>] [--limit 7500] [--min-records 5000] [--markets belarus,russia]");
  }

  const limit = parsePositiveInteger(args.limit || "7500", "limit");
  const minRecords = parsePositiveInteger(args["min-records"] || "5000", "min-records");
  if (limit < minRecords) fail("--limit must be greater than or equal to --min-records");
  const marketScopes = (args.markets || "belarus,russia")
    .split(",")
    .map((scope) => scope.trim().toLowerCase())
    .filter(Boolean);
  const unsupportedScopes = marketScopes.filter((scope) => !["belarus", "russia"].includes(scope));
  if (!marketScopes.length || unsupportedScopes.length) {
    fail("--markets supports only belarus and russia");
  }
  const format = String(args.format || "tsv").toLowerCase();
  if (format !== "tsv" && format !== "csv") fail("--format must be tsv or csv");
  const delimiter = format === "csv" ? "," : "\t";
  const sourceExportUrl = normalizeText(args["source-url"] || OFF_EXPORT_URL, 4_000);
  if (!isHttpUrl(sourceExportUrl)) fail("--source-url must be an http or https URL");

  await access(args.input);
  const retrievedAt = new Date().toISOString();
  const context = { marketScopes, retrievedAt, sourceExportUrl };
  const reasons = new Map();
  const candidatesByBarcode = new Map();
  let parsedRows = 0;
  let headerIndexes = null;

  const registerReason = (reason) => {
    reasons.set(reason, (reasons.get(reason) || 0) + 1);
  };

  const parser = createDelimitedParser((row) => {
    if (!headerIndexes) {
      headerIndexes = getRequiredColumnIndexes(row);
      return;
    }

    parsedRows += 1;
    const candidate = makeCandidate(row, headerIndexes, context);
    if (!candidate.record) {
      registerReason(candidate.reason);
      return;
    }

    const existing = candidatesByBarcode.get(candidate.record.barcode);
    if (!existing || compareCandidates(candidate, existing) < 0) {
      candidatesByBarcode.set(candidate.record.barcode, candidate);
    }
  }, delimiter);

  const decoder = new StringDecoder("utf8");
  const input = createReadStream(args.input);
  const stream = args.input.toLowerCase().endsWith(".gz") ? input.pipe(createGunzip()) : input;
  for await (const chunk of stream) parser.write(decoder.write(chunk));
  parser.write(decoder.end());
  parser.end();

  const sortedCandidates = [...candidatesByBarcode.values()].sort(compareCandidates);
  const selected = sortedCandidates.slice(0, limit).map((candidate) => candidate.record);
  if (selected.length < minRecords) {
    fail(`Strict selection found only ${selected.length} records; --min-records requires at least ${minRecords}. No output was written.`);
  }
  const scopeCounts = Object.fromEntries(
    marketScopes.map((scope) => [
      scope,
      selected.filter((record) => record.source.marketScope === scope).length
    ])
  );
  const output = {
    meta: {
      schemaVersion: 1,
      provider: "Open Food Facts",
      license: "ODbL-1.0",
      retrievedAt,
      exportUrl: sourceExportUrl,
      marketScopeDefinition: {
        belarus: "Open Food Facts countries_tags contains en:belarus",
        russia: "Open Food Facts countries_tags contains en:russia; this is not evidence of availability in Belarus"
      },
      strictAdmission: [
        "valid GTIN",
        "exact source product_name",
        "nutrition-facts-completed",
        "full energy/protein/fat/carbohydrates values per 100g",
        "no source data_quality_errors_tags",
        "nutrition label photo is retained when available but is not required"
      ]
    },
    records: selected
  };

  await mkdir(path.dirname(args.output), { recursive: true });
  await writeFile(args.output, `${JSON.stringify(output, null, 2)}\n`, "utf8");

  console.log(JSON.stringify({
    parsedRows,
    validCandidates: sortedCandidates.length,
    selected: selected.length,
    minimumRequiredRecords: minRecords,
    selectedByMarketScope: scopeCounts,
    rejectionCounts: Object.fromEntries([...reasons.entries()].sort((left, right) => right[1] - left[1]))
  }, null, 2));
}

main().catch((error) => {
  console.error(`Open Food Facts import failed: ${error.message}`);
  process.exitCode = 1;
});
