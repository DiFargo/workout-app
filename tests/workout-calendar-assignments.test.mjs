import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { installRuntimeImports } from './helpers/runtime-imports.mjs';
import { createProgramDraft, programDraftSnapshot } from '../src/utils/trainerProgramDraft.js';
import { advanceAuthSession } from '../src/utils/authSession.js';
import { mergeWorkoutCalendarScope } from '../src/utils/workoutSchedule.js';

const cleanup = installRuntimeImports({ 'firebase/firestore': { doc: (_db, ...parts) => parts.join('/'), runTransaction: () => { throw Error('inject transaction I/O'); } } });
after(cleanup);
const { saveTrainerProgramDraft } = await import('../src/features/client/workouts/trainerProgramDraftPersistence.js');
const { rescheduleClientWorkout } = await import('../src/features/client/workouts/workoutReschedule.js');
const a = id => ({ id, name: id, assignedProgramId: 'program-a', assignedProgramAddedAt: 'assignment-a', assignedProgramUpdatedAt: 'v-a', status: 'planned', exercises: [{ id: 'e', name: 'Press', sets: [{ reps: 8, weight: 40 }] }] });
const slot = (id, date, assignment = 'assignment-a') => ({ workoutId: id, order: 1, date, status: 'planned', assignedProgramAddedAt: assignment, assignedProgramUpdatedAt: assignment === 'assignment-a' ? 'v-a' : 'v-b' });
function fixture() {
  const unrelated = { ...slot('b1', '2026-10-20', 'assignment-b'), status: 'missed', movedToDate: '2026-10-22', coachNote: 'keep', completedDate: '' };
  const calendar = { planRevision: 4, assignedProgramUpdatedAt: 'v-a', purchasedTrainings: 20, scheduledDates: ['2026-10-10', '2026-10-12', '2026-10-22'], plannedWorkouts: [slot('a1', '2026-10-10'), slot('a2', '2026-10-12'), unrelated] };
  const profile = { assignedProgramId: 'program-a', assignedProgramUpdatedAt: 'v-a', assignedProgramName: 'A', workoutCalendar: calendar, nutritionGoal: 2200 };
  const documents = new Map([['users/u', profile], ['users/u/workouts/a1', a('a1')], ['users/u/workouts/a2', a('a2')], ['users/u/workouts/b1', { id: 'b1', assignedProgramAddedAt: 'assignment-b' }]]);
  const writes = [];
  const run = async (_db, callback) => callback({
    get: async ref => ({ exists: () => documents.has(ref), data: () => structuredClone(documents.get(ref)) }),
    set: (...args) => writes.push(['set', ...args]), delete: ref => writes.push(['delete', ref])
  });
  const draft = createProgramDraft(['a1', 'a2'].map(id => ({ ...a(id), _editorSnapshot: programDraftSnapshot(a(id)) })), profile);
  draft.plan.workouts[0].exercises[0].sets[0].weight = 45;
  return { unrelated, profile, documents, draft, writes, run, save: () => saveTrainerProgramDraft({ db: {}, userId: 'u', authorId: 'trainer', draft, run }) };
}
test('editing assignment A preserves complete B slot metadata, subscription fields and global dates', async () => {
  const f = fixture();
  const result = await f.save();
  assert.deepEqual(result.workoutCalendar.plannedWorkouts.find(s => s.workoutId === 'b1'), f.unrelated);
  assert.deepEqual(result.workoutCalendar.scheduledDates, ['2026-10-10', '2026-10-12', '2026-10-22']);
  assert.equal(result.workoutCalendar.purchasedTrainings, 20);
  assert.equal(result.workoutCalendar.planRevision, 5);
  assert.equal(result.plan.workouts[0].exercises[0].sets[0].weight, 45);
  assert.deepEqual(f.writes.map(w => w[1]), ['users/u/workouts/a1', 'users/u']);
  assert.equal(f.documents.get('users/u').nutritionGoal, 2200);
});
test('deleting one A day removes only its calendar slot and retains future B', async () => {
  const f = fixture();
  f.draft.plan.workouts.pop();
  const result = await f.save();
  assert.deepEqual(result.workoutCalendar.plannedWorkouts.map(s => s.workoutId), ['a1', 'b1']);
  assert.ok(!result.workoutCalendar.scheduledDates.includes('2026-10-12'));
  assert.deepEqual(result.workoutCalendar.plannedWorkouts[1], f.unrelated);
  assert.ok(f.writes.some(w => w[0] === 'delete' && w[1] === 'users/u/workouts/a2'));
});
test('a concurrent calendar revision rejects the stale draft without any writes', async () => {
  const f = fixture();
  f.profile.workoutCalendar.planRevision++;
  f.profile.workoutCalendar.plannedWorkouts[2].coachNote = 'new concurrent B edit';
  await assert.rejects(f.save(), { code: 'program/conflict' });
  assert.equal(f.writes.length, 0);
  assert.equal(f.profile.workoutCalendar.plannedWorkouts[2].coachNote, 'new concurrent B edit');
});
test('fresh B edits from an older writer without a revision counter remain intact', async () => {
  const f = fixture();
  f.profile.workoutCalendar.plannedWorkouts[2].coachNote = 'updated B';
  const result = await f.save();
  assert.equal(result.workoutCalendar.plannedWorkouts.find(s => s.workoutId === 'b1').coachNote, 'updated B');
});
function rescheduleFixture() {
  const f = fixture();
  const auth = { currentUser: { uid: 'u' } }; advanceAuthSession(auth);
  const state = { calendar: null, dates: [], draft: [] };
  const cache = [];
  const errors = [];
  const args = { auth, db: {}, doc: (_db, ...parts) => parts.join('/'), plan: { workouts: [a('a1'), a('a2')] }, workoutId: 'a1', workoutIndex: 0, dateKey: '2026-10-12',
    // This stale UI snapshot omits B; persistence must use transaction data.
    workoutCalendar: { plannedWorkouts: [slot('a1', '2026-10-10')] },
    run: f.run, setWorkoutCalendar: update => { state.calendar = update(state.calendar); }, setScheduledDates: update => { state.dates = update(state.dates); }, setDraftDates: update => { state.draft = update(state.draft); }, persistCalendar: (...entry) => cache.push(entry), showError: error => errors.push(error) };
  return { ...f, auth, state, cache, errors, args };
}
test('reschedule A matches by ID, preserves B with the same order, and increments the latest revision', async () => {
  const f = rescheduleFixture();
  assert.equal(await rescheduleClientWorkout(f.args), true);
  assert.deepEqual(f.state.calendar.plannedWorkouts.find(s => s.workoutId === 'b1'), f.unrelated);
  assert.equal(f.state.calendar.planRevision, 5);
  assert.deepEqual(f.state.calendar.plannedWorkouts.filter(s => s.assignedProgramAddedAt === 'assignment-a').map(s => s.date), ['2026-10-12', '2026-10-14']);
  assert.deepEqual(f.state.dates, ['2026-10-12', '2026-10-14', '2026-10-22']);
  assert.equal(f.cache[0][0], 'u');
});
test('a retried reschedule transaction merges the newly committed B edit and revision', async () => {
  const f = rescheduleFixture();
  let attempts = 0;
  f.args.run = async (_db, callback) => {
    await f.run(_db, callback); // First attempt loses a concurrent-write race.
    f.writes.length = 0;
    f.profile.workoutCalendar.planRevision = 9;
    f.profile.workoutCalendar.plannedWorkouts[2].coachNote = 'concurrent B';
    attempts++;
    return f.run(_db, callback);
  };
  await rescheduleClientWorkout(f.args);
  assert.equal(attempts, 1);
  assert.equal(f.state.calendar.planRevision, 10);
  assert.equal(f.state.calendar.plannedWorkouts.find(s => s.workoutId === 'b1').coachNote, 'concurrent B');
  assert.equal(f.writes.length, 1);
});
test('logout then login as the same user object invalidates a delayed reschedule', async () => {
  const f = rescheduleFixture();
  let release; const gate = new Promise(resolve => { release = resolve; });
  f.args.run = async (db, callback) => { await gate; return f.run(db, callback); };
  const pending = rescheduleClientWorkout(f.args);
  const user = f.auth.currentUser;
  f.auth.currentUser = null; advanceAuthSession(f.auth);
  f.auth.currentUser = user; advanceAuthSession(f.auth);
  release();
  assert.equal(await pending, false);
  assert.equal(f.writes.length, 0);
  assert.equal(f.state.calendar, null);
  assert.equal(f.cache.length, 0);
  assert.equal(f.errors.length, 0);
});
test('reused IDs with different durable assignment markers never delete the other slot', () => {
  const other = slot('a1', '2026-10-20', 'assignment-b');
  const merged = mergeWorkoutCalendarScope({ plannedWorkouts: [slot('a1', '2026-10-10'), other] }, { plannedWorkouts: [slot('a1', '2026-10-12')], scheduledDates: ['2026-10-12'] }, [a('a1')]);
  assert.deepEqual(merged.plannedWorkouts[1], other);
});
