import test from "node:test";
import assert from "node:assert/strict";

import {
  clearTrainerProgramEditorDraft,
  getTrainerProgramEditorDraftKey,
  readTrainerProgramEditorDraft,
  saveTrainerProgramEditorDraft
} from "../src/utils/trainerProgramEditorDraft.js";

function createSessionStorage() {
  const values = new Map();
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    }
  };
}

function withSessionStorage(callback) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "sessionStorage");
  const storage = createSessionStorage();
  Object.defineProperty(globalThis, "sessionStorage", {
    configurable: true,
    value: storage
  });

  try {
    return callback(storage);
  } finally {
    if (descriptor) Object.defineProperty(globalThis, "sessionStorage", descriptor);
    else delete globalThis.sessionStorage;
  }
}

test("trainer program editor draft is scoped to both trainer and program", () => {
  withSessionStorage(() => {
    const program = {
      id: "month_1",
      name: "Программа Илья",
      ownerUid: "trainer_a",
      blocks: [{ id: "block_1" }]
    };

    assert.equal(saveTrainerProgramEditorDraft({ program, ownerUid: "trainer_a", editorMode: "edit" }), true);
    const draft = readTrainerProgramEditorDraft({ ownerUid: "trainer_a", programId: "month_1" });
    assert.equal(draft.version, 1);
    assert.equal(draft.ownerUid, "trainer_a");
    assert.equal(draft.programId, "month_1");
    assert.equal(draft.editorMode, "edit");
    assert.match(draft.savedAt, /T/);
    assert.deepEqual(draft.program, program);
    assert.equal(readTrainerProgramEditorDraft({ ownerUid: "trainer_b", programId: "month_1" }), null);
    assert.equal(readTrainerProgramEditorDraft({ ownerUid: "trainer_a", programId: "month_2" }), null);
  });
});

test("invalid or intentionally discarded trainer program drafts are not restored", () => {
  withSessionStorage((storage) => {
    const key = getTrainerProgramEditorDraftKey({ ownerUid: "trainer_a", programId: "month_1" });
    storage.setItem(key, "not-json");
    assert.equal(readTrainerProgramEditorDraft({ ownerUid: "trainer_a", programId: "month_1" }), null);
    assert.equal(storage.getItem(key), null);

    const program = { id: "month_1", ownerUid: "trainer_a", blocks: [] };
    assert.equal(saveTrainerProgramEditorDraft({ program, ownerUid: "trainer_a" }), true);
    clearTrainerProgramEditorDraft({ ownerUid: "trainer_a", programId: "month_1" });
    assert.equal(readTrainerProgramEditorDraft({ ownerUid: "trainer_a", programId: "month_1" }), null);
  });
});

test("trainer program editor never writes a recovery draft without a program identity", () => {
  withSessionStorage(() => {
    assert.equal(saveTrainerProgramEditorDraft({ program: { name: "Без id" }, ownerUid: "trainer_a" }), false);
  });
});
