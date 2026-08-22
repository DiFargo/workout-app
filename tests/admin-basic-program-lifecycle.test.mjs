import assert from "node:assert/strict";
import test from "node:test";
import {
  ADMIN_BASIC_PROGRAM_STATUSES,
  createBasicProgramMutation,
  getBasicProgramTransition,
  parseBasicProgramWorkouts
} from "../src/utils/adminBasicProgramLifecycle.js";

test("parses a compact program draft into ordered immutable plan data", () => {
  const workouts = parseBasicProgramWorkouts(
    "День A: Жим ногами; Тяга верхнего блока\nДень B: Жим гантелей; Планка"
  );

  assert.equal(workouts.length, 2);
  assert.equal(workouts[0].name, "День A");
  assert.deepEqual(workouts[0].exercises.map((exercise) => exercise.name), ["Жим ногами", "Тяга верхнего блока"]);
  assert.equal(workouts[1].order, 2);
});

test("publishing creates a new version and retains a later draft's published snapshot", () => {
  const initial = createBasicProgramMutation({
    draft: {
      title: "Стартовый план",
      workouts: parseBasicProgramWorkouts("День 1: Приседания")
    },
    action: "created",
    status: ADMIN_BASIC_PROGRAM_STATUSES.DRAFT,
    actor: { uid: "admin-1", name: "Админ" },
    reason: "Первый вариант"
  });
  const published = createBasicProgramMutation({
    current: initial.record,
    draft: initial.record,
    action: "published",
    status: ADMIN_BASIC_PROGRAM_STATUSES.PUBLISHED,
    actor: { uid: "admin-1", name: "Админ" },
    reason: "Проверено"
  });
  const edited = createBasicProgramMutation({
    current: published.record,
    draft: {
      ...published.record,
      title: "Стартовый план — редакция"
    },
    action: "updated",
    status: ADMIN_BASIC_PROGRAM_STATUSES.DRAFT,
    actor: { uid: "admin-1", name: "Админ" },
    reason: "Новая редакция"
  });

  assert.equal(initial.snapshot.version, 1);
  assert.equal(published.snapshot.version, 2);
  assert.equal(published.record.publishedVersion, 2);
  assert.equal(edited.snapshot.version, 3);
  assert.equal(edited.record.status, ADMIN_BASIC_PROGRAM_STATUSES.DRAFT);
  assert.equal(edited.record.publishedVersion, 2);
  assert.equal(edited.record.publishedSnapshot.title, "Стартовый план");
});

test("only valid lifecycle transitions are available", () => {
  assert.equal(
    getBasicProgramTransition(ADMIN_BASIC_PROGRAM_STATUSES.DRAFT, ADMIN_BASIC_PROGRAM_STATUSES.REVIEW).action,
    "sent_to_review"
  );
  assert.equal(
    getBasicProgramTransition(ADMIN_BASIC_PROGRAM_STATUSES.REVIEW, ADMIN_BASIC_PROGRAM_STATUSES.PUBLISHED).action,
    "published"
  );
  assert.equal(
    getBasicProgramTransition(ADMIN_BASIC_PROGRAM_STATUSES.PUBLISHED, ADMIN_BASIC_PROGRAM_STATUSES.REVIEW).allowed,
    false
  );
  assert.equal(
    getBasicProgramTransition(ADMIN_BASIC_PROGRAM_STATUSES.ARCHIVED, ADMIN_BASIC_PROGRAM_STATUSES.DRAFT).action,
    "restored_to_draft"
  );
});
