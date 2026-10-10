import fs from "node:fs/promises";
import assert from "node:assert/strict";
import { createProgramDraft, programDraftSnapshot } from "../src/utils/trainerProgramDraft.js";
import { saveTrainerProgramDraft } from "../src/features/client/workouts/trainerProgramDraftPersistence.js";
import { persistWorkoutCompletion, deleteOwnWorkoutHistory } from "../src/features/client/workouts/workoutCompletionPersistence.js";
import { persistMeasurement } from "../src/features/client/profile/measurementPersistence.js";
import { patchLibraryExercise, persistTrainerTemplateEdit } from "../src/utils/trainerLibraryEditing.js";
import { buildTrainerClientProgramName } from "../src/utils/trainerClientProgramName.js";
import { buildClientProgramLifecycleMetadata, buildProgramAssignmentMetadata } from "../src/utils/trainerProgramLifecycle.js";
import { after, before, beforeEach, test } from "node:test";

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment
} from "@firebase/rules-unit-testing";
import { deleteDoc, doc, getDoc, setDoc, updateDoc, writeBatch } from "firebase/firestore";

let testEnv;

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: "workout-app-rules-test",
    firestore: {
      rules: await fs.readFile(new URL("../firestore.rules", import.meta.url), "utf8")
    }
  });
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

after(async () => {
  await testEnv?.cleanup();
});

test("owner task permissions cannot bypass trainer-only fields, payments or private collections", async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, "users/client-1"), { role: "client", trainerId: "trainer-1", loginLower: "own", accountProfile: { login: "own", email: "client@example.test" } });
    await setDoc(doc(db, "users/trainer-1"), { role: "trainer" });
    await setDoc(doc(db, "users/trainer-2"), { role: "trainer" });
    await setDoc(doc(db, "users/client-1/trainerTasks/task"), { title: "Coach task", status: "pending" });
  });
  const db = testEnv.authenticatedContext("client-1").firestore();
  await assertSucceeds(updateDoc(doc(db, "users/client-1/trainerTasks/task"), { status: "completed" }));
  await assertFails(updateDoc(doc(db, "users/client-1/trainerTasks/task"), { title: "Forged" }));
  await assertFails(deleteDoc(doc(db, "users/client-1/trainerTasks/task")));
  await assertFails(setDoc(doc(db, "users/client-1/payments/current"), { paid: true }));
  await assertFails(setDoc(doc(db, "users/client-1/serverOnly/secret"), { value: true }));
  await assertFails(updateDoc(doc(db, "users/client-1"), { loginLower: "victim" }));
  await assertFails(updateDoc(doc(db, "users/client-1"), { "accountProfile.login": "victim" }));
  await assertFails(updateDoc(doc(db, "users/client-1"), { "accountProfile.email": "victim@example.test" }));
  await assertFails(updateDoc(doc(db, "users/client-1"), { profileIdentityOperation: { email: "victim@example.test" } }));
  await assertSucceeds(updateDoc(doc(db, "users/client-1"), { "accountProfile.displayName": "New name" }));
  for (const name of ["history", "nutrition", "measurements"]) await assertSucceeds(setDoc(doc(db, "users", "client-1", name, "new"), { date: "2026-09-09" }));
  await assertSucceeds(setDoc(doc(testEnv.authenticatedContext("trainer-1").firestore(), "users/client-1/payments/current"), { paid: true }));
  await assertFails(setDoc(doc(testEnv.authenticatedContext("trainer-2").firestore(), "users/client-1/payments/current"), { paid: true }));
});

test("only the assigned trainer can mark test clients without changing their workouts", async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    for (const id of ["trainer-1", "trainer-2"]) await setDoc(doc(context.firestore(), "users", id), { role: "trainer" });
    await setDoc(doc(context.firestore(), "users/client-1"), { role: "client", trainerId: "trainer-1" });
    await setDoc(doc(context.firestore(), "users/client-1/workouts/keep"), { name: "Keep this workout" });
  });
  const own = testEnv.authenticatedContext("client-1").firestore();
  const trainer = testEnv.authenticatedContext("trainer-1").firestore();
  await assertFails(updateDoc(doc(own, "users/client-1"), { isTest: true }));
  await assertFails(updateDoc(doc(testEnv.authenticatedContext("trainer-2").firestore(), "users/client-1"), { isTest: true }));
  await assertSucceeds(updateDoc(doc(trainer, "users/client-1"), { isTest: true }));
  await assertSucceeds(updateDoc(doc(trainer, "users/client-1"), { isTest: false }));
  assert.equal((await getDoc(doc(own, "users/client-1/workouts/keep"))).data().name, "Keep this workout");
});

test("basic offline completion persists the shifted calendar and profile plan in the same transaction", async () => {
  const day = (id, date) => ({ id, scheduledDate: date, plannedDate: date, exercises: [{ id: "ex", name: "Press", sets: [{ weight: "20", reps: "10" }] }] });
  const plan = { source: "basic", basicPlanId: "basic-test", workouts: [day("one", "2026-09-01"), day("two", "2026-09-03")] };
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, "users/client-1"), { role: "client", basicWorkoutPlan: plan });
    for (const item of plan.workouts) await setDoc(doc(db, "users/client-1/workouts", item.id), item);
  });
  const db = testEnv.authenticatedContext("client-1").firestore();
  const workout = { ...plan.workouts[0], exercises: [{ id: "ex", name: "Press", sets: [{ enteredWeight: "25", reps: "10", completed: true }] }] };
  const entry = { clientSaveId: "basic-save", workoutId: "one", finishedAt: "2026-09-05T12:00:00Z" };
  await assertSucceeds(persistWorkoutCompletion({ db, uid: "client-1", entry, completion: { plan, workout } }));
  const user = (await getDoc(doc(db, "users/client-1"))).data();
  const nextDay = (await getDoc(doc(db, "users/client-1/workouts/two"))).data();
  assert.equal(nextDay.scheduledDate, "2026-09-07");
  assert.equal(nextDay.exercises[0].sets[0].weight, "25");
  assert.equal(user.basicWorkoutPlan.workouts[1].scheduledDate, nextDay.scheduledDate);
  assert.ok(user.workoutCalendar.scheduledDates.includes(nextDay.scheduledDate));
  assert.equal((await getDoc(doc(db, "users/client-1/history/basic-save"))).exists(), true);
});

test("offline completion applies progression once, preserves a changed prescription, and cannot resurrect a deleted history record", async () => {
  const day = (id, weight) => ({ id, name: id, assignedProgramId: "plan", assignedProgramUpdatedAt: "version", exercises: [{ id: "press", name: "Press", sets: [{ reps: "12", weight: String(weight) }] }] });
  const plan = { assignedProgramId: "plan", assignedProgramUpdatedAt: "version", workouts: [day("w1", 20), day("w2", 20)] };
  const workout = { ...plan.workouts[0], exercises: [{ id: "press", name: "Press", sets: [{ reps: "12", weight: "25", enteredWeight: "25", completed: true }] }] };
  const entry = { clientSaveId: "save1", workoutId: "w1", assignedProgramId: "plan", assignedProgramUpdatedAt: "version", finishedAt: "2026-09-09T10:00:00Z", exercises: workout.exercises };
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, "users/client-1"), { role: "client", assignedProgramId: "plan", assignedProgramUpdatedAt: "version" });
    for (const workout of plan.workouts) await setDoc(doc(db, "users/client-1/workouts", workout.id), workout);
  });
  const db = testEnv.authenticatedContext("client-1").firestore();
  const save = () => persistWorkoutCompletion({ db, uid: "client-1", entry, completion: { plan, workout } });
  await assertSucceeds(save());
  assert.equal((await getDoc(doc(db, "users/client-1/workouts/w2"))).data().exercises[0].sets[0].weight, "25");
  await updateDoc(doc(db, "users/client-1/workouts/w2"), { exercises: day("w2", 30).exercises });
  await save();
  assert.equal((await getDoc(doc(db, "users/client-1/workouts/w2"))).data().exercises[0].sets[0].weight, "30");
  await persistWorkoutCompletion({ db, uid: "client-1", entry: { ...entry, clientSaveId: "save2" }, completion: { plan, workout } });
  assert.equal((await getDoc(doc(db, "users/client-1/workouts/w2"))).data().exercises[0].sets[0].weight, "30");
  await deleteOwnWorkoutHistory({ db, uid: "client-1", id: "save1" });
  assert.equal((await save()).deleted, true);
  assert.equal((await getDoc(doc(db, "users/client-1/history/save1"))).exists(), false);
  assert.equal((await getDoc(doc(db, "users/client-1/history/save2"))).exists(), true);
  assert.equal((await getDoc(doc(db, "users/client-1/workouts/w1"))).exists(), true);
});

