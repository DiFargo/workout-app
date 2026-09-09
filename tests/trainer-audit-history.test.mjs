import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { programDraftSnapshot } from '../src/utils/trainerProgramDraft.js';
import { withSummaryDeadline } from '../src/utils/trainerSummaryReadState.js';

test('client history uses stable pages, preserves results on failure and drops late pages after switching client', async () => {
  let history=[], selected, fail=false, delayed, hold=false;
  const reads=[];
  const snapshot=(items)=>({size:items.length,docs:items,forEach:callback=>items.forEach(callback)});
  const item=(id)=>({id,data:()=>({date:`2026-09-${String(30-Number(id)%28).padStart(2,'0')}`})});
  const setHistory=(update)=>{history=typeof update==='function'?update(history):update;};
  const context={WeakMap, Map, Set, String, Number, Date, Promise, console, programDraftSnapshot, withSummaryDeadline,
    APP_PAGES:{ADMIN_USERS:'clients'},collection:(_db,...parts)=>({path:parts.join('/')}),doc:(_db,...parts)=>({path:parts.join('/')}),query:(ref,...constraints)=>({...ref,constraints}),orderBy:(...args)=>({order:args}),limit:n=>({limit:n}),startAfter:cursor=>({cursor}),
    getDoc:async ref=>({exists:()=>ref.path.split('/').length===2,id:ref.path.split('/')[1],data:()=>({role:'client'})}),
    getDocs:async ref=>{
      if(!ref.path.endsWith('/history'))return snapshot([]);
      reads.push(ref);
      assert.equal(ref.constraints.find(c=>c.limit)?.limit,80);
      const cursor=ref.constraints.find(c=>c.cursor)?.cursor;
      if(cursor){if(fail)throw Error('offline');if(hold)return new Promise(resolve=>{delayed=resolve;});return snapshot([item('79'),item('80')]);}
      return snapshot(Array.from({length:80},(_,i)=>item(String(i))));
    },buildAdminClientNutritionStateFromRoot:()=>({}),getDefaultAdminCalendar:()=>({}),getMeasurementTimestampValue:()=>0,getTrainerSummaryTimestamp:()=>0,normalizeExercise:e=>e,sortWorkoutDays:w=>w,isTrainerProgramClientVisible:()=>true,filterTrainerCurrentPlanWorkouts:w=>w};
  const source=await readFile(new URL('../src/features/trainer/trainerClientOverviewLoader.js',import.meta.url),'utf8');
  vm.runInNewContext(source.replace(/import\s[\s\S]*?from\s+"[^"]+";\r?\n/g,'').replace(/export /g,''),context);
  const noop=()=>{};
  const names=[...source.matchAll(/^  (set\w+),?$/gm)].map(m=>m[1]);
  const config=Object.fromEntries(names.map(name=>[name,noop]));
  Object.assign(config,{db:{},auth:{currentUser:{uid:'trainer'}},user:{uid:'trainer'},setAdminClientHistory:setHistory,setAdminSelectedClient:update=>{selected=typeof update==='function'?update(selected):update;},mirrorClientForTrainer:async()=>{},loadAdminTrainingTemplates:async()=>{}});
  const load=context.createTrainerClientOverviewLoader(config).loadAdminClientOverview;
  await load({id:'a'});
  assert.equal(history.length,80);assert.equal(selected.trainerHistoryHasMore,true);
  fail=true;assert.equal(await load({id:'a'},{historyPage:true}),false);assert.equal(history.length,80);
  fail=false;assert.equal(await load({id:'a'},{historyPage:true}),true);assert.equal(history.length,81);assert.equal(selected.trainerHistoryHasMore,false);
  await load({id:'a'});hold=true;const pending=load({id:'a'},{historyPage:true});await new Promise(resolve=>setTimeout(resolve,0));
  await load({id:'b'});delayed(snapshot([item('999')]));await pending;
  assert.equal(selected.id,'b');assert.equal(history.some(item=>item.id==='999'),false);
  assert.equal(reads.filter(ref=>ref.constraints.some(c=>c.cursor)).length,3);
});
