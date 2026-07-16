export const defaultNutritionState = {
  goals: { calories: 2400, protein: 160, fat: 75, carbs: 260, water: 2500 },
  days: {},
  favorites: ["food_chicken", "food_rice", "food_curd", "food_protein"],
  recent: [],
  myFoods: {}
};

export const nutritionMeals = [
  { id: "breakfast", name: "Завтрак", icon: "🌅" },
  { id: "lunch", name: "Обед", icon: "☀️" },
  { id: "dinner", name: "Ужин", icon: "🌇" },
  { id: "snack", name: "Перекус/Другое", icon: "🌙" }
];

export const NUTRITION_ICON_PRESETS = [
  "🍗",
  "🥩",
  "🐟",
  "🥚",
  "🥛",
  "🧀",
  "🍚",
  "🥔",
  "🍞",
  "🥣",
  "🍌",
  "🍎",
  "🍓",
  "🥦",
  "🥗",
  "🍲",
  "☕",
  "🥤",
  "🍫",
  "🍽️"
];

export const LOCAL_NUTRITION_SEARCH_LIMIT = 24;