test("measurement replay in newest-first order preserves latest weight and unrelated profile fields", async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => setDoc(doc(context.firestore(), "users/client-1"), { role: "client", aiNutritionProfile: { weight: "80", goal: "recomp" } }));
  const db = testEnv.authenticatedContext("client-1").firestore();
  for (const [id, weight, date] of [["new", "78", "2026-09-09T10:00:00Z"], ["old", "79", "2026-09-08T10:00:00Z"]]) {
    await assertSucceeds(persistMeasurement({ db, uid: "client-1", item: { id, profileWeight: weight, aiNutritionProfile: { goal: "stale" }, measurement: { id, weight, date } } }));
  }
  const profile = (await getDoc(doc(db, "users/client-1"))).data().aiNutritionProfile;
  assert.equal(profile.weight, "78");
  assert.equal(profile.goal, "recomp");
  assert.equal((await getDoc(doc(db, "users/client-1/measurements/old"))).data().weight, "79");
});

test("library edit reads a fresh template, stamps the actor, rejects a conflicting edit and leaves client workouts unchanged", async () => {
  const exercise = { id: "e1", name: "Жим ногами", rest: "90 сек", video: "https://example.test/video.mp4", sets: [{ reps: 12, weight: 30 }] };
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, "users/trainer-1"), { role: "trainer" });
    await setDoc(doc(db, "users/trainer-2"), { role: "trainer" });
    await setDoc(doc(db, "users/client-1"), { role: "client", trainerId: "trainer-1" });
    await setDoc(doc(db, "trainingTemplates/template"), { ownerUid: "trainer-1", createdByUid: "trainer-1", updatedByUid: "trainer-1", name: "Fresh name", workouts: [{ id: "day", exercises: [exercise] }] });
    await setDoc(doc(db, "users/client-1/workouts/day"), { exercises: [exercise] });
  });
  const db = testEnv.authenticatedContext("trainer-1").firestore();
  const args = { db, templateId: "template", uid: "trainer-1", canManage: (template) => template.ownerUid === "trainer-1", mutate: (template) => patchLibraryExercise(template, exercise, { rest: "60 сек" }) };
  await assertSucceeds(persistTrainerTemplateEdit(args));
  const saved = (await getDoc(doc(db, "trainingTemplates/template"))).data();
  assert.equal(saved.name, "Fresh name");
  assert.equal(saved.updatedByUid, "trainer-1");
  assert.equal(saved.workouts[0].exercises[0].rest, "60 сек");
  await assert.rejects(persistTrainerTemplateEdit({ ...args, mutate: (template) => patchLibraryExercise(template, exercise, { rest: "120 сек" }) }), /другом окне/);
  await assertFails(persistTrainerTemplateEdit({ ...args, db: testEnv.authenticatedContext("trainer-2").firestore(), uid: "trainer-2" }));
  assert.equal((await getDoc(doc(db, "users/client-1/workouts/day"))).data().exercises[0].rest, "90 сек");
});

test("assigned editor transaction saves once, reloads, rejects stale tabs and revoked access", async () => {
  const profile = { role: "client", trainerId: "trainer-1", assignedProgramId: "p1", assignedProgramName: "Plan", assignedProgramUpdatedAt: "v1", assignedProgramLifecycleStatus: "active", assignedProgramVisibility: "client_active", assignedProgramAssignedByUid: "trainer-1", workoutCalendar: { planRevision: 0 } };
  const workout = { id: "w1", name: "Press", assignedProgramId: "p1", assignedProgramUpdatedAt: "v1", assignedProgramName: "Plan", assignedBy: "trainer-1", assignedProgramLifecycleStatus: "active", assignedProgramVisibility: "client_active", status: "planned", exercises: [{ id: "e1", name: "Press", sets: [{ reps: 12, weight: 20 }] }] };
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, "users", "trainer-1"), { role: "trainer" });
    await setDoc(doc(db, "users", "trainer-2"), { role: "trainer" });
    await setDoc(doc(db, "users", "client-1"), profile);
    await setDoc(doc(db, "users", "client-1", "workouts", "w1"), workout);
    await setDoc(doc(db, "users", "client-1", "history", "h1"), { date: "2026-09-01", exercises: [{ weight: 10 }] });
  });
  const db = testEnv.authenticatedContext("trainer-1").firestore();
  const draft = createProgramDraft([{ ...workout, _editorSnapshot: programDraftSnapshot(workout) }], profile);
  draft.plan.workouts[0].exercises[0].sets[0].weight = 25;
  draft.plan.assignedProgramName = "New name";
  const save = () => saveTrainerProgramDraft({ db, userId: "client-1", authorId: "trainer-1", draft });
  const saved = await assertSucceeds(save());
  assert.equal((await getDoc(doc(db, "users", "client-1", "workouts", "w1"))).data().exercises[0].sets[0].weight, 25);
  assert.equal((await getDoc(doc(db, "users", "client-1"))).data().assignedProgramName, "New name");
  assert.equal((await getDoc(doc(db, "users", "client-1", "history", "h1"))).data().exercises[0].weight, 10);
  await assert.rejects(save, { code: "program/conflict" });
  const addition = createProgramDraft(saved.plan.workouts, { ...profile, ...saved.clientPatch });
  addition.plan.workouts.push({ id: "w2", name: "Another day", exercises: [] });
  await assertSucceeds(saveTrainerProgramDraft({ db, userId: "client-1", authorId: "trainer-1", draft: addition }));
  assert.equal((await getDoc(doc(db, "users", "client-1", "workouts", "w2"))).data().assignedBy, "trainer-1");
  await assertFails(setDoc(doc(db, "users", "client-1", "workouts", "foreign"), { ...workout, id: "foreign", assignedProgramId: "foreign-template" }));
  await assertFails(saveTrainerProgramDraft({ db: testEnv.authenticatedContext("trainer-2").firestore(), userId: "client-1", authorId: "trainer-2", draft }));
  await testEnv.withSecurityRulesDisabled(async (context) => updateDoc(doc(context.firestore(), "users", "client-1"), { trainerId: "trainer-2" }));
  await assertFails(save());
});

test("client profile creation requires a trainer invite", async () => {
  const clientDb = testEnv.authenticatedContext("client-1").firestore();

  await assertFails(setDoc(doc(clientDb, "users", "client-1"), {
    email: "client@example.com",
    role: "client",
    name: "Client"
  }));

  await assertFails(setDoc(doc(clientDb, "users", "client-1"), {
    email: "client@example.com",
    role: "trainer"
  }));
});

test("profile owner can update normal fields but cannot change protected fields", async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "users", "client-1"), {
      role: "client",
      name: "Old name"
    });
  });

  const clientDb = testEnv.authenticatedContext("client-1").firestore();
  await assertSucceeds(updateDoc(doc(clientDb, "users", "client-1"), {
    name: "New name"
  }));
  await assertFails(updateDoc(doc(clientDb, "users", "client-1"), {
    role: "admin"
  }));
  await assertFails(updateDoc(doc(clientDb, "users", "client-1"), {
    assignedProgramLifecycleStatus: "active"
  }));
  await assertFails(updateDoc(doc(clientDb, "users", "client-1"), {
    subscription: { endDate: "2099-12-31", remainingSessions: 999 }
  }));
  await assertFails(updateDoc(doc(clientDb, "users", "client-1"), {
    telegram: { chatId: "attacker-chat", telegramUserId: "attacker-user" }
  }));
});

