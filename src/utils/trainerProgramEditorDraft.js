const TRAINER_PROGRAM_EDITOR_DRAFT_PREFIX = "trainer_program_editor_draft_v1";
const TRAINER_PROGRAM_EDITOR_DRAFT_VERSION = 1;

function getSessionStorage() {
  try {
    return typeof sessionStorage === "undefined" ? null : sessionStorage;
  } catch {
    return null;
  }
}

function normalizeScopeValue(value, fallback) {
  const normalized = String(value || "").trim();
  return normalized || fallback;
}

export function getTrainerProgramEditorDraftOwner(program = {}) {
  return normalizeScopeValue(program?.ownerUid || program?.createdByUid, "unknown");
}

export function getTrainerProgramEditorDraftKey({ ownerUid, programId } = {}) {
  const owner = encodeURIComponent(normalizeScopeValue(ownerUid, "unknown"));
  const program = encodeURIComponent(normalizeScopeValue(programId, "unknown"));
  return `${TRAINER_PROGRAM_EDITOR_DRAFT_PREFIX}:${owner}:${program}`;
}

export function saveTrainerProgramEditorDraft({
  program,
  ownerUid,
  editorMode = "create",
  savedAt = new Date().toISOString()
} = {}) {
  const programId = normalizeScopeValue(program?.id, "");
  if (!programId || !program || typeof program !== "object") return false;

  const storage = getSessionStorage();
  if (!storage) return false;

  const normalizedOwnerUid = normalizeScopeValue(ownerUid || getTrainerProgramEditorDraftOwner(program), "unknown");
  const record = {
    version: TRAINER_PROGRAM_EDITOR_DRAFT_VERSION,
    ownerUid: normalizedOwnerUid,
    programId,
    editorMode: editorMode === "edit" ? "edit" : "create",
    savedAt,
    program
  };

  try {
    storage.setItem(
      getTrainerProgramEditorDraftKey({ ownerUid: normalizedOwnerUid, programId }),
      JSON.stringify(record)
    );
    return true;
  } catch {
    // Draft recovery must never block the trainer from using the editor.
    return false;
  }
}

export function readTrainerProgramEditorDraft({ ownerUid, programId } = {}) {
  const normalizedProgramId = normalizeScopeValue(programId, "");
  if (!normalizedProgramId) return null;

  const storage = getSessionStorage();
  if (!storage) return null;

  const normalizedOwnerUid = normalizeScopeValue(ownerUid, "unknown");
  const key = getTrainerProgramEditorDraftKey({
    ownerUid: normalizedOwnerUid,
    programId: normalizedProgramId
  });

  try {
    const raw = storage.getItem(key);
    if (!raw) return null;

    const record = JSON.parse(raw);
    const isValid = record
      && typeof record === "object"
      && record.version === TRAINER_PROGRAM_EDITOR_DRAFT_VERSION
      && record.ownerUid === normalizedOwnerUid
      && record.programId === normalizedProgramId
      && record.program
      && typeof record.program === "object"
      && String(record.program.id || "") === normalizedProgramId;

    if (!isValid) {
      storage.removeItem(key);
      return null;
    }

    return {
      ...record,
      editorMode: record.editorMode === "edit" ? "edit" : "create"
    };
  } catch {
    try {
      storage.removeItem(key);
    } catch {
      // Session storage may be unavailable or full; draft recovery remains optional.
    }
    return null;
  }
}

export function clearTrainerProgramEditorDraft({ ownerUid, programId } = {}) {
  const normalizedProgramId = normalizeScopeValue(programId, "");
  if (!normalizedProgramId) return;

  const storage = getSessionStorage();
  if (!storage) return;

  try {
    storage.removeItem(getTrainerProgramEditorDraftKey({ ownerUid, programId: normalizedProgramId }));
  } catch {
    // Storage can be disabled by the browser. There is nothing else to clean up.
  }
}
