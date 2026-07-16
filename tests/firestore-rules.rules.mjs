import fs from "node:fs/promises";
import { after, before, beforeEach, test } from "node:test";

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment
} from "@firebase/rules-unit-testing";
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from "firebase/firestore";

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
});

test("admin claim can update protected role fields", async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "users", "client-1"), {
      role: "client"
    });
  });

  const adminDb = testEnv.authenticatedContext("admin-1", { admin: true }).firestore();
  await assertSucceeds(updateDoc(doc(adminDb, "users", "client-1"), {
    role: "trainer"
  }));
});

test("login aliases are readable before auth but writable only by the owner", async () => {
  const ownerDb = testEnv.authenticatedContext("client-1", { email: "client@example.com" }).firestore();
  const strangerDb = testEnv.authenticatedContext("client-2", { email: "stranger@example.com" }).firestore();
  const publicDb = testEnv.unauthenticatedContext().firestore();

  await assertSucceeds(setDoc(doc(ownerDb, "loginAliases", "client"), {
    email: "client@example.com",
    uid: "client-1",
    createdAt: "2026-07-09T00:00:00.000Z",
    updatedAt: "2026-07-09T00:00:00.000Z"
  }));

  await assertSucceeds(getDoc(doc(publicDb, "loginAliases", "client")));
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
    loginLower: "client",
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
  const ownerDb = testEnv.authenticatedContext("client-1").firestore();
  const strangerDb = testEnv.authenticatedContext("client-2").firestore();
  const nutritionRef = doc(ownerDb, "users", "client-1", "nutrition", "current");

  await assertSucceeds(setDoc(nutritionRef, { days: {} }));
  await assertFails(setDoc(
    doc(strangerDb, "users", "client-1", "nutrition", "current"),
    { days: {} }
  ));
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
