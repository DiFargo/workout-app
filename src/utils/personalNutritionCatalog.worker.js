import { createPersonalCatalogSearch } from "./personalCatalogSearch.js";
import { unpackPersonalCatalogRow } from "./personalCatalogRows.js";
import { toPersonalNutritionFood } from "./personalNutritionFood.js";
import manifest from "../data/nutrition-catalog/personalCatalogManifest.json";
import basicFoods from "../data/nutrition-catalog/basicFoods.compact.json";

let loaded;
const active = new Set(), cancelled = new Set();
async function loadCatalog() {
  const url = `${manifest.url}?v=${manifest.hash}`;
  let cache;
  try { cache = await caches.open(`workout-personal-catalog-v2-${manifest.hash}`); } catch { /* Private mode can disable storage. */ }
  let response = await cache?.match(url);
  let fetched = false;
  if (!response) {
    response = await fetch(url);
    if (!response.ok) throw new Error("Каталог недоступен");
    fetched = true;
  }
  const copy = response.clone();
  let compact;
  try {
    compact = await response.json();
    if (!Array.isArray(compact) || compact.length !== manifest.count) throw new Error("Неполный каталог");
  } catch (error) {
    try {await cache?.delete(url);} catch { /* A cache failure must not hide the data error. */ }
    throw error;
  }
  // Start persistence before CPU indexing, but finish it before reporting the
  // full catalogue ready so an immediate offline reopen can reuse it. Each
  // version owns its cache: an old worker cannot remove the new payload.
  const persistence = fetched && cache ? cache.put(url, copy).catch(() => {}) : Promise.resolve();
  const rows = [...compact, ...basicFoods].map(unpackPersonalCatalogRow);
  const search = createPersonalCatalogSearch(rows);
  await persistence;
  return search;
}
self.onmessage = async ({ data }) => {
  if (data.cancel) {if (active.has(data.cancel)) cancelled.add(data.cancel); return;}
  active.add(data.id);
  try {
    if (!loaded) loaded = loadCatalog().catch(error => { loaded = null; throw error; });
    const search = await loaded;
    if (cancelled.has(data.id)) return;
    const foods = data.query ? search(data.query, {limit:40}).items.map(row => ({...toPersonalNutritionFood(row), searchMatchQuery: data.query.trim()})) : [];
    self.postMessage({id:data.id,foods});
  } catch(error) {if (!cancelled.has(data.id)) self.postMessage({id:data.id,error:error.message});}
  finally {active.delete(data.id);cancelled.delete(data.id);}
};
