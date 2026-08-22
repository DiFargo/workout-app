import assert from "node:assert/strict";
import test from "node:test";

import { getVoiceAveragePortionGrams } from "../src/features/client/nutrition/nutritionVoicePortions.js";

test("voice entries without a weight use a product-specific average serving", () => {
  assert.equal(getVoiceAveragePortionGrams({}, "банан"), 110);
  assert.equal(getVoiceAveragePortionGrams({}, "яблоко"), 155);
  assert.equal(getVoiceAveragePortionGrams({}, "яйцо"), 55);
  assert.equal(getVoiceAveragePortionGrams({}, "куриная грудка"), 150);
  assert.equal(getVoiceAveragePortionGrams({}, "гречка"), 180);
  assert.equal(getVoiceAveragePortionGrams({}, "йогурт"), 200);
  assert.equal(getVoiceAveragePortionGrams({}, "сырники с клюквой"), 160);
  assert.equal(getVoiceAveragePortionGrams({}, "флет уайт"), 250);
  assert.equal(getVoiceAveragePortionGrams({}, "сыр"), 30);
});

test("voice serving prefers a catalog-defined non-reference serving", () => {
  assert.equal(
    getVoiceAveragePortionGrams({ portion: "250 мл", portionAmount: 250 }, "молочный напиток"),
    250
  );
});
