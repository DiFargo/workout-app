import { getPieceProductSizeProfile } from "../../../utils/nutritionPortions.js";

const DEFAULT_VOICE_PORTION_GRAMS = 150;
const MIN_VOICE_PORTION_GRAMS = 1;
const MAX_VOICE_PORTION_GRAMS = 2000;
const REFERENCE_PORTION_PATTERN = /^\s*100\s*(?:г|гр|g|мл|ml)\b/i;

const AVERAGE_VOICE_PORTION_RULES = [
  { pattern: /суп|борщ|уха|окрошк/, grams: 300 },
  { pattern: /салат|овощн/, grams: 200 },
  { pattern: /каша|овсян|греч|рис|макарон|паста|пюре/, grams: 180 },
  { pattern: /курин|индейк|говяд|свин|мяс|рыб|лосос|тунец|филе/, grams: 150 },
  { pattern: /йогурт|творог/, grams: 200 },
  { pattern: /флэт|флет|flat\s*white|латте|капучин|раф|американо|эспрессо/, grams: 250 },
  { pattern: /молоко|кефир|ряженк|айран|сок|чай|кофе|лимонад|кола|вода/, grams: 250 },
  { pattern: /хлеб|батон|лаваш/, grams: 40 },
  { pattern: /сырник/, grams: 160 },
  { pattern: /масло|майонез|кетчуп|соус/, grams: 15 },
  { pattern: /орех|семеч/, grams: 30 },
  { pattern: /шоколад|конфет|печень|батончик/, grams: 30 },
  { pattern: /сосиск|колбас/, grams: 55 },
  { pattern: /котлет|драник|блин/, grams: 80 },
  { pattern: /сыр/, grams: 30 },
  { pattern: /бургер/, grams: 180 }
];

function normalizeVoicePortionAmount(value) {
  const amount = Number(String(value ?? "").replace(",", "."));
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return Math.max(MIN_VOICE_PORTION_GRAMS, Math.min(MAX_VOICE_PORTION_GRAMS, Math.round(amount)));
}

function getVoiceFoodSearchText(food = {}, spokenQuery = "") {
  return [
    spokenQuery,
    food?.name,
    food?.brand,
    food?.category,
    ...(Array.isArray(food?.aliases) ? food.aliases : [])
  ]
    .map((value) => String(value || "").toLowerCase())
    .join(" ");
}

function getCatalogServingAmount(food = {}) {
  const portion = String(food?.portion || "").trim();
  const amount = normalizeVoicePortionAmount(food?.defaultGram ?? food?.defaultAmount ?? food?.portionAmount);
  if (!amount || REFERENCE_PORTION_PATTERN.test(portion)) return null;
  return amount;
}

function getMediumPieceAmount(food = {}, searchText = "") {
  const profile = getPieceProductSizeProfile({ ...food, name: searchText });
  const mediumSize = profile?.sizes?.find((size) => size.id === profile.defaultId) || profile?.sizes?.[0];
  return normalizeVoicePortionAmount(mediumSize?.amount);
}

/**
 * Returns a clearly marked best-effort average serving when a voice entry has no weight.
 * Nutrition values are still calculated only from the resolved source-backed catalog food.
 */
export function getVoiceAveragePortionGrams(food = {}, spokenQuery = "") {
  const searchText = getVoiceFoodSearchText(food, spokenQuery);
  const catalogServingAmount = getCatalogServingAmount(food);
  if (catalogServingAmount) return catalogServingAmount;

  const rule = AVERAGE_VOICE_PORTION_RULES.find((item) => item.pattern.test(searchText));
  if (rule) return rule.grams;

  const pieceAmount = getMediumPieceAmount(food, searchText);
  if (pieceAmount) return pieceAmount;

  return DEFAULT_VOICE_PORTION_GRAMS;
}