test("legacy profile without a role can restore only its own client access", async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "users", "legacy-client"), {
      name: "Legacy client",
      active: true
    });
    await setDoc(doc(context.firestore(), "users", "disabled-legacy-client"), {
      name: "Disabled legacy client",
      active: false
    });
    await setDoc(doc(context.firestore(), "users", "legacy-member"), {
      name: "Legacy member",
      role: "member"
    });
  });

  const legacyClientDb = testEnv.authenticatedContext("legacy-client").firestore();
  const disabledLegacyClientDb = testEnv.authenticatedContext("disabled-legacy-client").firestore();

  await assertFails(getDoc(doc(legacyClientDb, "users", "legacy-client")));
  await assertSucceeds(updateDoc(doc(legacyClientDb, "users", "legacy-client"), {
    role: "client",
    updatedAt: "2026-08-10T12:00:00.000Z"
  }));
  await assertSucceeds(getDoc(doc(legacyClientDb, "users", "legacy-client")));
  await assertFails(updateDoc(doc(legacyClientDb, "users", "legacy-client"), {
    role: "trainer"
  }));
  await assertFails(updateDoc(doc(disabledLegacyClientDb, "users", "disabled-legacy-client"), {
    role: "client",
    updatedAt: "2026-08-10T12:00:00.000Z"
  }));

  const legacyMemberDb = testEnv.authenticatedContext("legacy-member").firestore();
  await assertSucceeds(updateDoc(doc(legacyMemberDb, "users", "legacy-member"), {
    role: "client",
    updatedAt: "2026-08-10T12:00:00.000Z"
  }));
  await assertFails(updateDoc(doc(legacyMemberDb, "users", "legacy-member"), {
    role: "admin"
  }));
});

test("client can save their own basic plan without changing trainer assignment fields", async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "users", "client-1"), {
      role: "client",
      assignedProgramId: "trainer-program",
      assignedWorkoutCount: 8
    });
  });

  const clientDb = testEnv.authenticatedContext("client-1").firestore();
  await assertSucceeds(updateDoc(doc(clientDb, "users", "client-1"), {
    workoutModePreference: { mode: "basic", remember: true },
    workoutCalendar: { assignedProgramId: "basic-plan-1", plannedWorkouts: [] },
    basicWorkoutPlan: { basicPlanId: "basic-plan-1", source: "basic", workouts: [] },
    updatedAt: "2026-08-10T10:00:00.000Z"
  }));
  await assertSucceeds(setDoc(doc(clientDb, "users", "client-1", "workouts", "basic-day-1"), {
    source: "basic",
    assignedProgramId: "basic-plan-1",
    assignedProgramUpdatedAt: "basic:basic-plan-1",
    status: "planned"
  }));
  await assertFails(updateDoc(doc(clientDb, "users", "client-1"), {
    assignedWorkoutCount: 16
  }));
});

test("admin claim can update protected role fields", async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "users", "client-1"), {
      role: "client"
    });
    await setDoc(doc(context.firestore(), "users", "admin-1"), {
      role: "admin"
    });
  });

  const adminDb = testEnv.authenticatedContext("admin-1", { admin: true }).firestore();
  await assertSucceeds(updateDoc(doc(adminDb, "users", "client-1"), {
    role: "trainer"
  }));
});

test("managed base program versions are append-only and private to administrators", async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, "users", "admin-1"), { role: "admin" });
    await setDoc(doc(db, "users", "client-1"), { role: "client" });
  });

  const adminDb = testEnv.authenticatedContext("admin-1", { admin: true }).firestore();
  const clientDb = testEnv.authenticatedContext("client-1").firestore();
  const programRef = doc(adminDb, "admin", "basicProgramTemplates", "items", "program-1");
  const versionRef = doc(programRef, "versions", "version-1");

  await assertSucceeds(setDoc(programRef, {
    id: "program-1",
    status: "draft",
    title: "Program 1"
  }));
  await assertSucceeds(setDoc(versionRef, {
    id: "version-1",
    status: "draft",
    title: "Program 1"
  }));
  await assertSucceeds(getDoc(programRef));
  await assertSucceeds(getDoc(versionRef));
  await assertSucceeds(updateDoc(programRef, { status: "published" }));

  const clientProgramRef = doc(clientDb, "admin", "basicProgramTemplates", "items", "program-1");
  const clientVersionRef = doc(clientProgramRef, "versions", "version-1");
  await assertFails(getDoc(clientProgramRef));
  await assertFails(getDoc(clientVersionRef));
  await assertFails(setDoc(clientProgramRef, { id: "program-1", status: "draft" }));
  await assertFails(updateDoc(versionRef, { status: "published" }));
  await assertFails(deleteDoc(versionRef));
});

test("login aliases are private and client mutations require the server", async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, "users", "client-1"), { role: "client" });
    await setDoc(doc(db, "users", "admin-1"), { role: "admin" });
  });

  const ownerDb = testEnv.authenticatedContext("client-1", { email: "client@example.com" }).firestore();
  const strangerDb = testEnv.authenticatedContext("client-2", { email: "stranger@example.com" }).firestore();
  const adminDb = testEnv.authenticatedContext("admin-1", { admin: true }).firestore();
  const publicDb = testEnv.unauthenticatedContext().firestore();

  await assertFails(setDoc(doc(ownerDb, "loginAliases", "client"), {
    email: "client@example.com",
    uid: "client-1",
    createdAt: "2026-07-09T00:00:00.000Z",
    updatedAt: "2026-07-09T00:00:00.000Z"
  }));

  await assertSucceeds(setDoc(doc(adminDb, "loginAliases", "client"), { uid: "client-1", email: "client@example.com" }));
  await assertFails(getDoc(doc(publicDb, "loginAliases", "client")));
  await assertFails(getDoc(doc(strangerDb, "loginAliases", "client")));
  await assertSucceeds(getDoc(doc(ownerDb, "loginAliases", "client")));
  await assertSucceeds(getDoc(doc(adminDb, "loginAliases", "client")));
  await assertFails(setDoc(doc(strangerDb, "loginAliases", "client"), {
    email: "stranger@example.com",
    uid: "client-2",
    updatedAt: "2026-07-09T00:00:00.000Z"
  }, { merge: true }));
});

test("trainer invite lets the matching client activate a protected profile", async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "users", "trainer-1"), {
      role: "trainer",
      email: "trainer@example.com"
    });
  });

  const trainerDb = testEnv.authenticatedContext("trainer-1").firestore();
  await assertSucceeds(setDoc(doc(trainerDb, "clientInvites", "client@example.com"), {
    email: "client@example.com",
    name: "Client",
    status: "active",
    authUid: "",
    trainerId: "trainer-1",
    trainerEmail: "trainer@example.com",
    createdByUid: "trainer-1",
    createdByEmail: "trainer@example.com",
    createdAt: "2026-07-09T00:00:00.000Z",
    updatedAt: "2026-07-09T00:00:00.000Z",
    inviteUrl: "http://localhost/?invite=client%40example.com"
  }));

  const clientDb = testEnv.authenticatedContext("client-1", { email: "client@example.com" }).firestore();
  await assertSucceeds(setDoc(doc(clientDb, "users", "client-1"), {
    email: "client@example.com",
    name: "Client",
    role: "client",
    createdAt: "2026-07-09T00:00:00.000Z",
    updatedAt: "2026-07-09T00:00:00.000Z",
    authProvider: "invite",
    inviteActivatedAt: "2026-07-09T00:00:00.000Z",
    createdBy: "trainer@example.com",
    createdByEmail: "trainer@example.com",
    createdByUid: "trainer-1",
    trainerId: "trainer-1",
    assignedTrainerId: "trainer-1",
    coachId: "trainer-1",
    trainerEmail: "trainer@example.com",
    assignedTrainerEmail: "trainer@example.com",
    coachEmail: "trainer@example.com"
  }));

  await assertSucceeds(setDoc(doc(clientDb, "clientInvites", "client@example.com"), {
    email: "client@example.com",
    name: "Client",
    status: "accepted",
    authUid: "",
    trainerId: "trainer-1",
    trainerEmail: "trainer@example.com",
    createdByUid: "trainer-1",
    createdByEmail: "trainer@example.com",
    createdAt: "2026-07-09T00:00:00.000Z",
    updatedAt: "2026-07-09T00:01:00.000Z",
    inviteUrl: "http://localhost/?invite=client%40example.com",
    acceptedAt: "2026-07-09T00:01:00.000Z",
    acceptedUid: "client-1"
  }));
});

