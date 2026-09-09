// Shared by the trainer library and client media lookup. Only reviewed names
// are aliases: fuzzy matching would erase differences in grip or equipment.
function normalizedName(value = "") {
  return String(value || "").trim().toLocaleLowerCase("ru").replace(/ё/g, "е")
    .replace(/[«»„“”"]/g, "").replace(/\s+/g, " ")
    .replace(/^св(?:ид|ел)ение рук/, "сведение рук");
}

const aliases = new Map([
  ["жим лежа с гантелями", "жим гантелей лежа"],
  ["присед с гантелью", "приседания с гантелью"],
  ["сгибание рук в тренажере скотта", "сгибание рук на скамье скотта в тренажере"],
  ["отведение рук с гантелями сидя в наклоне", "отведение рук с гантелями сидя на скамье в наклоне"],
  ["разгибание рук в кроссовере через рога с косичкой", "разгибание рук в кроссовере с косичкой через рога"],
  ["шаги альпиниста", "пресс шаги альпиниста"],
  ["пресс скручивания", "скручивания на пресс"],
  ["горизонтальная тяга блока", "тяга нижнего блока"],
  ["жим в тренажере на грудь", "жим сидя в тренажере на грудь"],
  ["разведения гантелей в стороны", "отведение рук с гантелями"]
].flatMap(([canonical, alias]) => [[canonical, canonical], [alias, canonical]]));

export function exerciseLibraryNameKey(name = "") {
  const key = normalizedName(name);
  return aliases.get(key) || key;
}

export function exerciseLibraryVariantKey(exercise = {}) {
  return JSON.stringify([exerciseLibraryNameKey(exercise.name), String(exercise.video || exercise.videoUrl || exercise.videoURL || "").trim()]);
}
