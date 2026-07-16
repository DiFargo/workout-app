export function getFoodScale(amount, food = null, mode = "grams") {
  const parsedAmount = Number(String(amount).replace(",", "."));
  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) return 1;

  if (food?.type === "dish") {
    const dishBase = Number(food.totalWeight) || Number(food.portionAmount) || getFoodPortionAmount(food) || 100;
    return parsedAmount / (dishBase > 0 ? dishBase : 100);
  }

  if (mode === "portion") {
    const portionText = String(food?.portion || "").toLowerCase();
    const isPieceBased = portionText.includes("шт") || String(food?.name || "").toLowerCase().includes("яйц");
    const portionBase = Number(food?.portionAmount) || getFoodPortionAmount(food) || (isPieceBased ? parsedAmount : 100);

    if (isPieceBased) {
      return parsedAmount / (portionBase > 0 ? portionBase : parsedAmount);
    }

    return parsedAmount / (portionBase > 0 ? portionBase : 100);
  }

  return parsedAmount / 100;
}

export function getFoodPortionAmount(food) {
  const explicitAmount = Number(String(food?.portionAmount || "").replace(",", "."));
  if (Number.isFinite(explicitAmount) && explicitAmount > 0) return explicitAmount;

  const portion = String(food?.portion || "").toLowerCase();
  const match = portion.match(/(\d+[,.]?\d*)\s*(г|гр|g|мл|ml)/i);

  if (match) {
    const parsed = Number(String(match[1]).replace(",", "."));
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }

  const savedAmount = Number(String(food?.lastAmount || "").replace(",", "."));
  if (Number.isFinite(savedAmount) && savedAmount > 0) return savedAmount;

  return 100;
}

export function getPieceProductSizeProfile(food = {}) {
  const name = String(food?.name || "").toLowerCase();
  const portionText = String(food?.portion || "").toLowerCase();

  const isEgg = name.includes("яйц");
  if (isEgg) {
    return {
      type: "egg",
      defaultId: "medium",
      sizes: [
        { id: "small", label: "Мал.", hint: "≈45 г", amount: 45, portion: "1 маленькое яйцо" },
        { id: "medium", label: "Сред.", hint: "≈55 г", amount: 55, portion: "1 среднее яйцо" },
        { id: "large", label: "Бол.", hint: "≈65 г", amount: 65, portion: "1 большое яйцо" }
      ]
    };
  }

  const pieceKeywords = [
    "банан", "яблок", "апельсин", "мандарин", "груш",
    "персик", "киви", "помидор", "томат", "огурец",
    "картоф", "авокад", "лимон", "лайм", "лук",
    "морков", "сырник", "драник", "котлет", "блин",
    "булоч", "круассан", "сосиск", "колбаск",
    "бургер", "наггетс", "крылыш", "печень", "конфет"
  ];

  const fruitProfiles = [
    { keys: ["банан"], sizes: [["small", "Мал.", "60–90 г", 75, "1 маленький банан"], ["medium", "Сред.", "90–130 г", 110, "1 средний банан"], ["large", "Бол.", "160–200 г", 180, "1 большой банан"]] },
    { keys: ["яблок"], sizes: [["small", "Мал.", "90–130 г", 110, "1 маленькое яблоко"], ["medium", "Сред.", "130–180 г", 155, "1 среднее яблоко"], ["large", "Бол.", "180–240 г", 210, "1 большое яблоко"]] },
    { keys: ["апельсин"], sizes: [["small", "Мал.", "100–140 г", 120, "1 маленький апельсин"], ["medium", "Сред.", "140–190 г", 165, "1 средний апельсин"], ["large", "Бол.", "190–260 г", 220, "1 большой апельсин"]] },
    { keys: ["мандарин"], sizes: [["small", "Мал.", "40–60 г", 50, "1 маленький мандарин"], ["medium", "Сред.", "60–90 г", 75, "1 средний мандарин"], ["large", "Бол.", "90–120 г", 105, "1 большой мандарин"]] },
    { keys: ["груш"], sizes: [["small", "Мал.", "100–140 г", 120, "1 маленькая груша"], ["medium", "Сред.", "140–190 г", 165, "1 средняя груша"], ["large", "Бол.", "190–260 г", 220, "1 большая груша"]] },
    { keys: ["персик"], sizes: [["small", "Мал.", "90–130 г", 110, "1 маленький персик"], ["medium", "Сред.", "130–180 г", 155, "1 средний персик"], ["large", "Бол.", "180–230 г", 205, "1 большой персик"]] },
    { keys: ["киви"], sizes: [["small", "Мал.", "50–70 г", 60, "1 маленький киви"], ["medium", "Сред.", "70–100 г", 85, "1 средний киви"], ["large", "Бол.", "100–130 г", 115, "1 большой киви"]] },
    { keys: ["помидор", "томат"], sizes: [["small", "Мал.", "60–90 г", 75, "1 маленький помидор"], ["medium", "Сред.", "90–130 г", 110, "1 средний помидор"], ["large", "Бол.", "130–180 г", 155, "1 большой помидор"]] },
    { keys: ["огурец"], sizes: [["small", "Мал.", "80–120 г", 100, "1 маленький огурец"], ["medium", "Сред.", "120–180 г", 150, "1 средний огурец"], ["large", "Бол.", "180–250 г", 215, "1 большой огурец"]] },
    { keys: ["картоф"], sizes: [["small", "Мал.", "60–90 г", 75, "1 маленькая картофелина"], ["medium", "Сред.", "90–150 г", 120, "1 средняя картофелина"], ["large", "Бол.", "150–220 г", 185, "1 большая картофелина"]] }
  ];

  const profile = fruitProfiles.find((item) => item.keys.some((key) => name.includes(key)));
  if (profile) {
    return {
      type: "piece",
      defaultId: "medium",
      sizes: profile.sizes.map(([id, label, hint, amount, portion]) => ({ id, label, hint, amount, portion }))
    };
  }

  if (portionText.includes("шт")) {
    const amount = getFoodPortionAmount(food) || 100;
    return {
      type: "piece",
      defaultId: "medium",
      sizes: [
        { id: "piece", label: "1 шт.", hint: `≈${Math.round(amount)} г`, amount, portion: "1 шт" }
      ]
    };
  }

  const looksLikePieceProduct =
    pieceKeywords.some((keyword) => name.includes(keyword)) ||
    /(шт|шт\.|piece|pieces)/i.test(portionText);

  if (looksLikePieceProduct) {
    return {
      type: "piece",
      defaultId: "medium",
      sizes: [
        { id: "small", label: "Мал.", hint: "≈70 г", amount: 70, portion: "1 маленькая порция" },
        { id: "medium", label: "Сред.", hint: "≈120 г", amount: 120, portion: "1 средняя порция" },
        { id: "large", label: "Бол.", hint: "≈180 г", amount: 180, portion: "1 большая порция" }
      ]
    };
  }

  return null;
}