test("invited profile creation rejects injected service fields and forged assignment", async () => {
  const email = "invited@example.com";
  const uid = "invited-client";
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "clientInvites", email), {
      email, status: "active", authUid: uid,
      trainerId: "trainer-1", trainerEmail: "trainer@example.com", createdByUid: "trainer-1"
    });
  });
  const profile = {
    email, role: "client", name: "Invited client", active: true,
    createdAt: "2026-09-18T00:00:00Z", updatedAt: "2026-09-18T00:00:00Z",
    authProvider: "invite", inviteActivatedAt: "2026-09-18T00:00:00Z",
    createdBy: "trainer@example.com", createdByEmail: "trainer@example.com",
    createdByUid: "trainer-1", trainerId: "trainer-1", assignedTrainerId: "trainer-1", coachId: "trainer-1",
    trainerEmail: "trainer@example.com", assignedTrainerEmail: "trainer@example.com", coachEmail: "trainer@example.com"
  };
  const db = testEnv.authenticatedContext(uid, { email }).firestore();
  const ref = doc(db, "users", uid);
  for (const extra of [
    { telegramChatId: "forged" }, { telegramConnected: true }, { telegram: { connected: true } },
    { subscription: { paid: true } }, { loginLower: "another-login" },
    { accountProfile: { login: "another-login", email: "other@example.com" } },
    { profileIdentityOperation: { status: "pending" } }, { isTest: true },
    { assignedProgramId: "forged" }, { adminClaimUpdatedAt: "now" },
    { membershipStatus: "active" }, { unknownFutureServiceField: true },
    { role: "admin" }, { trainerId: "trainer-2" }, { assignedTrainerId: "trainer-2" },
    { createdByUid: "trainer-2" }, { trainerEmail: "other@example.com" }, { active: false }
  ]) await assertFails(setDoc(ref, { ...profile, ...extra }));
  await assertFails(setDoc(doc(testEnv.authenticatedContext("other", { email }).firestore(), "users/other"), profile));
  await assertFails(setDoc(doc(testEnv.authenticatedContext("uninvited", { email: "none@example.com" }).firestore(), "users/uninvited"), { ...profile, email: "none@example.com" }));
  await assertSucceeds(setDoc(ref, profile));
  assert.deepEqual((await getDoc(ref)).data(), profile);
});

test("trainer cannot take over another trainer's pending invite", async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, "users", "trainer-1"), { role: "trainer" });
    await setDoc(doc(db, "users", "trainer-2"), { role: "trainer" });
  });

  const ownerDb = testEnv.authenticatedContext("trainer-1").firestore();
  const otherTrainerDb = testEnv.authenticatedContext("trainer-2").firestore();
  const ownerInviteRef = doc(ownerDb, "clientInvites", "client@example.com");
  const otherInviteRef = doc(otherTrainerDb, "clientInvites", "client@example.com");

  await assertSucceeds(setDoc(ownerInviteRef, {
    email: "client@example.com",
    name: "Client",
    status: "active",
    authUid: "",
    trainerId: "trainer-1",
    trainerEmail: "trainer-1@example.com",
    createdByUid: "trainer-1",
    createdByEmail: "trainer-1@example.com",
    createdAt: "2026-08-20T09:00:00.000Z",
    updatedAt: "2026-08-20T09:00:00.000Z",
    inviteUrl: "http://localhost/?invite=client%40example.com"
  }));

  await assertSucceeds(updateDoc(ownerInviteRef, {
    name: "Client updated by owner",
    updatedAt: "2026-08-20T09:01:00.000Z"
  }));

  await assertFails(updateDoc(otherInviteRef, {
    trainerId: "trainer-2",
    trainerEmail: "trainer-2@example.com",
    createdByUid: "trainer-2",
    createdByEmail: "trainer-2@example.com",
    updatedAt: "2026-08-20T09:02:00.000Z"
  }));
});

test("trainer can read only assigned clients", async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, "users", "trainer-1"), { role: "trainer" });
    await setDoc(doc(db, "users", "assigned-client"), {
      role: "client",
      trainerId: "trainer-1"
    });
    await setDoc(doc(db, "users", "other-client"), {
      role: "client",
      trainerId: "trainer-2"
    });
  });

  const trainerDb = testEnv.authenticatedContext("trainer-1").firestore();
  await assertSucceeds(getDoc(doc(trainerDb, "users", "assigned-client")));
  await assertFails(getDoc(doc(trainerDb, "users", "other-client")));
});

test("trainer archives clients instead of deleting their account data", async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, "users", "trainer-1"), { role: "trainer" });
    await setDoc(doc(db, "users", "assigned-client"), {
      role: "client",
      trainerId: "trainer-1",
      archived: false
    });
    await setDoc(doc(db, "users", "admin-1"), { role: "admin" });
  });

  const trainerDb = testEnv.authenticatedContext("trainer-1").firestore();
  const adminDb = testEnv.authenticatedContext("admin-1", { admin: true }).firestore();

  await assertSucceeds(updateDoc(doc(trainerDb, "users", "assigned-client"), {
    archived: true,
    active: false
  }));
  await assertFails(deleteDoc(doc(trainerDb, "users", "assigned-client")));
  await assertSucceeds(deleteDoc(doc(adminDb, "users", "assigned-client")));
});

test("client cannot gain trainer access by being stored in trainerId", async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, "users", "client-acting-as-trainer"), {
      role: "client"
    });
    await setDoc(doc(db, "users", "victim-client"), {
      role: "client",
      trainerId: "client-acting-as-trainer"
    });
    await setDoc(doc(db, "users", "victim-client", "measurements", "latest"), {
      weight: 89
    });
  });

  const clientDb = testEnv.authenticatedContext("client-acting-as-trainer").firestore();
  await assertFails(getDoc(doc(clientDb, "users", "victim-client")));
  await assertFails(getDoc(doc(clientDb, "users", "victim-client", "measurements", "latest")));
});

test("client cannot read trainer invite only because their uid is trainerId", async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "clientInvites", "victim@example.com"), {
      email: "victim@example.com",
      name: "Victim",
      status: "active",
      trainerId: "client-acting-as-trainer",
      createdByUid: "client-acting-as-trainer",
      trainerEmail: "trainer@example.com",
      createdByEmail: "trainer@example.com",
      createdAt: "2026-07-11T00:00:00.000Z",
      updatedAt: "2026-07-11T00:00:00.000Z",
      inviteUrl: "http://localhost/?invite=victim%40example.com"
    });
  });

  const fakeTrainerDb = testEnv.authenticatedContext("client-acting-as-trainer", {
    email: "other@example.com"
  }).firestore();
  const invitedClientDb = testEnv.authenticatedContext("invited-client", {
    email: "victim@example.com"
  }).firestore();

  await assertFails(getDoc(doc(fakeTrainerDb, "clientInvites", "victim@example.com")));
  await assertSucceeds(getDoc(doc(invitedClientDb, "clientInvites", "victim@example.com")));
});

test("nutrition data stays writable only by its owner", async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, "users", "client-1"), { role: "client" });
  });

  const ownerDb = testEnv.authenticatedContext("client-1").firestore();
  const strangerDb = testEnv.authenticatedContext("client-2").firestore();
  const nutritionRef = doc(ownerDb, "users", "client-1", "nutrition", "current");

  await assertSucceeds(setDoc(nutritionRef, { days: {} }));
  await assertFails(setDoc(
    doc(strangerDb, "users", "client-1", "nutrition", "current"),
    { days: {} }
  ));
});

