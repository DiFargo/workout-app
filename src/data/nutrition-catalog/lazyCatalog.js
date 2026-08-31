import {
  expandNutritionCatalogFood,
  normalizeNutritionQuery,
  searchLocalizedNutritionCatalog
} from "./catalogSearch.js";

const CATALOG_SOURCES = [
  { id: "sku", baseUrl: "/nutrition-catalog/sku" },
  { id: "reference", baseUrl: "/nutrition-catalog/reference" }
];
const BARCODE_CATALOG_SOURCES = CATALOG_SOURCES;
const CORE_SEARCH_CATALOG_FILES = [
  "foods.compact.json",
  "search-token-index.json"
];
const EXACT_INDEX_FILE = "alias-exact-index.json";
const PREFIX_INDEX_FILE = "alias-prefix-index.json";
const BARCODE_CATALOG_FILE = "barcode-index.json";
const SEARCH_RESULT_CACHE_LIMIT = 24;
const CATALOG_REQUEST_TIMEOUT_MS = 6000;

const sourceLoaders = new Map();
const searchResultCache = new Map();

function getSourceLoader(source) {
  const existing = sourceLoaders.get(source.id);
  if (existing) return existing;

  const loader = {
    files: new Map(),
    barcode: null
  };
  sourceLoaders.set(source.id, loader);
  return loader;
}

