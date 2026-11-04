export function normalizeAdminCatalogText(value) {
  return String(value ?? "").replace(/№/g, " ").normalize("NFKC").toLocaleLowerCase("ru")
    .replace(/ё/g, "е").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

export function matchesAdminCatalogSearch(text, query) {
  const haystack = normalizeAdminCatalogText(text);
  return normalizeAdminCatalogText(query).split(/\s+/).filter(Boolean)
    .every(token => haystack.includes(token));
}
