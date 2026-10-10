import test from "node:test";
import assert from "node:assert/strict";
import { fetchGeminiNutritionFoods, parseGeminiNutritionResponse } from "../functions/geminiNutritionSearch.js";

const food = { name: "Nutella", brand: "Ferrero", basis: "100g", calories: 539, protein: 6.3, fat: 30.9, carbs: 57.5, sourceTitle: "nutella.com" };
function response(foods = [food]) {
  return { candidates: [{ finishReason: "STOP", content: { parts: [{ text: JSON.stringify({ foods }) }] }, groundingMetadata: {
    webSearchQueries: ["Nutella nutrition"], groundingChunks: [{ web: { title: "nutella.com", uri: "https://nutella.com/nutrition" } }]
  } }] };
}
test("grounded results retain nutrition, review status and tool-provided source", () => {
  const result = parseGeminiNutritionResponse(response());
  assert.equal(result.foods[0].calories, 539);
  assert.equal(result.foods[0].requiresReview, true);
  assert.equal(result.foods[0].sources[0].url, "https://nutella.com/nutrition");
});
test("rejects missing macros, wrong basis, impossible values and ungrounded sources", () => {
  for (const change of [{protein:null},{fat:-1},{carbs:101},{basis:"100ml"},{sourceTitle:"invented.com"},{calories:9999}]) {
    assert.equal(parseGeminiNutritionResponse(response([{...food,...change}])).foods.length, 0);
  }
  const data = response();
  delete data.candidates[0].groundingMetadata;
  assert.deepEqual(parseGeminiNutritionResponse(data), { foods: [], sources: [] });
});
test("truncated or malformed responses are errors, not invented food", () => {
  const data = response();
  data.candidates[0].finishReason = "MAX_TOKENS";
  assert.throws(() => parseGeminiNutritionResponse(data), /не завершил/);
  data.candidates[0].finishReason = "STOP";
  data.candidates[0].content.parts[0].text = "not json";
  assert.throws(() => parseGeminiNutritionResponse(data), /некорректный/);
});
test("product source index must match the selected tool source", () => {
  assert.equal(parseGeminiNutritionResponse(response([{...food,sourceIndex:0}])).foods.length, 1);
  assert.equal(parseGeminiNutritionResponse(response([{...food,sourceIndex:5}])).foods.length, 0);
});
test("provider failures hide provider payload and preserve actionable quota status", async () => {
  await assert.rejects(fetchGeminiNutritionFoods("Nutella", "secret", async () => ({ok:false,status:429})), {status:429});
  const bodies = [];
  await fetchGeminiNutritionFoods("Nutella", "secret", async (_url, options) => {
    bodies.push(JSON.parse(options.body));
    return {ok:true,json:async()=>response()};
  });
  assert.deepEqual(bodies[0].tools, [{google_search:{}}]);
  assert.equal(bodies[1].tools, undefined);
});
