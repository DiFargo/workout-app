import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeTrainerMonthProgram } from '../src/utils/trainerMonthProgramNormalization.js';
import { getTrainerProgramEditorSnapshot as snapshot } from '../src/utils/trainerProgramEditorSnapshot.js';
const program={id:'p',name:'Программа',blocks:[{id:'b',weeks:[{id:'w',workouts:[{id:'day',name:'Тренировка',exercises:[{id:'e',name:'Жим',sets:[{reps:'10',weight:'20'}]}]}]}]}]};
test('viewing and renormalizing a program does not create unsaved changes',()=>{
 const first=normalizeTrainerMonthProgram(program,{getNowIso:()=> '2026-09-01T00:00:00Z'});
 const later=normalizeTrainerMonthProgram(program,{getNowIso:()=> '2026-09-09T00:00:00Z'});
 assert.equal(snapshot(first),snapshot(later));
});
test('name, exercise, set and order edits still require saving; reverting removes changes',()=>{
 const original=normalizeTrainerMonthProgram(program);const baseline=snapshot(original);
 for(const edit of [p=>p.name='Другая',p=>p.blocks[0].weeks[0].workouts[0].exercises[0].name='Тяга',p=>p.blocks[0].weeks[0].workouts[0].exercises[0].sets[0].weight='25',p=>p.blocks[0].weeks[0].workouts.push({id:'new'})]){const changed=structuredClone(original);edit(changed);assert.notEqual(snapshot(changed),baseline)}
 const reverted=structuredClone(original);reverted.name='Изменение';reverted.name=original.name;assert.equal(snapshot(reverted),baseline);
});
