import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { canAssignTrainerProgram, getTrainerProgramStatusMeta, isTrainerProgramArchived, TRAINER_PROGRAM_STATUSES } from '../src/utils/trainerProgramLifecycle.js';
import { getTrainerActionErrorStatus } from '../src/utils/trainerActionStatus.js';

const source = readFileSync(new URL('../src/features/trainer/trainerProgramTemplateHandlers.js', import.meta.url), 'utf8');
const start = source.indexOf('  async function assignSavedProgramToClient(');
const handlerSource = source.slice(start, source.indexOf('\n  async function copyCurrentProgramToClient', start));
function fixture(overrides = {}) {
  const statuses = [];
  let writes = 0;
  const template = { id: 'program', name: 'Программа', lifecycleStatus: 'ready' };
  const client = { id: 'client' };
  const context = vm.createContext({
    console: { error() {} }, selectedUserId: 'client', adminSelectedTemplateId: 'program',
    adminTrainingTemplates: [template], adminSelectedClient: client, usersList: [client],
    setAdminClientStatus: text => statuses.push(text), canManageTrainingTemplate: () => true,
    canManageClientProgram: () => true, getTrainerProgramStatusMeta, TRAINER_PROGRAM_STATUSES,
    isTrainerProgramArchived, getTrainerActionErrorStatus,
    STATUS_SELECT_CLIENT_PROGRAM: 'Выберите клиента и программу', STATUS_OWN_PROGRAMS_ONLY: 'Нет доступа',
    STATUS_SAVED_PROGRAM_NOT_FOUND: 'Программа не найдена', STATUS_PROGRAM_ARCHIVED: 'Программа в архиве',
    STATUS_ASSIGN_SAVED_FAILED: 'Не удалось назначить', STATUS_EVENT_PROGRAM_ASSIGNED: 'Назначена',
    db: {}, doc: () => ({}), getDoc: async () => ({ exists: () => true, id: 'program', data: () => template }),
    normalizeTrainerClientProgramName: value => value || template.name, buildTrainerClientProgramName: () => template.name,
    buildClientWorkoutsFromTemplate: () => [{ id: 'day' }], applyTrainerProgramAssignmentLoadAdjustments: w => w,
    validateTrainerWorkoutsForAssignment: () => ({ ok: true }), auth: { currentUser: { uid: 'trainer' } },
    attachAssignedProgramToWorkouts: (_t,w) => w,
    appendClientAssignedWorkouts: async () => { writes++; return { nextWorkouts: [], clientPatch: {} }; },
    requestTrainerExerciseCards: async () => ({ cards: [] }),
    trainerExerciseCards: [],
    mapTemplateExerciseCards: (value) => value,
    buildProgramAssignmentStatus: () => 'Назначена', setAdminSelectedClient() {}, setUsersList() {}, setPlan() {},
    sortWorkoutDays: w => w, recordTrainerEvent: async () => {}, ...overrides
  });
  const assign = vm.runInContext(`(${handlerSource.trim()})`, context);
  return { assign, statuses, writes: () => writes };
}

test('assignment choice rejects missing, draft and archived templates but preserves legacy ready templates', () => {
  for (const program of [undefined, { lifecycleStatus: 'draft' }, { lifecycleStatus: 'archived' }]) assert.equal(canAssignTrainerProgram(program), false);
  for (const program of [{ id: 'legacy' }, { lifecycleStatus: 'ready' }, { lifecycleStatus: 'assigned' }]) assert.equal(canAssignTrainerProgram(program), true);
});

test('assignment returns a readable draft error to the modal without writes; legacy caller still receives false', async () => {
  const f = fixture({ adminTrainingTemplates: [{ id: 'program', lifecycleStatus: 'draft' }] });
  await assert.rejects(f.assign('client','program',{ throwOnError:true }), e => e.assignmentMessage === 'Сначала подготовьте программу к назначению.');
  assert.equal(await f.assign('client','program'), false);
  assert.equal(f.writes(),0);
});

test('fresh server snapshot cannot assign a template changed to draft or archive', async () => {
  for (const lifecycleStatus of ['draft','archived']) {
    const f = fixture({ getDoc: async () => ({ exists: () => true, id: 'program', data: () => ({ lifecycleStatus }) }) });
    await assert.rejects(f.assign('client','program',{ throwOnError:true }), e => Boolean(e.assignmentMessage));
    assert.equal(f.writes(),0);
  }
});

test('validation, missing template and access failures reach the modal without becoming connection errors', async () => {
  for (const overrides of [
    { validateTrainerWorkoutsForAssignment: () => ({ ok:false, message:'Добавьте упражнения' }) },
    { getDoc: async () => ({ exists: () => false }) },
    { canManageClientProgram: () => false }
  ]) {
    const f = fixture(overrides);
    await assert.rejects(f.assign('client','program',{ throwOnError:true, skipConfirmation:true }), e => e.assignmentMessage === f.statuses.at(-1));
    assert.equal(f.writes(),0);
  }
});

test('Firebase permission failures preserve the specific explanation', async () => {
  const f = fixture({ getDoc: async () => { throw { code:'permission-denied' }; } });
  await assert.rejects(f.assign('client','program',{ throwOnError:true }), e => e.assignmentMessage.includes('Недостаточно прав'));
  assert.equal(f.writes(),0);
});

test('ready assignment retains its success result for opening the schedule', async () => {
  const f = fixture();
  const result = await f.assign('client','program',{ throwOnError:true, skipConfirmation:true });
  assert.equal(result.programId,'program');
  assert.match(result.assignmentKey,/^time:/);
  assert.equal(f.writes(),1);
});
