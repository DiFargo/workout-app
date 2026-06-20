export function getSearchHistoryName(food) {
  const rawName = String(food?.name || "").trim();

  return rawName
    .replace(/\s+[—–-]\s+.*$/u, "")
    .replace(/\s*\(.*?\)\s*$/u, "")
    .replace(/[,;:]\s*.*$/u, "")
    .replace(/\s+\d+[,.]?\d*\s*(г|гр|g|мл|ml|ккал|кал|шт)\b.*$/iu, "")
    .trim();
}

export function getNutritionFoodSearchText(food) {
  return [food?.name, food?.brand, food?.note, food?.description]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function getFoodIcon(foodOrName = "") {
  const raw = typeof foodOrName === "string"
    ? foodOrName
    : `${foodOrName?.name || ""} ${foodOrName?.brand || ""} ${foodOrName?.source || ""} ${foodOrName?.portion || ""}`;

  const name = raw.toLowerCase().trim();

  const iconRules = [
    { icon: "🍌", keywords: ["банан", "banana"] },
    { icon: "🍎", keywords: ["яблок", "apple", "груш", "pear", "персик", "peach", "мандар", "апельс", "orange", "киви", "виноград", "ананас", "melon", "дын", "арбуз"] },
    { icon: "🍓", keywords: ["клубник", "малина", "ежев", "berry", "черник", "голубик"] },
    { icon: "🥑", keywords: ["авокад"] },
    { icon: "🥦", keywords: ["брокк", "овощ", "салат", "огур", "томат", "помид", "капуст", "морков", "зелень", "шпинат"] },
    { icon: "🥔", keywords: ["карто", "potato", "пюре"] },
    { icon: "🌽", keywords: ["кукуруз"] },
    { icon: "🍗", keywords: ["кур", "chicken", "индей", "наггет", "крыл", "грудк"] },
    { icon: "🥩", keywords: ["стейк", "говяд", "говя", "beef", "свин", "мяс", "котлет", "шашл"] },
    { icon: "🐟", keywords: ["рыб", "лосос", "семг", "тунец", "форел", "селед", "икра"] },
    { icon: "🍤", keywords: ["кревет", "shrimp", "морепр", "кальмар", "мидии"] },
    { icon: "🥚", keywords: ["яйц", "egg", "омлет"] },
    { icon: "🧀", keywords: ["сыр", "cheese", "моцар", "пармез", "гауда"] },
    { icon: "🥛", keywords: ["молок", "milk", "кефир", "йогур", "творог", "сырок", "сметан"] },
    { icon: "🧈", keywords: ["масло", "butter"] },
    { icon: "🍚", keywords: ["рис", "rice", "греч", "булгур", "перлов", "круп"] },
    { icon: "🥣", keywords: ["овся", "каша", "мюсли", "хлоп"] },
    { icon: "🍝", keywords: ["макарон", "паста", "спагет", "лапша", "noodle"] },
    { icon: "🍞", keywords: ["хлеб", "батон", "тост", "лаваш", "булоч"] },
    { icon: "🥐", keywords: ["круас", "croissant"] },
    { icon: "🍕", keywords: ["пицц", "pizza"] },
    { icon: "🍔", keywords: ["бургер", "burger", "шаур", "донер", "хот дог", "fast"] },
    { icon: "🌮", keywords: ["тако", "taco", "буррито"] },
    { icon: "🍣", keywords: ["суш", "ролл", "sushi"] },
    { icon: "🍲", keywords: ["суп", "борщ", "щи", "рагу"] },
    { icon: "🥗", keywords: ["цезарь", "салат"] },
    { icon: "🍰", keywords: ["торт", "cake", "пирож", "десерт"] },
    { icon: "🍪", keywords: ["печень", "cookie"] },
    { icon: "🍫", keywords: ["шокол", "snickers", "twix", "bounty"] },
    { icon: "🍦", keywords: ["морож", "ice cream"] },
    { icon: "🥜", keywords: ["орех", "арахис", "миндаль", "фисташ"] },
    { icon: "☕", keywords: ["кофе", "coffee", "латте", "капуч", "эспрессо"] },
    { icon: "🍵", keywords: ["чай", "tea", "matcha"] },
    { icon: "🥤", keywords: ["cola", "кола", "лимонад", "напит", "сок", "juice"] },
    { icon: "💧", keywords: ["вода", "water"] },
    { icon: "🍺", keywords: ["пиво", "beer"] },
    { icon: "🍷", keywords: ["вино", "wine"] },
    { icon: "💪", keywords: ["протеин", "protein", "гейнер", "bcaa"] }
  ];

  let bestMatch = null;
  let bestScore = 0;

  iconRules.forEach((rule) => {
    let score = 0;

    rule.keywords.forEach((keyword) => {
      if (name.includes(keyword)) {
        score += keyword.length;
      }
    });

    if (score > bestScore) {
      bestScore = score;
      bestMatch = rule.icon;
    }
  });

  return bestMatch || "🍽️";
}

export function getFoodDisplayPortion(food) {
  const portion = String(food?.portion || "100 г").trim();
  const lower = portion.toLowerCase();

  if (lower.includes("250") && lower.includes("мл")) return "250 мл (1 порция)";
  if (lower.includes("1 порц")) return "1 порция";
  if (lower.includes("100") && lower.includes("мл")) return "100 мл";
  if (lower.includes("мл")) return "100 мл";
  if (lower.includes("шт")) return "1 шт";
  return "100 г";
}

export function getFoodRskPercent(food, goals = {}) {
  const calories = Number(food?.calories) || 0;
  const goalCalories = Number(goals?.calories) || 2400;
  if (!goalCalories) return 0;
  return Math.max(1, Math.round((calories / goalCalories) * 100));
}

export function getShortFoodName(name) {
  return String(name || "Продукт")
    .replace(/\s+—\s+.*$/u, "")
    .replace(/\s+-\s+.*$/u, "")
    .replace(/\s*\(на\s+основе.*?\)\s*/iu, "")
    .replace(/\s*\(безлактозный.*?\)\s*/iu, "")
    .replace(/\s*\(упаковка.*?\)\s*/iu, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}
