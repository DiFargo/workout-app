import test from "node:test";
import assert from "node:assert/strict";
import { encodeBackupJson, decodeBackupJson, compactExistingBackupStorage } from "../src/utils/backupStorageCodec.js";
import {addLocalBackup,safeReadJsonStorage,safeWriteJsonStorage} from "../src/utils/storageSafety.js";

const backups = () => Array.from({length:12},(_,i)=>({id:`snapshot-${i}`,savedAt:`date-${i}`,nutrition:{days:Object.fromEntries(Array.from({length:30},(_,j)=>[`day-${j}`,{foods:[{name:"Продукт",grams:100,notes:"Сохранить заметку",calories:105,source:"x".repeat(150)}]}])), goals:{calories:2500}},uniqueNote:`note-${i}`}));
function storage(seed,max=Infinity){const data=new Map(seed);return{get length(){return data.size;},key:i=>[...data.keys()][i],getItem:key=>data.get(key)??null,removeItem:key=>data.delete(key),setItem(key,value){const total=[...data].reduce((sum,[k,v])=>sum+(k===key?0:v.length),0)+value.length;if(total>max)throw Object.assign(new Error("full"),{name:"QuotaExceededError"});data.set(key,value);}};}

test("сжатие всех снимков без потери значений и без общих изменяемых объектов",()=>{
  const original=backups(),raw=JSON.stringify(original),compressed=encodeBackupJson(raw);
  assert.ok(compressed.length<raw.length*.5);
  const restored=decodeBackupJson(JSON.parse(compressed)); assert.deepEqual(restored,original);
  restored[0].nutrition.days["day-0"].foods[0].grams=200;
  assert.equal(restored[1].nutrition.days["day-0"].foods[0].grams,100);
  assert.equal(encodeBackupJson(compressed),compressed);
});

test("освобождение квоты сохраняет черновик, все снимки и очередь отправки",()=>{
  const key="workout_nutrition_backup_v1:test", value=backups(), raw=JSON.stringify(value);
  globalThis.localStorage=storage([[key,raw],["workout_history_pending_backup_v1:test",'["unsent"]'],["workout_active_draft_v1:test:one",'{"reps":12}']],raw.length+80);
  assert.equal(safeWriteJsonStorage("workout_tracker_v1:test",{plan:"new".repeat(300)}),true);
  assert.deepEqual(safeReadJsonStorage(key),value);
  assert.equal(localStorage.getItem("workout_history_pending_backup_v1:test"),'["unsent"]');
  assert.equal(localStorage.getItem("workout_active_draft_v1:test:one"),'{"reps":12}');
  assert.deepEqual(JSON.parse(localStorage.getItem("workout_tracker_v1:test")),{plan:"new".repeat(300)});
});

test("неуспешная замена не удаляет старую копию; повреждённые ссылки не исполняются",()=>{
  const key="workout_plan_backup_v1:test",raw=JSON.stringify(backups());
  const denied=storage([[key,raw]],0); assert.equal(compactExistingBackupStorage(denied,"test"),0);assert.equal(denied.getItem(key),raw);
  assert.throws(()=>decodeBackupJson({format:"ownset-backup-shared-v1",root:{r:0},pool:[["a",[{r:0}]]]}));
});

test("сжатие ограничено текущим аккаунтом и не работает без UID",()=>{
  const raw=JSON.stringify(backups()),store=storage([["workout_plan_backup_v1:a",raw],["workout_plan_backup_v1:b",raw]]);
  assert.equal(compactExistingBackupStorage(store),0);
  assert.ok(compactExistingBackupStorage(store,"a")>0);
  assert.equal(store.getItem("workout_plan_backup_v1:b"),raw);
});

test("повторное сохранение неизменённого плана не создаёт новую копию",()=>{
  const key="workout_plan_backup_v1:test",plan={workouts:[{id:"one",sets:[{reps:12}]}]};
  globalThis.localStorage=storage([]);
  addLocalBackup(key,{plan}); const raw=localStorage.getItem(key);
  addLocalBackup(key,{plan:structuredClone(plan)});assert.equal(localStorage.getItem(key),raw);
  addLocalBackup(key,{plan:{...plan,note:"Новое значение"}});assert.equal(safeReadJsonStorage(key).length,2);
});
