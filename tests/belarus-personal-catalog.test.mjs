import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {createSearch,identity,portionNutrition,validGtin,normalize,nutritionProblems} from '../scripts/lib/belarusPersonalCatalog.mjs';
import {unpackPersonalCatalogRow} from '../src/utils/personalCatalogRows.js';
const read=file=>JSON.parse(fs.readFileSync(new URL(`../${file}`,import.meta.url)));
const provenance=read('public/nutrition-catalog/personal/manufacturer-sources.json');
// The committed archive retains the original baseline before manufacturer additions.
// Local output/ exports are not available in a clean checkout and are not runtime inputs.
const baseline=read('public/nutrition-catalog/personal/products.json').slice(0,provenance.baseline.count);
const rows=baseline.map(unpackPersonalCatalogRow);
const offSources=new Map(read('public/nutrition-catalog/sku/foods.full.json').map(row=>[row.id,row]));
const search=createSearch(rows);
test('10,000 committed baseline identities preserve nutrition, source links and source market evidence',()=>{
  assert.equal(provenance.baseline.count,10000);
  assert.equal(createHash('sha256').update(JSON.stringify(baseline)).digest('hex'),provenance.baseline.rowsSha256);
  assert.equal(rows.length,10000);assert.equal(new Set(rows.map(r=>r.id)).size,10000);
  assert.equal(new Set(rows.map(identity)).size,10000);
  for(const r of rows){assert.ok(r.name.trim());assert.deepEqual(nutritionProblems(r.nutrition),[]);
    assert.ok(['openfoodfacts','gemini'].includes(r.sourceType));
    assert.ok(['BY','RU','unknown'].includes(r.market));
    if(r.sourceType==='gemini'){
      assert.equal(r.nutrition.basis,'unknown');assert.equal(r.market,'unknown');assert.equal(r.sourceUrl,null);
    }
    for(const c of r.barcodes)assert.ok(validGtin(c));
    if(r.sourceType==='openfoodfacts'){
      const original=offSources.get(r.id);assert.ok(original,`Missing committed source for ${r.id}`);
      assert.match(r.sourceUrl,/^https:\/\/world.openfoodfacts.org\/product\/\d+$/);
      assert.equal(r.sourceUrl,original.source.url);assert.ok(r.barcodes.includes(original.barcode));
      assert.deepEqual(r.nutrition,{basis:'100g',kcal:original.calories,protein:original.protein,fat:original.fat,carbs:original.carbs});
      assert.equal(r.market,original.source.marketScope==='belarus'?'BY':original.source.marketScope==='russia'?'RU':'unknown');
    }
  }
});
test('unknown portions and conflicting values cannot be silently multiplied',()=>{
  assert.equal(portionNutrition(rows.find(r=>r.sourceType==='gemini'),250),null);
  assert.equal(portionNutrition(rows.find(r=>r.nutritionConflict),250),null);
  const r=rows.find(r=>r.sourceType==='openfoodfacts'&&!r.nutritionConflict);
  assert.equal(portionNutrition(r,250).kcal,Math.round(r.nutrition.kcal*250)/100);
  assert.equal(portionNutrition(r,-1),null);
});
test('Russian, Latin brand spelling, prefixes, keyboard layout and typos find actual cards',()=>{
  assert.ok(search('теос').total>10);assert.ok(search('teos').total>10);
  assert.ok(search('экспонента').total>10);assert.ok(search('exponenta').total>10);
  assert.ok(search('савушкин творог 5%').total>0);
  const raw=search('творог').total;assert.equal(search('ndjhju').total,raw);
  assert.ok(search('твроог').total>0);assert.equal(search('asdasdasdzzzzzzzz').total,0);
  assert.ok(search('куриная грудка сырая').items.every(r=>/сыр|сыро/i.test(r.name)));
  assert.ok(search('куриная грудка вареная').items.every(r=>/варен|варён|отвар/i.test(r.name)));
});
test('barcode lookup is exact, market/category filters apply, page navigation is stable',()=>{
  const r=rows.find(r=>r.barcodes.length&&r.market==='BY');
  assert.equal(search(r.barcodes[0]).items[0].id,r.id);
  assert.equal(search('1234567891234').total,0);
  assert.ok(search('',{market:'BY',limit:10000}).items.every(r=>r.market==='BY'));
  assert.ok(search('творог',{source:'gemini'}).items.every(r=>r.sourceType==='gemini'));
  const first=search('творог',{limit:10}).items,second=search('творог',{offset:10,limit:10}).items;
  assert.equal(new Set([...first,...second].map(r=>r.id)).size,20);
  assert.equal(normalize('  ТВОРОГ 5,0% Ё '),'творог 5.0% е');
});
test('query results on the full catalogue stay below the interactive latency budget on this host',()=>{
  const find=createSearch(rows);
  const queries=['твор','творог','теос','савушкин','савушкин творог','экспонента','куриная грудка','молоко 2.5%','овсянка','гречка','сыр','банан','камако','петруха','4810268031793','твроог','ndjhju'];
  const durations=[];for(const q of queries){const start=performance.now();find(q);durations.push(performance.now()-start);}
  durations.sort((a,b)=>a-b);const p95=durations[Math.ceil(durations.length*.95)-1];
  assert.ok(p95<100,`p95 ${p95} ms exceeds 100 ms`);
});
