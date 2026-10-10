import test from 'node:test';
import assert from 'node:assert/strict';
import {toPersonalNutritionFood,confirmPersonalNutritionBasis} from '../src/utils/personalNutritionFood.js';
import {normalizeNutritionFood} from '../src/utils/nutritionFoodModel.js';
const row={id:'gemini-1',name:'Кофе',brand:'Кофейня',aliases:[],barcodes:[],category:'Напитки',sourceType:'gemini',nutrition:{basis:'unknown',kcal:150,protein:6,fat:7,carbs:15}};
test('unknown units survive adaptation and normalization until the user chooses the base',()=>{
  const food=normalizeNutritionFood(toPersonalNutritionFood(row));
  assert.equal(food.nutritionBasisPending,true);assert.equal(food.calories,150);
  const confirmed=normalizeNutritionFood(confirmPersonalNutritionBasis(food,300,'ml'));
  assert.equal(confirmed.nutritionBasisPending,false);assert.equal(confirmed.calories,50);assert.equal(confirmed.portion,'100 мл');
  assert.equal(confirmed.protein,2);assert.match(confirmed.note,/300 мл/);
  assert.equal(confirmPersonalNutritionBasis(food,0,'ml'),null);
  assert.equal(confirmPersonalNutritionBasis(food,100,'oz'),null);
});
test('source values per 100 grams retain their units, source link and barcode',()=>{
  const food=normalizeNutritionFood(toPersonalNutritionFood({...row,id:'sku-4810268031793',sourceType:'openfoodfacts',sourceUrl:'https://world.openfoodfacts.org/product/4810268031793',barcodes:['4810268031793'],nutrition:{...row.nutrition,basis:'100g'}}));
  assert.equal(food.calories,150);assert.equal(food.nutritionBasisPending,false);
  assert.equal(food.barcode,'4810268031793');assert.equal(food.portion,'100 г');assert.equal(food.sources.length,1);
});
