function normalizeSearchText(value = "") {
  return String(value || "")
    .normalize("NFKC")
    .toLocaleLowerCase("ru")
    .replace(/ё/gu, "е")
    .replace(/[^\p{L}\p{N}\s.-]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

const FULL_CATALOGUE_URL = "/basic-workout/exercise-catalogue.v1.json";
let fullCataloguePromise = null;

/**
 * The large reference catalogue is intentionally lazy and is delivered as a
 * versioned static asset. Basic workout screens keep their small reviewed
 * library and do not load 800+ records on startup.
 */
export async function loadBasicWorkoutFullExerciseCatalogue({ fetcher = globalThis.fetch, url = FULL_CATALOGUE_URL } = {}) {
  if (typeof fetcher !== "function") throw new Error("Exercise catalogue loader requires fetch.");

  const shouldCache = url === FULL_CATALOGUE_URL && fetcher === globalThis.fetch;
  if (shouldCache && fullCataloguePromise) return fullCataloguePromise;

  const request = Promise.resolve(fetcher(url))
    .then(async (response) => {
      if (!response?.ok) throw new Error("Full exercise catalogue is unavailable.");
      const catalogue = await response.json();
      if (!Array.isArray(catalogue?.exercises) || Number(catalogue?.meta?.exerciseCount) !== catalogue.exercises.length) {
        throw new Error("Full exercise catalogue has an invalid format.");
      }
      return catalogue;
    });

  if (shouldCache) fullCataloguePromise = request;
  return request;
}

export async function searchBasicWorkoutFullExerciseCatalogue(query = "", { limit = 30, fetcher, url } = {}) {
  const normalizedQuery = normalizeSearchText(query);
  const safeLimit = Math.max(1, Math.min(100, Number(limit) || 30));
  const { exercises } = await loadBasicWorkoutFullExerciseCatalogue({ fetcher, url });

  if (!normalizedQuery) return exercises.slice(0, safeLimit);

  const queryTokens = normalizedQuery.split(" ").filter(Boolean);
  return exercises
    .map((exercise) => {
      const searchableText = normalizeSearchText(exercise.searchableText);
      const exactName = normalizeSearchText(exercise.name) === normalizedQuery;
      const sourceName = normalizeSearchText(exercise.sourceName) === normalizedQuery;
      const matchedTokens = queryTokens.filter((token) => searchableText.includes(token)).length;
      return { exercise, score: (exactName || sourceName ? 1000 : 0) + matchedTokens };
    })
    .filter(({ score }) => score >= queryTokens.length)
    .sort((left, right) => right.score - left.score || left.exercise.name.localeCompare(right.exercise.name, "ru"))
    .slice(0, safeLimit)
    .map(({ exercise }) => exercise);
}