test("uninvited Firebase accounts cannot access member data", async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, "users", "client-1"), { role: "client" });
  });

  const orphanDb = testEnv.authenticatedContext("orphan-1", {
    email: "orphan@example.com"
  }).firestore();

  await assertFails(setDoc(doc(orphanDb, "users", "orphan-1", "nutrition", "current"), {
    days: {}
  }));
  await assertFails(setDoc(doc(orphanDb, "loginAliases", "orphan"), {
    email: "orphan@example.com",
    uid: "orphan-1",
    createdAt: "2026-08-02T00:00:00.000Z",
    updatedAt: "2026-08-02T00:00:00.000Z"
  }));
  await assertFails(getDoc(doc(orphanDb, "users", "client-1")));
});

test("stale legacy trainer fields do not override an assigned trainer", async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, "users", "trainer-1"), { role: "trainer" });
    await setDoc(doc(db, "users", "trainer-2"), { role: "trainer" });
    await setDoc(doc(db, "users", "client-1"), {
      role: "client",
      assignedTrainerId: "trainer-2",
      trainerId: "trainer-2",
      coachId: "trainer-1",
      createdByUid: "trainer-1"
    });
  });

  const staleTrainerDb = testEnv.authenticatedContext("trainer-1").firestore();
  const assignedTrainerDb = testEnv.authenticatedContext("trainer-2").firestore();

  await assertFails(getDoc(doc(staleTrainerDb, "users", "client-1")));
  await assertSucceeds(getDoc(doc(assignedTrainerDb, "users", "client-1")));
});

test("explicit unassignment or revocation prevents historical trainer fields from restoring access", async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, "users", "trainer-1"), { role: "trainer" });
    const historicalAssignment = {
      role: "client",
      assignedTrainerId: "",
      trainerId: "",
      coachId: "",
      createdByUid: "trainer-1"
    };
    await setDoc(doc(db, "users", "unassigned-client"), {
      ...historicalAssignment,
      trainerAssignmentState: "unassigned"
    });
    await setDoc(doc(db, "users", "revoked-client"), {
      ...historicalAssignment,
      trainerAssignmentState: "revoked"
    });
  });

  const historicalTrainerDb = testEnv.authenticatedContext("trainer-1").firestore();
  await assertFails(getDoc(doc(historicalTrainerDb, "users", "unassigned-client")));
  await assertFails(getDoc(doc(historicalTrainerDb, "users", "revoked-client")));
});

test("assigned trainer can update nutrition plan but not food diary", async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, "users", "trainer-1"), { role: "trainer" });
    await setDoc(doc(db, "users", "client-1"), {
      role: "client",
      trainerId: "trainer-1",
      nutritionGoals: { calories: 2400, protein: 160, fat: 75, carbs: 260 }
    });
    await setDoc(doc(db, "users", "client-1", "nutrition", "state"), {
      goals: { calories: 2400, protein: 160, fat: 75, carbs: 260 },
      days: {
        "2026-06-17": { foods: [{ name: "Овсянка", calories: 300 }] }
      },
      updatedAt: "2026-06-17T08:00:00.000Z"
    });
  });

  const trainerDb = testEnv.authenticatedContext("trainer-1").firestore();
  const nextPlan = {
    name: "Рекомпозиция",
    presetId: "recomposition",
    preset: "recomposition",
    goal: "Снижение жира и сохранение мышц",
    calories: 2300,
    protein: 180,
    fat: 70,
    carbs: 235,
    source: "trainer",
    updatedAt: "2026-06-17T10:00:00.000Z",
    updatedBy: "trainer-1"
  };

  await assertSucceeds(updateDoc(doc(trainerDb, "users", "client-1"), {
    nutritionGoals: { calories: 2300, protein: 180, fat: 70, carbs: 235 },
    nutritionPlan: nextPlan,
    nutritionPlanUpdatedAt: "2026-06-17T10:00:00.000Z",
    updatedAt: "2026-06-17T10:00:00.000Z"
  }));

  await assertSucceeds(setDoc(
    doc(trainerDb, "users", "client-1", "nutrition", "state"),
    {
      goals: { calories: 2300, protein: 180, fat: 70, carbs: 235 },
      nutritionPlan: nextPlan,
      updatedAt: "2026-06-17T10:00:00.000Z"
    },
    { merge: true }
  ));

  await assertFails(setDoc(
    doc(trainerDb, "users", "client-1", "nutrition", "state"),
    {
      days: {
        "2026-06-17": { foods: [] }
      }
    },
    { merge: true }
  ));
});

test("assigned trainer can update client notification settings through workout calendar", async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, "users", "trainer-1"), { role: "trainer" });
    await setDoc(doc(db, "users", "client-1"), {
      role: "client",
      trainerId: "trainer-1",
      workoutCalendar: {
        scheduledDates: ["2026-06-20"],
        reminderEnabled: true
      }
    });
  });

  const trainerDb = testEnv.authenticatedContext("trainer-1").firestore();
  await assertSucceeds(updateDoc(doc(trainerDb, "users", "client-1"), {
    workoutCalendar: {
      scheduledDates: ["2026-06-20"],
      monthlyTrainingDates: ["2026-06-20"],
      reminderEnabled: true,
      reminderOffsetsHours: [24, 3],
      progressReminderSettings: {
        photoEnabled: true,
        measurementsEnabled: true,
        intervalDays: 14,
        photoIntervalDays: 14,
        measurementsIntervalDays: 14,
        updatedAt: "2026-06-17T10:00:00.000Z"
      },
      progressPhotoReminderEnabled: true,
      measurementsReminderEnabled: true,
      progressReminderIntervalDays: 14,
      progressPhotoReminderIntervalDays: 14,
      measurementsReminderIntervalDays: 14,
      updatedAt: "2026-06-17T10:00:00.000Z"
    },
    telegram: { notificationsEnabled: true },
    telegramNotificationsEnabled: true,
    updatedAt: "2026-06-17T10:00:00.000Z"
  }));

  await assertFails(updateDoc(doc(trainerDb, "users", "client-1"), {
    progressReminderSettings: { photoEnabled: true }
  }));
});

test("assigned trainer can update only the subscription of their client", async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, "users", "trainer-1"), { role: "trainer" });
    await setDoc(doc(db, "users", "trainer-2"), { role: "trainer" });
    await setDoc(doc(db, "users", "client-1"), {
      role: "client",
      trainerId: "trainer-1",
      subscription: {
        cycleId: "july",
        startDate: "2026-07-01",
        endDate: "2026-07-31",
        purchasedSessions: 12,
        usedSessions: 9,
        remainingSessions: 3
      }
    });
  });

  const assignedTrainerDb = testEnv.authenticatedContext("trainer-1").firestore();
  const otherTrainerDb = testEnv.authenticatedContext("trainer-2").firestore();
  const update = {
    subscription: {
      cycleId: "august",
      startDate: "2026-08-01",
      endDate: "2026-08-31",
      purchasedSessions: 12,
      usedSessions: 0,
      remainingSessions: 12
    },
    updatedAt: "2026-07-16T10:00:00.000Z"
  };

  await assertSucceeds(updateDoc(doc(assignedTrainerDb, "users", "client-1"), update));
  await assertFails(updateDoc(doc(otherTrainerDb, "users", "client-1"), update));
});

test("assigned trainer can advance only the client setup checklist", async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, "users", "trainer-1"), { role: "trainer" });
    await setDoc(doc(db, "users", "trainer-2"), { role: "trainer" });
    await setDoc(doc(db, "users", "client-1"), {
      role: "client",
      trainerId: "trainer-1"
    });
  });

  const checklist = {
    version: 2,
    status: "in_progress",
    currentStep: "schedule",
    startedAt: "2026-08-13T09:00:00.000Z",
    updatedAt: "2026-08-13T09:01:00.000Z",
    completedSteps: {
      program: true,
      schedule: false,
      nutrition: false,
      notifications: false
    }
  };
  const assignedTrainerDb = testEnv.authenticatedContext("trainer-1").firestore();
  const otherTrainerDb = testEnv.authenticatedContext("trainer-2").firestore();

  await assertSucceeds(updateDoc(doc(assignedTrainerDb, "users", "client-1"), {
    trainerSetupChecklist: checklist,
    updatedAt: "2026-08-13T09:01:00.000Z"
  }));
  await assertFails(updateDoc(doc(otherTrainerDb, "users", "client-1"), {
    trainerSetupChecklist: checklist,
    updatedAt: "2026-08-13T09:01:00.000Z"
  }));
  await assertFails(updateDoc(doc(assignedTrainerDb, "users", "client-1"), {
    trainerSetupChecklist: checklist,
    name: "Not allowed"
  }));
});

