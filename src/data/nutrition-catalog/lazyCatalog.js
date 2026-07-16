import { searchLocalNutritionCatalog } from "./catalogSearch.js";

let catalogPromise;

async function loadCatalog() {
  if (!catalogPromise) {
    catalogPromise = Promise.all([
      fetch("/nutrition-catalog/foods.compact.json"),
      fetch("/nutrition-catalog/alias-prefix-index.json"),
      fetch("/nutrition-catalog/alias-exact-index.json")
    ])
      .then((responses) => {
        const failed = responses.find((response) => !response.ok);
        if (failed) throw new Error(`Nutrition catalog load failed: ${failed.status}`);
        return Promise.all(responses.map((response) => response.json()));
      })
      .then(([foods, prefixIndex, exactIndex]) => ({
        foods,
        prefixIndex,
        exactIndex
      }))
      .catch((error) => {
        catalogPromise = null;
        throw error;
      });
  }

  return catalogPromise;
}

export async function searchLazyNutritionCatalog(query, limit = 20) {
  const { foods, prefixIndex, exactIndex } = await loadCatalog();
  return searchLocalNutritionCatalog(query, foods, prefixIndex, exactIndex, limit);
}
