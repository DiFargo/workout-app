import { createSearch } from "../../scripts/lib/belarusPersonalCatalog.mjs";
import { toPersonalNutritionFood } from "./personalNutritionFood.js";
import manifest from "../data/nutrition-catalog/personalCatalogManifest.json";

let loaded;
async function loadCatalog() {
  const url = `${manifest.url}?v=${manifest.hash}`;
  let cache;
  try { cache = await caches.open("workout-personal-catalog-v1"); } catch { /* Private mode can disable storage. */ }
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
  if (fetched && cache) {
      try {
        await cache.put(url, copy);
        for (const key of await cache.keys()) if (key.url !== new URL(url, self.location.origin).href) await cache.delete(key);
      } catch { /* Search still works when persistent storage is full. */ }
  }
  const rows = compact.map(([id,name,brand,category,kcal,protein,fat,carbs,basis,aliases,barcodes,market,sourceType,nutritionConflict,sourceUrl])=>({
    id,name,brand,category,nutrition:{kcal,protein,fat,carbs,basis},aliases,barcodes,market,sourceType,nutritionConflict,sourceUrl,
  }));
  return createSearch(rows);
}
self.onmessage = async ({ data }) => {
  try {
    if (!loaded) loaded = loadCatalog().catch(error => { loaded = null; throw error; });
    const search = await loaded;
    const foods = data.query ? search(data.query, {limit:40}).items.map(toPersonalNutritionFood) : [];
    self.postMessage({id:data.id,foods});
  } catch(error) {self.postMessage({id:data.id,error:error.message});}
};