test("assigned trainer can publish active program lifecycle fields", async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, "users", "trainer-1"), { role: "trainer" });
    await setDoc(doc(db, "users", "client-1"), {
      role: "client",
      trainerId: "trainer-1"
    });
    await setDoc(doc(db, "trainingTemplates", "template-1"), {
      name: "Plan",
      ownerUid: "trainer-1",
      ownerRole: "trainer",
      createdByUid: "trainer-1",
      updatedByUid: "trainer-1",
      lifecycleStatus: "draft",
      programStatus: "draft",
      visibility: "trainer_draft"
    });
  });

  const trainerDb = testEnv.authenticatedContext("trainer-1").firestore();
  const otherTrainerDb = testEnv.authenticatedContext("trainer-2").firestore();

  await assertSucceeds(updateDoc(doc(trainerDb, "trainingTemplates", "template-1"), {
    lifecycleStatus: "assigned",
    programStatus: "assigned",
    visibility: "trainer_published",
    publishedAt: "2026-07-11T10:00:00.000Z",
    lastAssignedAt: "2026-07-11T10:00:00.000Z",
    lastAssignedByUid: "trainer-1",
    updatedByUid: "trainer-1",
    assignedClientIds: ["client-1"]
  }));
  await assertSucceeds(updateDoc(doc(trainerDb, "users", "client-1"), {
    assignedProgramId: "template-1",
    assignedProgramName: "Plan",
    assignedProgramAt: "2026-07-11T10:00:00.000Z",
    assignedProgramAddedAt: "2026-07-11T10:00:00.000Z",
    assignedProgramUpdatedAt: "2026-07-11T10:00:00.000Z",
    assignedProgramLifecycleStatus: "active",
    assignedProgramVisibility: "client_active",
    assignedProgramPublishedAt: "2026-07-11T10:00:00.000Z",
    assignedProgramAssignedByUid: "trainer-1",
    assignedWorkoutCount: 4,
    workoutCalendar: {
      assignedProgramId: "template-1",
      assignedProgramName: "Plan",
      assignedProgramUpdatedAt: "2026-07-11T10:00:00.000Z",
      plannedWorkouts: []
    }
  }));
  await assertFails(updateDoc(doc(otherTrainerDb, "users", "client-1"), {
    assignedProgramLifecycleStatus: "active"
  }));
});

test("assigned trainer can atomically create an individual program copy", async () => {
  const assignedAt = "2026-08-20T10:00:00.000Z";

  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, "users", "trainer-1"), { role: "trainer" });
    await setDoc(doc(db, "users", "client-1"), {
      role: "client",
      trainerId: "trainer-1"
    });
    await setDoc(doc(db, "trainingTemplates", "template-1"), {
      name: "Plan",
      ownerUid: "trainer-1",
      ownerRole: "trainer",
      createdByUid: "trainer-1",
      updatedByUid: "trainer-1",
      lifecycleStatus: "draft",
      programStatus: "draft",
      visibility: "trainer_draft"
    });
  });

  const trainerDb = testEnv.authenticatedContext("trainer-1").firestore();
  const batch = writeBatch(trainerDb);

  batch.set(doc(trainerDb, "users", "client-1", "workouts", "assigned-day-1"), {
    name: "Workout 1",
    exercises: [],
    status: "planned",
    completed: false,
    assignedBy: "trainer-1",
    assignedProgramId: "template-1",
    assignedProgramName: "Plan",
    assignedAt,
    assignedProgramAddedAt: assignedAt,
    assignedProgramUpdatedAt: assignedAt,
    assignedProgramLifecycleStatus: "active",
    assignedProgramVisibility: "client_active",
    assignedProgramPublishedAt: assignedAt,
    assignedProgramAssignedByUid: "trainer-1"
  });
  batch.set(doc(trainerDb, "users", "client-1"), {
    assignedProgramId: "template-1",
    assignedProgramName: "Plan",
    assignedProgramAt: assignedAt,
    assignedProgramAddedAt: assignedAt,
    assignedProgramUpdatedAt: assignedAt,
    assignedProgramLifecycleStatus: "active",
    assignedProgramVisibility: "client_active",
    assignedProgramPublishedAt: assignedAt,
    assignedProgramAssignedByUid: "trainer-1",
    assignedWorkoutCount: 1,
    workoutCalendar: {
      assignedProgramId: "template-1",
      assignedProgramName: "Plan",
      assignedProgramUpdatedAt: assignedAt,
      plannedWorkouts: []
    }
  }, { merge: true });
  batch.set(doc(trainerDb, "trainingTemplates", "template-1"), {
    lifecycleStatus: "assigned",
    programStatus: "assigned",
    visibility: "trainer_published",
    publishedAt: assignedAt,
    lastAssignedAt: assignedAt,
    lastAssignedByUid: "trainer-1",
    updatedByUid: "trainer-1",
    assignedClientIds: ["client-1"]
  }, { merge: true });

  await assertSucceeds(batch.commit());
});

async function personalizedAssignmentFixture({ name, actor = "trainer-1", templateId = "template-1", assignmentState = "assigned", profileExtra = {}, dayCount = 12 } = {}) {
  const assignedAt = "2026-09-10T12:00:00.000Z";
  const template = { id: "template-1", name: "Фулл бади", ownerUid: "trainer-1", ownerRole: "trainer", createdByUid: "trainer-1", updatedByUid: "trainer-1", lifecycleStatus: "ready", programStatus: "ready", visibility: "trainer_ready" };
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, "users/trainer-1"), { role: "trainer" });
    await setDoc(doc(db, "users/trainer-2"), { role: "trainer" });
    await setDoc(doc(db, "users/client-1"), { role: "client", name: "Илья Михайлов", assignedTrainerId: "trainer-1", trainerAssignmentState: assignmentState });
    await setDoc(doc(db, "trainingTemplates/template-1"), template);
    await setDoc(doc(db, "trainingTemplates/template-2"), { ...template, id: "template-2", ownerUid: "trainer-2", createdByUid: "trainer-2", updatedByUid: "trainer-2" });
    await setDoc(doc(db, "users/client-1/workouts/old"), { name: "Past workout", completed: true });
    await setDoc(doc(db, "users/client-1/history/past"), { workoutId: "old", completed: true });
  });
  const db = testEnv.authenticatedContext(actor).firestore();
  const batch = writeBatch(db);
  const metadata = buildClientProgramLifecycleMetadata({ assignedAt, assignedByUid: actor });
  const assignment = { assignedProgramId: templateId, assignedProgramName: name, assignedProgramUpdatedAt: assignedAt, assignedProgramAddedAt: assignedAt, ...metadata };
  for (let i = 0; i < dayCount; i++) {
    batch.set(doc(db, "users", "client-1", "workouts", `new-${i}`), { ...assignment, assignedBy: actor, assignedAt, name: `Day ${i + 1}`, exercises: [], completed: false, status: "planned" });
  }
  batch.set(doc(db, "users/client-1"), { ...assignment, assignedProgramAt: assignedAt, assignedWorkoutCount: dayCount, workoutCalendar: { plannedWorkouts: [] }, ...profileExtra }, { merge: true });
  batch.set(doc(db, "trainingTemplates", templateId), buildProgramAssignmentMetadata(template, { clientId: "client-1", assignedAt, assignedByUid: actor }), { merge: true });
  return { batch, db };
}

