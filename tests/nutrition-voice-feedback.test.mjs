import assert from "node:assert/strict";
import test from "node:test";

import { isNutritionVoiceSearchFailure } from "../src/features/client/nutrition/nutritionVoiceFeedback.js";

test("voice search failures are identified for a clear retry state", () => {
  assert.equal(isNutritionVoiceSearchFailure("Не удалось подобрать КБЖУ для этой записи."), true);
  assert.equal(isNutritionVoiceSearchFailure("Ничего не удалось распознать. Повторите запись."), true);
  assert.equal(isNutritionVoiceSearchFailure("Не нашли продукты в записи. Добавьте их вручную."), true);
  assert.equal(isNutritionVoiceSearchFailure("Нет подключения к интернету."), true);
  assert.equal(isNutritionVoiceSearchFailure("Добавлено позиций: 2."), false);
  assert.equal(isNutritionVoiceSearchFailure("Говорите…"), false);
});
