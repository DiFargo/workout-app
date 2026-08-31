// Compatibility suggestions for existing saved food IDs. These are real USDA
// FoodData Central reference foods, not barcode-backed retail SKUs. The full
// source-backed catalog is loaded separately from public/nutrition-catalog.

const USDA_SOURCE = "USDA FoodData Central SR Legacy";
const fdcUrl = (id) => `https://fdc.nal.usda.gov/fdc-app.html#/food-details/${id}/nutrients`;

export const nutritionFoodDatabase = [
  { id: "food_chicken", name: "Chicken, broilers or fryers, breast, meat only, cooked, roasted", aliases: ["куриная грудка", "куриное филе"], portion: "100 г", calories: 165, protein: 31, fat: 3.57, carbs: 0, recordType: "reference_food", source: USDA_SOURCE, sourceUrl: fdcUrl("171477") },
  { id: "food_rice", name: "Rice, white, long-grain, regular, enriched, cooked", aliases: ["рис вареный", "рис белый вареный"], portion: "100 г", calories: 130, protein: 2.69, fat: 0.28, carbs: 28.2, recordType: "reference_food", source: USDA_SOURCE, sourceUrl: fdcUrl("168878") },
  { id: "food_buckwheat", name: "Buckwheat groats, roasted, cooked", aliases: ["гречка вареная", "гречка"], portion: "100 г", calories: 92, protein: 3.38, fat: 0.62, carbs: 19.9, recordType: "reference_food", source: USDA_SOURCE, sourceUrl: fdcUrl("170686") },
  { id: "food_egg", name: "Egg, whole, cooked, hard-boiled", aliases: ["яйцо вареное", "яйцо куриное"], portion: "100 г", calories: 155, protein: 12.6, fat: 10.6, carbs: 1.12, recordType: "reference_food", source: USDA_SOURCE, sourceUrl: fdcUrl("173424") },
  { id: "food_hard_cheese", name: "Сыр твёрдый", aliases: ["сыр", "твердый сыр", "чеддер"], portion: "100 г", calories: 350, protein: 25, fat: 27, carbs: 0, recordType: "reference_food", source: USDA_SOURCE, sourceUrl: fdcUrl("173414") },
  { id: "food_curd", name: "Cheese, cottage, creamed, large or small curd", aliases: ["творог", "творожный сыр"], portion: "100 г", calories: 98, protein: 11.1, fat: 4.3, carbs: 3.38, recordType: "reference_food", source: USDA_SOURCE, sourceUrl: fdcUrl("172179") },
  { id: "food_oatmeal", name: "Oats (Includes foods for USDA's Food Distribution Program)", aliases: ["овсянка", "овес"], portion: "100 г", calories: 389, protein: 16.9, fat: 6.9, carbs: 66.3, recordType: "reference_food", source: USDA_SOURCE, sourceUrl: fdcUrl("169705") },
  { id: "food_banana", name: "Bananas, raw", aliases: ["банан", "бананы"], portion: "100 г", calories: 89, protein: 1.09, fat: 0.33, carbs: 22.8, recordType: "reference_food", source: USDA_SOURCE, sourceUrl: fdcUrl("173944") },
  { id: "food_salmon", name: "Fish, salmon, Atlantic, wild, cooked, dry heat", aliases: ["лосось", "семга", "рыба"], portion: "100 г", calories: 182, protein: 25.4, fat: 8.13, carbs: 0, recordType: "reference_food", source: USDA_SOURCE, sourceUrl: fdcUrl("171998") },
  { id: "food_yogurt", name: "Yogurt, Greek, plain, nonfat (Includes foods for USDA's Food Distribution Program)", aliases: ["йогурт греческий", "греческий йогурт"], portion: "100 г", calories: 59, protein: 10.2, fat: 0.39, carbs: 3.6, recordType: "reference_food", source: USDA_SOURCE, sourceUrl: fdcUrl("170894") },
  { id: "food_protein", name: "Protein supplement, milk based, Muscle Milk Light, powder", aliases: ["протеиновая смесь", "протеин"], portion: "100 г", calories: 396, protein: 50, fat: 12, carbs: 22, recordType: "reference_food", source: USDA_SOURCE, sourceUrl: fdcUrl("173460") },
  { id: "food_apple", name: "Apples, raw, with skin (Includes foods for USDA's Food Distribution Program)", aliases: ["яблоко", "яблоки"], portion: "100 г", calories: 52, protein: 0.26, fat: 0.17, carbs: 13.8, recordType: "reference_food", source: USDA_SOURCE, sourceUrl: fdcUrl("171688") },
  { id: "food_potato", name: "Potatoes, boiled, cooked without skin, flesh, without salt", aliases: ["картофель вареный", "картошка вареная"], portion: "100 г", calories: 86, protein: 1.71, fat: 0.1, carbs: 20, recordType: "reference_food", source: USDA_SOURCE, sourceUrl: fdcUrl("170440") }
];