function loadCatalogFile(source, filename) {
  const loader = getSourceLoader(source);
  const existing = loader.files.get(filename);
  if (existing) return existing;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(new DOMException("Timeout", "AbortError")), CATALOG_REQUEST_TIMEOUT_MS);
  const request = fetch(`${source.baseUrl}/${filename}`, { signal: controller.signal })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Nutrition ${source.id} catalog load failed: ${response.status}`);
      }
      return response.json();
    })
    .finally(() => clearTimeout(timeoutId))
    .catch((error) => {
      // A transient offline failure must remain retryable on the next search.
      loader.files.delete(filename);
      throw error;
    });

  loader.files.set(filename, request);
  return request;
}

async function loadSearchCatalogWithIndexes(
  source,
  { includeExactIndex = false, includePrefixIndex = false } = {}
) {
  const [foods, tokenIndex, exactIndex, prefixIndex] = await Promise.all([
    ...CORE_SEARCH_CATALOG_FILES.map((filename) => loadCatalogFile(source, filename)),
    includeExactIndex ? loadCatalogFile(source, EXACT_INDEX_FILE) : Promise.resolve({}),
    includePrefixIndex ? loadCatalogFile(source, PREFIX_INDEX_FILE) : Promise.resolve({})
  ]);

  return {
    ...source,
    foods,
    prefixIndex,
    exactIndex,
    tokenIndex
  };
}

async function loadExactCatalog(source) {
  const [foods, exactIndex] = await Promise.all([
    loadCatalogFile(source, "foods.compact.json"),
    loadCatalogFile(source, EXACT_INDEX_FILE)
  ]);

  return {
    ...source,
    foods,
    exactIndex
  };
}

async function loadBarcodeCatalog(source) {
  const loader = getSourceLoader(source);
  if (!loader.barcode) {
    loader.barcode = Promise.all([
      loadCatalogFile(source, "foods.compact.json"),
      loadCatalogFile(source, BARCODE_CATALOG_FILE)
    ])
      .then(([foods, barcodeIndex]) => ({
        ...source,
        foodsById: new Map(foods.map((food) => [food.id, food])),
        barcodeIndex
      }))
      .catch((error) => {
        loader.barcode = null;
        throw error;
      });
  }

  return loader.barcode;
}

function exactIdsForQuery(catalog, query) {
  const value = catalog.exactIndex[query];
  return new Set(Array.isArray(value) ? value : value ? [value] : []);
}

export function resolveExactNutritionCatalogFoods(compactFoods = [], exactIndex = {}, query = "") {
  const normalizedQuery = normalizeNutritionQuery(query);
  if (!normalizedQuery || normalizedQuery.length < 2 || !Array.isArray(compactFoods)) return [];

  const foodsById = new Map(compactFoods.map((food) => [food?.id, food]));
  const exactIds = exactIdsForQuery({ exactIndex }, normalizedQuery);

  return Array.from(exactIds)
    .map((id) => foodsById.get(id))
    .filter(Boolean)
    .map((food) => expandNutritionCatalogFood(food));
}

function resultLimit(limit) {
  return Math.max(1, Number.parseInt(limit, 10) || 20);
}

function mergeResults(exact = [], matches = [], limit = 20) {
  const seen = new Set();
  const merged = [];
  [...exact, ...matches].forEach((food) => {
    if (!food?.id || seen.has(food.id)) return;
    seen.add(food.id);
    merged.push(food);
  });

  return merged.slice(0, resultLimit(limit));
}

function getCachedSearchResult(key) {
  const value = searchResultCache.get(key);
  if (!value) return null;

  // Move a frequently repeated query to the end so eviction is effectively LRU.
  searchResultCache.delete(key);
  searchResultCache.set(key, value);
  return value;
}

function cacheSearchResult(key, result) {
  searchResultCache.set(key, result);
  if (searchResultCache.size <= SEARCH_RESULT_CACHE_LIMIT) return;

  const oldestKey = searchResultCache.keys().next().value;
  if (oldestKey) searchResultCache.delete(oldestKey);
}

export async function searchLazyNutritionCatalog(query, limit = 20) {
  const normalizedQuery = normalizeNutritionQuery(query);
  const normalizedLimit = resultLimit(limit);
  if (!normalizedQuery || normalizedQuery.length < 2) return [];

  const cacheKey = `${normalizedLimit}:${normalizedQuery}`;
  const cachedResult = getCachedSearchResult(cacheKey);
  if (cachedResult) return cachedResult;

  const searchSources = async (options) => {
    const exact = [];
    const matches = [];
    let loadedSourceCount = 0;
    let lastError = null;

    // The localized SKU catalog is intentionally searched first. The generic
    // reference layer is fetched only if the focused SKU lookup has no match,
    // keeping the first mobile search lightweight despite the larger catalog.
    for (const source of CATALOG_SOURCES) {
      try {
        const catalog = await loadSearchCatalogWithIndexes(source, options);
        loadedSourceCount += 1;
        const exactIds = exactIdsForQuery(catalog, normalizedQuery);
        const sourceResults = searchLocalizedNutritionCatalog(
          normalizedQuery,
          catalog.foods,
          catalog.prefixIndex,
          catalog.exactIndex,
          normalizedLimit,
          catalog.tokenIndex
        );

        sourceResults.forEach((food) => {
          (exactIds.has(food.id) ? exact : matches).push(food);
        });

        if (sourceResults.length) break;

      } catch (error) {
        lastError = error;
        console.warn(`Nutrition ${source.id} catalog search unavailable:`, error);
      }
    }

    return {
      result: mergeResults(exact, matches, normalizedLimit),
      loadedSourceCount,
      lastError
    };
  };

  // The token index is materially smaller than the prefix index and resolves
  // normal complete-word queries. Load the larger fallback indexes only when
  // the lightweight pass has no candidates.
  let search = await searchSources();
  let successfulSourceCount = search.loadedSourceCount;
  let lastError = search.lastError;
  if (!search.result.length) {
    search = await searchSources({ includeExactIndex: true });
    successfulSourceCount += search.loadedSourceCount;
    lastError = search.lastError || lastError;
  }
  if (!search.result.length && normalizedQuery.length >= 3) {
    search = await searchSources({ includeExactIndex: true, includePrefixIndex: true });
    successfulSourceCount += search.loadedSourceCount;
    lastError = search.lastError || lastError;
  }

  if (!successfulSourceCount) {
    throw lastError || new Error("Nutrition catalog load failed");
  }

  const result = search.result;
  cacheSearchResult(cacheKey, result);
  return result;
}

/**
 * Finds only literal alias/name matches from every local catalog layer.
 * Unlike normal search, this never mixes broad token results into the answer.
 */
export async function findExactLazyNutritionCatalogFoods(query) {
  const normalizedQuery = normalizeNutritionQuery(query);
  if (!normalizedQuery || normalizedQuery.length < 2) return [];

  const exactFoods = [];
  let loadedSourceCount = 0;
  let lastError = null;

  for (const source of CATALOG_SOURCES) {
    try {
      const catalog = await loadExactCatalog(source);
      loadedSourceCount += 1;
      const sourceFoods = resolveExactNutritionCatalogFoods(
        catalog.foods,
        catalog.exactIndex,
        normalizedQuery
      );
      exactFoods.push(...sourceFoods);
      if (sourceFoods.length) break;
    } catch (error) {
      lastError = error;
      console.warn(`Nutrition ${source.id} exact catalog lookup unavailable:`, error);
    }
  }

  if (!loadedSourceCount) {
    throw lastError || new Error("Nutrition catalog exact lookup failed");
  }

  return mergeResults(exactFoods, [], exactFoods.length || 1);
}

export async function findLazyNutritionCatalogByBarcode(barcode) {
  const normalizedBarcode = String(barcode || "").replace(/\s+/g, "");
  if (!normalizedBarcode) return null;

  let loadedSourceCount = 0;
  let lastError = null;

  for (const source of BARCODE_CATALOG_SOURCES) {
    try {
      const catalog = await loadBarcodeCatalog(source);
      loadedSourceCount += 1;
      const id = catalog.barcodeIndex[normalizedBarcode];
      const food = id ? catalog.foodsById.get(id) : null;
      if (food) return expandNutritionCatalogFood(food);
    } catch (error) {
      lastError = error;
      console.warn(`Nutrition ${source.id} barcode catalog unavailable:`, error);
    }
  }

  if (!loadedSourceCount && lastError) throw lastError;
  return null;
}
