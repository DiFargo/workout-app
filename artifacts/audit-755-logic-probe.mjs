// Read-only audit: actual source functions, synthetic state, no network or real accounts.
import fs from 'node:fs/promises';
import vm from 'node:vm';
import { safeWriteJsonStorage } from '../src/utils/storageSafety.js';
import { mergeNutritionDays } from '../src/utils/auditSafety.js';
import { patchExerciseInTrainerTemplate } from '../src/utils/trainerExerciseLibrary.js';
import { getTrainerAssignedWorkoutCount, getTrainerCompletedWorkoutCountForAssignment } from '../src/utils/trainerClientSummary.js';

const results = [];
function record(id, details, defectPresent) { results.push({id, defectPresent, ...details}); }
async function load(path, bindings = {}) {
  const source = (await fs.readFile(path,'utf8')).replace(/^import[\s\S]*?from\s+["'][^"']+["'];?\s*$/gm,'').replace(/\bexport /g,'');
  const context = vm.createContext({console:{log(){},error(){}},Date,Math,Map,Set,Promise,...bindings});
  vm.runInContext(source,context,{filename:path});
  return context;
}
function deferred() { let resolve; const promise = new Promise(r=>resolve=r); return {promise,resolve}; }

let persisted;
globalThis.localStorage = {
  setItem(key,value) { if (value !== '[]') throw Object.assign(new Error('full'),{name:'QuotaExceededError'}); persisted=value; },
  getItem(){return null;}, length:0, key(){return null;}, removeItem(){}
};
const saved = safeWriteJsonStorage('workout_history_failed_queue_v1:synthetic',[{id:'A',entry:{clientSaveId:'A'}}]);
record('DATA-QUOTA',{saved,persisted},saved && persisted==='[]');
delete globalThis.localStorage;

let queue=[{id:'A',entry:{clientSaveId:'A'}}], completed=[];
const hold=deferred();
const replay = await load('src/features/client/offline/offlineReplayHandlers.js',{
  getFailedHistoryQueue:()=>queue, setFailedHistoryQueue:(_,value)=>queue=value,
  removePendingHistoryBackups(){}, doc:(...parts)=>parts,
  setDoc:async(_,entry)=>{await hold.promise;completed.push(entry.clientSaveId);}
});
const replaying = replay.replayFailedHistorySavesWithDeps({db:{},uid:'synthetic',historyReplayInProgressRef:{current:false},setWorkoutHistorySyncState(){},loadHistory:async()=>{},showAppError(){}});
queue=[{id:'B',entry:{clientSaveId:'B'}},...queue]; hold.resolve(); await replaying;
record('DATA-REPLAY',{cloud:completed,remaining:queue.map(x=>x.id)},!queue.some(x=>x.id==='B')&&!completed.includes('B'));

let nutritionQueue={nutrition:{id:'A'}};
const holdNutrition=deferred();
const nr=await load('src/features/client/offline/offlineReplayHandlers.js',{
  getFailedNutritionSync:()=>nutritionQueue, setFailedNutritionSync:(_,v)=>nutritionQueue=v,
  saveNutritionStateWithMerge:async()=>{await holdNutrition.promise;return {};},mergeNutritionStates:(a,b)=>({...a,...b})
});
const running=nr.replayFailedNutritionSyncWithDeps({uid:'synthetic',nutritionReplayInProgressRef:{current:false},setNutrition(){},showAppError(){}});
nutritionQueue={nutrition:{id:'B'}}; holdNutrition.resolve(); await running;
record('DATA-NUTRITION-REPLAY',{remaining:nutritionQueue},nutritionQueue===null);