for (const name of [buildTrainerClientProgramName("Фулл бади", { name: "Илья Михайлов" }), "Мой индивидуальный план"]) {
  test(`trainer assigns personalized name atomically: ${name}`, async () => {
    const { batch, db } = await personalizedAssignmentFixture({ name });
    await assertSucceeds(batch.commit());
    assert.equal((await getDoc(doc(db, "users/client-1"))).data().assignedProgramName, name);
    assert.equal((await getDoc(doc(db, "users/client-1/workouts/new-11"))).data().assignedProgramName, name);
    assert.equal((await getDoc(doc(db, "trainingTemplates/template-1"))).data().name, "Фулл бади");
    assert.equal((await getDoc(doc(db, "users/client-1/workouts/old"))).data().completed, true);
    assert.equal((await getDoc(doc(db, "users/client-1/history/past"))).data().completed, true);
  });
}

for (const [label, overrides] of [
  ["another trainer", { actor: "trainer-2" }],
  ["foreign template", { templateId: "template-2" }],
  ["revoked assignment", { assignmentState: "revoked" }],
  ["empty name", { name: "" }],
  ["oversized name", { name: "x".repeat(81) }],
  ["non-text name", { name: 123 }],
  ["role escalation", { profileExtra: { role: "admin" } }]
]) {
  test(`personalized assignment still rejects ${label}`, async () => {
    const { batch } = await personalizedAssignmentFixture({ name: "Индивидуальный план", dayCount: 1, ...overrides });
    await assertFails(batch.commit());
    await testEnv.withSecurityRulesDisabled(async (context) => {
      assert.equal((await getDoc(doc(context.firestore(), "users/client-1/workouts/new-0"))).exists(), false);
      assert.equal((await getDoc(doc(context.firestore(), "users/client-1"))).data().role, "client");
    });
  });
}

test("assigned trainer can archive the final active client program", async () => {
  const assignedAt = "2026-08-20T10:00:00.000Z";
  const archivedAt = "2026-08-21T10:00:00.000Z";

  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, "users", "trainer-1"), { role: "trainer" });
    await setDoc(doc(db, "users", "client-1"), {
      role: "client",
      trainerId: "trainer-1",
      assignedProgramId: "template-1",
      assignedProgramName: "Plan",
      assignedProgramAt: assignedAt,
      assignedProgramAddedAt: assignedAt,
      assignedProgramUpdatedAt: assignedAt,
      assignedProgramLifecycleStatus: "active",
      assignedProgramVisibility: "client_active",
      assignedProgramPublishedAt: assignedAt,
      assignedProgramAssignedByUid: "trainer-1",
      assignedWorkoutCount: 1,
      workoutCalendar: { plannedWorkouts: [] }
    });
    await setDoc(doc(db, "users", "client-1", "workouts", "assigned-day-1"), {
      name: "Workout 1",
      exercises: [],
      status: "planned",
      completed: false,
      assignedBy: "trainer-1",
      assignedProgramId: "template-1",
      assignedProgramName: "Plan",
      assignedProgramAddedAt: assignedAt,
      assignedProgramLifecycleStatus: "active",
      assignedProgramVisibility: "client_active"
    });
  });

  const trainerDb = testEnv.authenticatedContext("trainer-1").firestore();
  const batch = writeBatch(trainerDb);
  batch.update(doc(trainerDb, "users", "client-1", "workouts", "assigned-day-1"), {
    assignedProgramLifecycleStatus: "archived",
    assignedProgramVisibility: "trainer_archived",
    assignedProgramArchivedAt: archivedAt
  });
  batch.update(doc(trainerDb, "users", "client-1"), {
    assignedProgramId: "",
    assignedProgramName: "",
    assignedProgramAt: archivedAt,
    assignedProgramAddedAt: "",
    assignedProgramUpdatedAt: archivedAt,
    assignedProgramLifecycleStatus: "archived",
    assignedProgramVisibility: "client_archived",
    assignedWorkoutCount: 0,
    workoutCalendar: { plannedWorkouts: [] }
  });

  await assertSucceeds(batch.commit());
});

test("assigned trainer can restore and edit a client copy, but delete only an unstarted workout", async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, "users", "trainer-1"), { role: "trainer" });
    await setDoc(doc(db, "users", "client-1"), {
      role: "client",
      trainerId: "trainer-1",
      assignedProgramId: "archived-copy",
      assignedProgramName: "Archived client copy",
      assignedProgramAt: "2026-08-17T09:00:00.000Z",
      assignedProgramUpdatedAt: "2026-08-17T09:00:00.000Z",
      assignedProgramLifecycleStatus: "archived",
      assignedProgramVisibility: "client_archived",
      assignedProgramPublishedAt: "2026-08-17T09:00:00.000Z",
      assignedProgramAssignedByUid: "trainer-1",
      assignedWorkoutCount: 1,
      workoutCalendar: { plannedWorkouts: [] }
    });
    await setDoc(doc(db, "users", "client-1", "workouts", "future-day"), {
      assignedBy: "trainer-1",
      assignedProgramId: "archived-copy",
      assignedProgramName: "Archived client copy",
      assignedProgramAddedAt: "2026-08-17T09:00:00.000Z",
      assignedProgramLifecycleStatus: "active",
      assignedProgramVisibility: "client_active",
      status: "planned",
      completed: false,
      name: "Future day",
      exercises: []
    });
    await setDoc(doc(db, "users", "client-1", "workouts", "started-day"), {
      assignedBy: "trainer-1",
      assignedProgramId: "archived-copy",
      assignedProgramName: "Archived client copy",
      assignedProgramAddedAt: "2026-08-17T09:00:00.000Z",
      assignedProgramLifecycleStatus: "active",
      assignedProgramVisibility: "client_active",
      status: "completed",
      completed: true,
      completedAt: "2026-08-17T12:00:00.000Z",
      name: "Started day",
      exercises: []
    });
  });

  const trainerDb = testEnv.authenticatedContext("trainer-1").firestore();
  const clientRef = doc(trainerDb, "users", "client-1");
  const futureWorkoutRef = doc(trainerDb, "users", "client-1", "workouts", "future-day");
  const startedWorkoutRef = doc(trainerDb, "users", "client-1", "workouts", "started-day");

  // No trainingTemplates document is seeded: the trainer restores the saved
  // client copy rather than reassigning a source template.
  await assertSucceeds(updateDoc(clientRef, {
    assignedProgramLifecycleStatus: "active",
    assignedProgramVisibility: "client_active",
    assignedProgramPublishedAt: "2026-08-18T09:00:00.000Z"
  }));
  await assertSucceeds(updateDoc(clientRef, {
    workoutCalendar: { plannedWorkouts: ["future-day"] },
    assignedWorkoutCount: 2,
    updatedAt: "2026-08-18T09:01:00.000Z"
  }));
  await assertSucceeds(updateDoc(futureWorkoutRef, { name: "Edited future day" }));
  await assertFails(updateDoc(startedWorkoutRef, { name: "Edited completed day" }));
  await assertFails(deleteDoc(startedWorkoutRef));
  await assertSucceeds(deleteDoc(futureWorkoutRef));
});

