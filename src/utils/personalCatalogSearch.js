import { searchBrandGroups, createSearch, normalizeSearch as normalize } from "../../scripts/lib/belarusPersonalCatalog.mjs";
import { isPersonalCatalogRowSearchable } from "../../scripts/lib/personalCatalogQuarantine.mjs";

const containsPhrase = (text, phrase) => ` ${text} `.includes(` ${phrase} `);
const STOP_WORDS = new Set(["бренд", "бренда", "от", "продукт", "производитель"]);

// The general catalogue and instant basic suggestions share the same matching
// rules. Brand constraints are never silently discarded in the exact results.
export function createPersonalCatalogSearch(inputRows) {
  const rows = inputRows.filter(row => isPersonalCatalogRowSearchable(row));
  const search = createSearch(rows);
  const basicRows = rows.filter(row => row.sourceType === "reference");
  const searchBasics = createSearch(basicRows);
  const brands = searchBrandGroups.map(group => group.map(normalize));
  const knownBrands = new Set(brands.flat());
  for (const row of rows) {
    const brand = normalize(row.brand);
    // Legacy brand fields contain occasional category words (e.g. «Мюсли»).
    // Only reviewed manufacturer brands may extend the explicit brand list.
    if (row.sourceType === "manufacturer" && brand && !knownBrands.has(brand)) {brands.push([brand]); knownBrands.add(brand);}
  }
  const cache = new Map();
  return (query = "", { limit = 40, offset = 0 } = {}) => {
    const raw = normalize(query).slice(0, 128);
    const key = raw;
    let result = cache.get(key);
    if (!result) {
      const brand = brands.filter(group => group.some(alias => containsPhrase(raw, alias)))
        .sort((a, b) => Math.max(...b.map(s => s.length)) - Math.max(...a.map(s => s.length)))[0];
      let effectiveQuery = ` ${raw} `;
      if (brand) for (const alias of brand) effectiveQuery = effectiveQuery.replaceAll(` ${alias} `, ` ${brand[0]} `);
      let found = search(effectiveQuery.trim(), {limit: rows.length});
      let items = found.items;
      if (brand) items = items.filter(row => brand.includes(normalize(row.brand)) || brand.some(alias => containsPhrase(normalize(row.name), alias)));
      let genericFallback = false;
      if (!items.length && brand && !/^\d{8,14}$/.test(raw)) {
        let genericQuery = ` ${raw} `;
        for (const alias of brand) genericQuery = genericQuery.replaceAll(` ${alias} `, " ");
        genericQuery = genericQuery.trim().split(" ").filter(token => !STOP_WORDS.has(token)).join(" ");
        if (genericQuery.length >= 2) {
          found = searchBasics(genericQuery, {limit: basicRows.length});
          items = found.items.map(row => ({...row, searchFallback: true}));
          genericFallback = items.length > 0;
        }
      }
      // A plain food query should expose reliable basics before long lists of
      // branded flavours. Within each group retain the indexed search ranking.
      if (!brand && !/^\d{8,14}$/.test(raw)) {
        items = [...items.filter(row => row.sourceType === "reference"), ...items.filter(row => row.sourceType !== "reference")];
      }
      result = {items, corrected: found.corrected, genericFallback};
      if (cache.size >= 150) cache.delete(cache.keys().next().value);
      cache.set(key, result);
    }
    return {total: result.items.length, items: result.items.slice(offset, offset + limit), corrected: result.corrected, genericFallback: result.genericFallback};
  };
}
