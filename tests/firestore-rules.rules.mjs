import fs from "node:fs/promises";
import { after, before, beforeEach, test } from "node:test";

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";

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

test("client can create a normal profile but cannot grant itself trainer role", async () => {
  const clientDb = testEnv.authenticatedContext("client-1").firestore();

  await assertSucceeds(setDoc(doc(clientDb, "users", "client-1"), {
    email: "client@example.com",
    role: "client",
    name: "Client"
  }));

  await assertFails(setDoc(doc(clientDb, "users", "client-2"), {
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