test("assigned trainer can restore an archived client copy in one atomic batch", async () => {
  const assignmentTime = "2026-08-17T09:00:00.000Z";
  const archivedAt = "2026-08-18T10:00:00.000Z";

  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, "users", "trainer-1"), { role: "trainer" });
    await setDoc(doc(db, "users", "client-1"), {
      role: "client",
      trainerId: "trainer-1",
      assignedProgramId: "",
      assignedProgramName: "",
      assignedProgramAt: archivedAt,
      assignedProgramAddedAt: "",
      assignedProgramUpdatedAt: archivedAt,
      assignedProgramLifecycleStatus: "archived",
      assignedProgramVisibility: "client_archived",
      assignedProgramPublishedAt: archivedAt,
      assignedProgramAssignedByUid: "trainer-1",
      assignedWorkoutCount: 0,
      workoutCalendar: { plannedWorkouts: [] }
    });
    await setDoc(doc(db, "users", "client-1", "workouts", "archived-day"), {
      assignedBy: "trainer-1",
      assignedProgramId: "archived-copy",
      assignedProgramName: "Archived client copy",
      assignedProgramAddedAt: assignmentTime,
      assignedProgramLifecycleStatus: "archived",
      assignedProgramVisibility: "trainer_archived",
      assignedProgramPublishedAt: assignmentTime,
      assignedProgramAssignedByUid: "trainer-1",
      assignedProgramArchivedAt: archivedAt,
      status: "planned",
      completed: false,
      name: "Archived day",
      exercises: []
    });
  });

  const trainerDb = testEnv.authenticatedContext("trainer-1").firestore();
  const batch = writeBatch(trainerDb);
  batch.update(doc(trainerDb, "users", "client-1", "workouts", "archived-day"), {
    assignedProgramLifecycleStatus: "active",
    assignedProgramVisibility: "client_active",
    assignedProgramPublishedAt: assignmentTime,
    assignedProgramAssignedByUid: "trainer-1",
    assignedProgramArchivedAt: ""
  });
  batch.update(doc(trainerDb, "users", "client-1"), {
    assignedProgramId: "archived-copy",
    assignedProgramName: "Archived client copy",
    assignedProgramAt: assignmentTime,
    assignedProgramAddedAt: assignmentTime,
    assignedProgramUpdatedAt: assignmentTime,
    assignedProgramLifecycleStatus: "active",
    assignedProgramVisibility: "client_active",
    assignedProgramPublishedAt: assignmentTime,
    assignedProgramAssignedByUid: "trainer-1",
    assignedWorkoutCount: 1
  });

  await assertSucceeds(batch.commit());
});

test("only the assigned trainer can read a client's telegram messages", async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, "users", "trainer-1"), { role: "trainer" });
    await setDoc(doc(db, "users", "trainer-2"), { role: "trainer" });
    await setDoc(doc(db, "users", "client-1"), {
      role: "client",
      trainerId: "trainer-1"
    });
    await setDoc(doc(db, "users", "client-1", "telegramMessages", "msg-1"), {
      type: "incoming",
      direction: "in",
      text: "Привет, тренер!",
      status: "received"
    });
  });

  const assignedTrainerDb = testEnv.authenticatedContext("trainer-1").firestore();
  const otherTrainerDb = testEnv.authenticatedContext("trainer-2").firestore();

  await assertSucceeds(getDoc(doc(assignedTrainerDb, "users", "client-1", "telegramMessages", "msg-1")));
  await assertFails(getDoc(doc(otherTrainerDb, "users", "client-1", "telegramMessages", "msg-1")));
});

test("assigned trainer can add an outgoing manual message but cannot forge incoming client text", async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, "users", "trainer-1"), { role: "trainer" });
    await setDoc(doc(db, "users", "client-1"), {
      role: "client",
      trainerId: "trainer-1"
    });
  });

  const trainerDb = testEnv.authenticatedContext("trainer-1", { email: "trainer@example.com" }).firestore();
  const outgoingMessage = {
    type: "manual",
    direction: "out",
    text: "Проверь, пожалуйста, самочувствие после тренировки.",
    status: "saved",
    sentAt: "2026-07-12T09:00:00.000Z",
    sentByUid: "trainer-1",
    sentByEmail: "trainer@example.com"
  };

  await assertSucceeds(setDoc(doc(trainerDb, "users", "client-1", "telegramMessages", "outgoing-1"), outgoingMessage));
  await assertFails(setDoc(doc(trainerDb, "users", "client-1", "telegramMessages", "incoming-1"), {
    ...outgoingMessage,
    direction: "in"
  }));
});

test("assigned trainer can create and confirm a reply linked to a client comment", async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, "users", "trainer-1"), { role: "trainer" });
    await setDoc(doc(db, "users", "client-1"), {
      role: "client",
      trainerId: "trainer-1"
    });
  });

  const trainerDb = testEnv.authenticatedContext("trainer-1", { email: "trainer@example.com" }).firestore();
  const replyRef = doc(trainerDb, "users", "client-1", "telegramMessages", "feedback-reply-1");
  const linkedReply = {
    type: "manual",
    direction: "out",
    text: "Хорошая работа, продолжай в том же темпе.",
    status: "sending",
    sentAt: "2026-07-12T09:00:00.000Z",
    sentByUid: "trainer-1",
    sentByEmail: "trainer@example.com",
    sourceCommentId: "workout-1-comment",
    workoutId: "workout-1",
    exerciseId: "",
    replyContext: {
      sourceCommentId: "workout-1-comment",
      workoutId: "workout-1"
    }
  };

  await assertSucceeds(setDoc(replyRef, linkedReply));
  await assertSucceeds(updateDoc(replyRef, {
    status: "sent",
    channel: "internal",
    deliveredAt: "2026-07-12T09:00:01.000Z"
  }));
  await assertFails(updateDoc(replyRef, { text: "Подменённый ответ" }));
});

test("assigned trainer can mark an incoming message as read without changing its contents", async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, "users", "trainer-1"), { role: "trainer" });
    await setDoc(doc(db, "users", "client-1"), {
      role: "client",
      trainerId: "trainer-1"
    });
    await setDoc(doc(db, "users", "client-1", "telegramMessages", "incoming-1"), {
      type: "incoming",
      direction: "in",
      text: "Нужна помощь с техникой упражнения",
      sentAt: "2026-07-12T10:00:00.000Z",
      status: "received"
    });
  });

  const trainerDb = testEnv.authenticatedContext("trainer-1").firestore();
  const messageRef = doc(trainerDb, "users", "client-1", "telegramMessages", "incoming-1");

  await assertSucceeds(updateDoc(messageRef, {
    trainerReadAt: "2026-07-12T10:02:00.000Z",
    trainerReadByUid: "trainer-1"
  }));
  await assertFails(updateDoc(messageRef, { text: "Подменённый текст" }));
});

test("admin demotion takes effect for existing SDK tokens and re-grant requires the current claim version", async () => {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "users/admin-versioned"), { role: "admin" });
    await setDoc(doc(ctx.firestore(), "users/unrelated-client"), { role: "client" });
    await setDoc(doc(ctx.firestore(), "accountDeletions/unrelated-client"), { status: "pending" });
  });
  const old = testEnv.authenticatedContext("admin-versioned", { admin: true }).firestore();
  const target = (db) => doc(db, "users/unrelated-client");
  await assertSucceeds(updateDoc(target(old), { name: "Legacy admin allowed" }));
  await testEnv.withSecurityRulesDisabled((ctx) => updateDoc(doc(ctx.firestore(), "users/admin-versioned"), {
    role: "client", adminClaimVersion: "revoked"
  }));
  await assertFails(getDoc(target(old)));
  await assertFails(updateDoc(target(old), { name: "Old admin claim" }));
  await assertFails(updateDoc(doc(old, "users/admin-versioned"), { role: "admin" }));
  await assertFails(updateDoc(doc(old, "users/admin-versioned"), { adminClaimVersion: "new-grant" }));
  await assertSucceeds(updateDoc(doc(old, "users/admin-versioned"), { name: "Own client profile still allowed" }));
  await testEnv.withSecurityRulesDisabled((ctx) => updateDoc(doc(ctx.firestore(), "users/admin-versioned"), {
    role: "admin", adminClaimVersion: "new-grant"
  }));
  await assertFails(updateDoc(target(old), { name: "Legacy token cannot return" }));
  const obsolete = testEnv.authenticatedContext("admin-versioned", { admin: true, adminClaimVersion: "revoked" }).firestore();
  await assertFails(updateDoc(target(obsolete), { name: "Obsolete claim" }));
  const current = testEnv.authenticatedContext("admin-versioned", { admin: true, adminClaimVersion: "new-grant" }).firestore();
  await assertSucceeds(getDoc(target(current)));
  await assertSucceeds(updateDoc(target(current), { name: "Fresh admin allowed" }));
  await assertFails(getDoc(target(testEnv.authenticatedContext("admin-versioned").firestore())));
  // Cleanup jobs are deliberately server-only even for administrators.
  await assertFails(getDoc(doc(current, "accountDeletions/unrelated-client")));
  await assertFails(setDoc(doc(current, "accountDeletions/forged"), { status: "completed" }));
});
