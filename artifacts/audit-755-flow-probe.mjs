import fs from 'node:fs/promises';
import vm from 'node:vm';
import { createWorkoutCountdownDeadline, getWorkoutCountdownRemainingSeconds } from '../src/features/client/workouts/workoutCountdownTimer.js';
const strip=s=>s.replace(/^import[\s\S]*?from\s+["'][^"']+["'];?\s*$/gm,'').replace(/\bexport /g,'');
let now=100000,seconds=90,running=true,refs=[],effects=[],pending=[],cursor=0,interval;
const ctx=vm.createContext({Date:{now:()=>now},Math,Number,
  useRef:v=>{const i=cursor++;return refs[i]||(refs[i]={current:v});},
  useEffect:(callback,deps)=>{const i=cursor++;const prev=effects[i];if(!prev||deps.some((d,j)=>!Object.is(d,prev.deps[j])))pending.push(()=>{prev?.cleanup?.();effects[i]={deps,cleanup:callback()};});},
  createWorkoutCountdownDeadline:(s)=>createWorkoutCountdownDeadline(s,now),getWorkoutCountdownRemainingSeconds:d=>getWorkoutCountdownRemainingSeconds(d,now),
  window:{setInterval:fn=>{interval=fn;return 1;},clearInterval(){},addEventListener(){},removeEventListener(){}},document:{addEventListener(){},removeEventListener(){}},navigator:{vibrate(){}}
});
const timerSource=await fs.readFile('src/features/client/workouts/useWorkoutRuntimeEffects.js','utf8');
vm.runInContext(strip(timerSource.slice(0,timerSource.indexOf('export function useWorkoutRuntimeEffects'))),ctx);
const setSeconds=value=>seconds=typeof value==='function'?value(seconds):value;
const setRunning=value=>running=value;
function render(){cursor=0;pending=[];ctx.useWallClockCountdown({completionVibration:'rest',seconds,running,setSeconds,setRunning});for(const effect of pending)effect();}
render();now+=1000;interval();render();const before=seconds;seconds+=15;render();const adjusted=seconds;now+=1000;interval();render();now+=1000;interval();render();
const results=[{id:'WORKOUT-TIMER-ADJUST',before,adjusted,afterTwoSeconds:seconds,running,defectPresent:seconds===adjusted}];

const foodSource=await fs.readFile('src/features/client/nutrition/nutritionMyFoodsHandlers.js','utf8');
let nutrition={myFoods:{old:{id:'old',name:'Yogurt'}},days:{'2026-09-08':{foods:[{id:'entry',foodId:'old',name:'Yogurt',source:'Моя база'}]}}};
const foods=vm.createContext({console,Date,Math,Map,Set,Promise,setTimeout:()=>1,clearTimeout(){},setDoc:async()=>{},makePersonalFoodKey:({name})=>name,
  safeWriteUserJsonStorage(){},addUserLocalBackup(){},getPersonalMyFoodsDocRef(){},saveNutritionStateWithMerge:async(_,state)=>state});
vm.runInContext(strip(foodSource),foods);
const handler=foods.createNutritionMyFoodsHandlers({auth:{currentUser:{uid:'synthetic'}},setNutrition:fn=>nutrition=fn(nutrition),showAppError(){},setRecentNutritionFoods(){}});
handler.removeMyNutritionFood('old','Yogurt');
results.push({id:'NUTRITION-LIBRARY-DELETES-HISTORY',pastDayFoods:nutrition.days['2026-09-08'].foods.length,defectPresent:nutrition.days['2026-09-08'].foods.length===0});

const orbit=await fs.readFile('src/features/client/nutrition/NutritionOrbit.jsx','utf8');
const bridge=orbit.match(/onVoiceDone=\{(\(\) => \{\s*onVoiceDone\?\.\(\);\s*closeVoiceModal\(\);\s*\})\}/)?.[1];
let added=0; const voice=vm.createContext({onVoiceDone:({commit=true}={})=>{if(commit)added++;},closeVoiceModal(){}});
vm.runInContext(`var bridge=${bridge}`,voice);voice.bridge({commit:false});
results.push({id:'VOICE-CANCEL-COMMITS',cancelRequested:true,added,defectPresent:added===1});
await fs.writeFile('artifacts/audit-755-flow-results.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
