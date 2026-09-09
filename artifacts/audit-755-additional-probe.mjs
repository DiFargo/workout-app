import fs from 'node:fs/promises';
import vm from 'node:vm';
import {parseNutritionNumber,roundMacro} from '../src/utils/nutritionNumbers.js';
import {normalizeNutritionFood} from '../src/utils/nutritionFoodModel.js';
const strip=s=>s.replace(/^import[\s\S]*?from\s+["'][^"']+["'];?\s*$/gm,'').replace(/\bexport /g,'');
const results=[];
const measurements=await fs.readFile('src/features/client/profile/profileProgressHandlers.js','utf8');
const start=measurements.indexOf('  async function replayFailedMeasurementSaves(');
const end=measurements.indexOf('\n  return {',start);
let weight=null;
const measurementContext=vm.createContext({Date,console,auth:{currentUser:{uid:'synthetic'}},db:{},measurementReplayInProgressRef:{current:false},
  getFailedMeasurementQueue:()=>[{id:'new',measurement:{weight:78},aiNutritionProfile:{weight:78}},{id:'old',measurement:{weight:79},aiNutritionProfile:{weight:79}}],
  setFailedMeasurementQueue(){},doc:(_, ...path)=>path,loadProfileMeasurements:async()=>[],showAppError(){},setDoc:async(path,data)=>{if(path.length===2)weight=data.aiNutritionProfile.weight;}});
vm.runInContext(measurements.slice(start,end),measurementContext);await measurementContext.replayFailedMeasurementSaves();
results.push({id:'MEASUREMENT-REPLAY-ORDER',newestWeight:78,finalProfileWeight:weight,defectPresent:weight===79});
const dishContext=vm.createContext({Date,Math,Number,String,Array,parseNutritionNumber,roundMacro,normalizeNutritionFood,getFoodIcon:()=>'',getFoodPortionAmount:()=>100});
vm.runInContext(strip(await fs.readFile('src/utils/nutritionDish.js','utf8')),dishContext);
vm.runInContext(strip(await fs.readFile('src/features/client/nutrition/nutritionDishIngredientHandlers.js','utf8')),dishContext);
let dish={ingredients:[]};const handler=dishContext.createNutritionDishIngredientHandlers({setSelectedNutritionFood:fn=>dish=fn(dish),setDishIngredientPickerOpen(){},setDishIngredientSearch(){},setNutritionProductErrors(){}});
handler.addSelectedDishIngredientFromFood({id:'one',name:'A',calories:100},200);
handler.addSelectedDishIngredientFromFood({id:'two',name:'B',calories:200},-50);
results.push({id:'NEGATIVE-INGREDIENT',grams:dish.ingredients.map(x=>x.grams),weight:dish.totalWeight,calories:dish.calories,defectPresent:dish.ingredients.some(x=>x.grams<0)});
const functions=await fs.readFile('functions/index.js','utf8');
for(const endpoint of ['profileUpdateEmail','profileUpdateLogin']) {
  const writes=[];const database={collection:name=>({doc:id=>({name,id,get:async()=>({exists:false})})}),batch:()=>({set:(ref,data)=>writes.push({kind:'set',ref,uid:data.uid}),delete:ref=>writes.push({kind:'delete',ref}),commit:async()=>{}})};
  const ctx=vm.createContext({Date,console,onRequest:(_,fn)=>fn,json:(_,status,data)=>({status,data}),
    requireActiveMember:async()=>({uid:'synthetic-attacker',token:{auth_time:Date.now()/1000},userData:{email:'attacker@example.test',loginLower:'victim-alias',accountProfile:{}}}),
    enforceRateLimit:async()=>{},isValidLoginAlias:x=>/^[a-z0-9._-]{3,32}$/.test(x),normalizeAccountEmail:x=>String(x||'').toLowerCase(),normalizeLoginAlias:x=>String(x||'').toLowerCase(),getDefaultLoginAliasForEmail:x=>x.split('@')[0],getHttpErrorStatus:()=>500,
    admin:{auth:()=>({getUser:async()=>({email:'attacker@example.test'}),getUserByEmail:async()=>null,updateUser:async()=>{}}),firestore:()=>database}});
  const begin=functions.indexOf(`export const ${endpoint} =`),finish=functions.indexOf('\nexport const ',begin+1);
  vm.runInContext(functions.slice(begin,finish).replace('export const','var'),ctx);
  const response=await ctx[endpoint]({method:'POST',body:{email:'new@example.test',login:'attacker-new'}},{});
  const victimWrite=writes.find(x=>x.ref.name==='loginAliases'&&x.ref.id==='victim-alias');
  results.push({id:`ALIAS-${endpoint}`,status:response.status,victimWrite,defectPresent:Boolean(victimWrite)});
}
await fs.writeFile('artifacts/audit-755-additional-results.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
