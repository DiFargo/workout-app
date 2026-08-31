const VOICE_BEVERAGE_QUERIES = new Set([
  "кофе", "чай", "какао", "латте", "капучино", "американо",
  "эспрессо", "флэт уайт", "флет уайт", "сок", "лимонад", "вода", "квас"
]);
const VOICE_BEVERAGE_INGREDIENTS = new Set(["молоко", "сливки", "сахар", "сироп", "лимон", "мед"]);

function normalizeVoiceLookupText(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLocaleLowerCase("ru")
    .replace(/ё/g, "е")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getVoiceWords(value) {
  return normalizeVoiceLookupText(value).split(" ").filter(Boolean);
}

function haveMatchingVoiceWordForm(first, second) {
  if (!first || !second) return false;
  if (first === second) return true;

  const shortestLength = Math.min(first.length, second.length);
  if (shortestLength < 5) return false;

  let commonLength = 0;
  while (commonLength < shortestLength && first[commonLength] === second[commonLength]) {
    commonLength += 1;
  }

  return commonLength >= Math.max(5, shortestLength - 2);
}

function getVoiceBeveragePair(query) {
  const words = getVoiceWords(query);
  const separatorIndex = words.indexOf("с");
  if (separatorIndex < 1 || separatorIndex === words.length - 1) return null;

  const beverageQuery = words.slice(0, separatorIndex).join(" ");
  if (!VOICE_BEVERAGE_QUERIES.has(beverageQuery)) return null;

  return {
    beverageQuery,
    accompanimentWords: words.slice(separatorIndex + 1)
  };
}

function matchesVoiceAccompaniment(query, accompanimentWords) {
  const queryWords = getVoiceWords(query);
  return queryWords.some((queryWord) => accompanimentWords.some((word) => (
    haveMatchingVoiceWordForm(queryWord, word)
  )));
}

function isVoiceBeverageIngredient(word) {
  return Array.from(VOICE_BEVERAGE_INGREDIENTS).some((ingredient) => (
    haveMatchingVoiceWordForm(word, ingredient)
  ));
}

export function resolveOverlappingVoiceBeverageItems(items = []) {
  const result = (Array.isArray(items) ? items : []).map((item) => ({ ...item }));
  const removedIndexes = new Set();

  result.forEach((item, index) => {
    const beveragePair = getVoiceBeveragePair(item.query);
    if (!beveragePair) return;

    const accompanimentIndex = result.findIndex((otherItem, otherIndex) => (
      otherIndex !== index &&
      !removedIndexes.has(otherIndex) &&
      matchesVoiceAccompaniment(otherItem.query, beveragePair.accompanimentWords)
    ));
    if (accompanimentIndex < 0) return;

    const containsOnlyBeverageIngredient = beveragePair.accompanimentWords.every((word) => (
      isVoiceBeverageIngredient(word)
    ));
    if (containsOnlyBeverageIngredient) {
      removedIndexes.add(accompanimentIndex);
      return;
    }

    // "Кофе с шарлоткой" together with a separate "Шарлотка" means two
    // entries, not a duplicate composite dish. Keep the food and turn the
    // second item into the drink that was actually said.
    result[index] = { ...item, query: beveragePair.beverageQuery };
  });

  const seen = new Set();
  return result.filter((item, index) => {
    if (removedIndexes.has(index)) return false;

    const key = `${normalizeVoiceLookupText(item.query)}|${String(item.mealId || "auto").trim().toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