let screen={days:{today:{foods:[{id:'new-food'}]}}};
const holdLoad=deferred();
const loader=await load('src/features/client/nutrition/nutritionCloudLoader.js',{
  doc(){},getDoc:async()=>{await holdLoad.promise;return {exists:()=>true,data:()=>({days:{}})};},getPersonalMyFoodsDocRef(){},
  safeReadUserJsonStorage:()=>({days:{}}),safeWriteUserJsonStorage(){},mergeNutritionStates:(local,cloud)=>({...local,...cloud})
});
const loading=loader.createNutritionCloudLoader({auth:{currentUser:{uid:'synthetic'}},db:{},NUTRITION_STORAGE_KEY:'test',startPerformanceCheck(){},endPerformanceCheck(){},showAppError(){},setNutrition:v=>screen=typeof v==='function'?v(screen):v,setNutritionCloudReady(){}}).loadNutritionFromFirebase('synthetic');
holdLoad.resolve();await loading;
record('DATA-NUTRITION-LOAD',{visibleFoods:screen.days.today?.foods||[]},!screen.days.today?.foods?.some(f=>f.id==='new-food'));

const dayA={foods:[{id:'food-A'}],updatedAt:'2026-09-09T10:00:00Z'};
const dayB={foods:[{id:'food-B'}],updatedAt:'2026-09-09T10:01:00Z'};
const merged=mergeNutritionDays({'2026-09-09':dayA},{'2026-09-09':dayB});
record('DATA-NUTRITION-MERGE',{foods:merged['2026-09-09'].foods.map(x=>x.id)},merged['2026-09-09'].foods.length!==2);
const merge=await load('src/utils/nutritionStateMerge.js',{defaultNutritionState:{goals:{},favorites:[]},getTimestampValue:v=>Date.parse(v)||0,mergeNutritionDays});
const restored=merge.mergeNutritionStates({updatedAt:'2026-09-09T11:00:00Z',favorites:[],myFoods:{}},{updatedAt:'2026-09-09T10:00:00Z',favorites:['old'],myFoods:{old:{id:'old'}}});
record('DATA-DELETED-RESURRECTS',{favorites:restored.favorites,myFoods:Object.keys(restored.myFoods)},restored.favorites.includes('old')&&Boolean(restored.myFoods.old));

const old={id:'template',ownerUid:'trainer',updatedByUid:'admin',workouts:[{id:'day',exercises:[{id:'e',name:'Original',video:'video',sets:[{reps:12}]}]}]};
let ui=[old],sent;
const editor=await load('src/features/trainer/trainerPlanEditorHandlers.js',{patchExerciseInTrainerTemplate});
const handlers=editor.createTrainerPlanEditorHandlers({adminTrainingTemplates:ui,setAdminTrainingTemplates:f=>ui=f(ui),auth:{currentUser:{uid:'trainer'}},setAdminClientStatus(){},doc(){},db:{},setDoc:async(_,data)=>{sent=data;throw new Error('permission-denied');}});
const edited=await handlers.updateTrainerLibraryExercise({...old.workouts[0].exercises[0],librarySource:{type:'template',templateId:'template'}},{name:'Unsaved'});
record('TRAINER-LIBRARY-SAVE',{reportedSuccess:edited,displayedName:ui[0].workouts[0].exercises[0].name,updatedByUid:sent.updatedByUid},!edited&&ui[0].workouts[0].exercises[0].name==='Unsaved');

const currentDays=Array.from({length:8},(_,i)=>({id:`day-${i}`,assignedProgramUpdatedAt:'new'}));
const count=getTrainerAssignedWorkoutCount({assignedWorkoutCount:9},currentDays);
const done=getTrainerCompletedWorkoutCountForAssignment([{workoutId:'day-0',assignedProgramUpdatedAt:'old'}],'new',{},currentDays);
record('TRAINER-SUMMARY',{staleProfileCount:9,currentDays:8,displayedCount:count,completedSameIdAfterVersionChange:done},count!==8);

await fs.writeFile('artifacts/audit-755-logic-results.json',JSON.stringify({checkedAt:new Date().toISOString(),environment:'synthetic source execution; no production writes',results},null,2));
console.log(JSON.stringify(results,null,2));
