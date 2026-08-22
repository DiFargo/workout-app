import assert from "node:assert/strict";
import test from "node:test";
import {
  buildUpdatedNutritionVoiceItem,
  getNutritionVoiceItemEditDraft
} from "../src/features/client/nutrition/nutritionVoiceItemEditor.js";

test("voice review item editing updates portion and total nutrition", () => {
  const item = {
    id: "voice_review_1",
    kind: "review",
    name: "кукуруза",
    amount: 100,
    calories: 86,
    protein: 3.2,
    fat: 1.2,
    carbs: 19,
    food: { id: "my_ai_voice_corn", name: "кукуруза", calories: 86, protein: 3.2, fat: 1.2, carbs: 19 }
  };

  assert.deepEqual(getNutritionVoiceItemEditDraft(item), {
    name: "кукуруза", amount: 100, calories: 86, protein: 3.2, fat: 1.2, carbs: 19, saveToMyFoods: false
  });

  const updated = buildUpdatedNutritionVoiceItem(item, {
    name: "Кукуруза консервированная", amount: "150", calories: "80", protein: "3", fat: "1", carbs: "18"
  });

  assert.equal(updated.name, "Кукуруза консервированная");
  assert.equal(updated.amount, 150);
  assert.equal(updated.calories, 120);
  assert.equal(updated.protein, 4.5);
  assert.equal(updated.carbs, 27);
});

test("voice item editing rejects an empty name and invalid portion", () => {
  assert.equal(buildUpdatedNutritionVoiceItem({ amount: 100, name: "Яблоко" }, { name: "", amount: 100 }), null);
  assert.equal(buildUpdatedNutritionVoiceItem({ amount: 100, name: "Яблоко" }, { name: "Яблоко", amount: 0 }), null);
});
