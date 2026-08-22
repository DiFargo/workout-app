export const TRAINER_PROGRAM_STATUSES = Object.freeze({
  DRAFT: "draft",
  READY: "ready",
  ASSIGNED: "assigned",
  ACTIVE: "active",
  COMPLETED: "completed",
  ARCHIVED: "archived"
});

const STATUS_SET = new Set(Object.values(TRAINER_PROGRAM_STATUSES));

const TRAINER_PROGRAM_STATUS_META = Object.freeze({
  [TRAINER_PROGRAM_STATUSES.DRAFT]: Object.freeze({
    id: TRAINER_PROGRAM_STATUSES.DRAFT,
    label: "Черновик",
    tone: "draft",
    description: "Видит только тренер"
  }),
  [TRAINER_PROGRAM_STATUSES.READY]: Object.freeze({
    id: TRAINER_PROGRAM_STATUSES.READY,
    label: "Готова к назначению",
    tone: "ready",
    description: "Можно назначить клиенту"
  }),
  [TRAINER_PROGRAM_STATUSES.ASSIGNED]: Object.freeze({
    id: TRAINER_PROGRAM_STATUSES.ASSIGNED,
    label: "Назначена",
    tone: "assigned",
    description: "Можно назначать клиентам"
  }),
  [TRAINER_PROGRAM_STATUSES.ACTIVE]: Object.freeze({
    id: TRAINER_PROGRAM_STATUSES.ACTIVE,
    label: "Активна",
    tone: "active",
    description: "Активна у клиента"
  }),
  [TRAINER_PROGRAM_STATUSES.COMPLETED]: Object.freeze({
    id: TRAINER_PROGRAM_STATUSES.COMPLETED,
    label: "Завершена",
    tone: "completed",
    description: "История сохранена"
  }),
  [TRAINER_PROGRAM_STATUSES.ARCHIVED]: Object.freeze({
    id: TRAINER_PROGRAM_STATUSES.ARCHIVED,
    label: "Архив",
    tone: "archived",
    description: "Нельзя назначить"
  })
});

export function normalizeTrainerProgramStatus(value = "", fallback = TRAINER_PROGRAM_STATUSES.DRAFT) {
  const status = String(value || "").trim().toLowerCase();
  return STATUS_SET.has(status) ? status : fallback;
}

export function getTrainerProgramStatusMeta(program = {}) {
  const rawStatus = String(program.lifecycleStatus || program.programStatus || "").trim();
  const status = rawStatus
    ? normalizeTrainerProgramStatus(rawStatus, TRAINER_PROGRAM_STATUSES.DRAFT)
    : TRAINER_PROGRAM_STATUSES.READY;

  return TRAINER_PROGRAM_STATUS_META[status] || TRAINER_PROGRAM_STATUS_META[TRAINER_PROGRAM_STATUSES.READY];
}

export function isTrainerProgramArchived(program = {}) {
  return normalizeTrainerProgramStatus(program.lifecycleStatus || program.programStatus) === TRAINER_PROGRAM_STATUSES.ARCHIVED;
}

export function isTrainerProgramClientVisible(program = {}) {
  return [
    TRAINER_PROGRAM_STATUSES.ASSIGNED,
    TRAINER_PROGRAM_STATUSES.ACTIVE,
    TRAINER_PROGRAM_STATUSES.COMPLETED
  ].includes(normalizeTrainerProgramStatus(program.lifecycleStatus || program.programStatus));
}

export function buildDraftProgramMetadata(program = {}, { nowIso = "", ownerUid = "" } = {}) {
  const status = normalizeTrainerProgramStatus(
    program.lifecycleStatus || program.programStatus,
    TRAINER_PROGRAM_STATUSES.DRAFT
  );
  const safeNow = nowIso || new Date().toISOString();

  return {
    lifecycleStatus: status,
    programStatus: status,
    visibility: status === TRAINER_PROGRAM_STATUSES.DRAFT ? "trainer_draft" : program.visibility || "trainer_library",
    draftUpdatedAt: safeNow,
    updatedByUid: ownerUid || program.updatedByUid || "",
    publishedAt: program.publishedAt || "",
    archivedAt: status === TRAINER_PROGRAM_STATUSES.ARCHIVED ? (program.archivedAt || safeNow) : (program.archivedAt || "")
  };
}

export function buildReadyProgramMetadata(program = {}, { nowIso = "", ownerUid = "" } = {}) {
  const safeNow = nowIso || new Date().toISOString();

  return {
    lifecycleStatus: TRAINER_PROGRAM_STATUSES.READY,
    programStatus: TRAINER_PROGRAM_STATUSES.READY,
    visibility: "trainer_library",
    draftUpdatedAt: program.draftUpdatedAt || "",
    updatedByUid: ownerUid || program.updatedByUid || "",
    publishedAt: program.publishedAt || safeNow,
    archivedAt: ""
  };
}

export function buildProgramAssignmentMetadata(template = {}, {
  clientId = "",
  assignedAt = "",
  assignedByUid = ""
} = {}) {
  const safeAssignedAt = assignedAt || new Date().toISOString();
  const rawSourceStatus = String(template.lifecycleStatus || template.programStatus || "").trim();
  const sourceStatus = rawSourceStatus
    ? normalizeTrainerProgramStatus(rawSourceStatus, TRAINER_PROGRAM_STATUSES.READY)
    : TRAINER_PROGRAM_STATUSES.READY;
  const persistedSourceStatus = sourceStatus;
  const assignedClientIds = [
    ...new Set([
      ...(Array.isArray(template.assignedClientIds) ? template.assignedClientIds : []),
      clientId
    ].map((id) => String(id || "").trim()).filter(Boolean))
  ];

  return {
    lifecycleStatus: persistedSourceStatus,
    programStatus: persistedSourceStatus,
    visibility: persistedSourceStatus === TRAINER_PROGRAM_STATUSES.DRAFT
      ? "trainer_draft"
      : persistedSourceStatus === TRAINER_PROGRAM_STATUSES.ARCHIVED
        ? (template.visibility || "trainer_archived")
        : "trainer_library",
    publishedAt: template.publishedAt || safeAssignedAt,
    lastAssignedAt: safeAssignedAt,
    lastAssignedByUid: assignedByUid || "",
    updatedByUid: assignedByUid || template.updatedByUid || "",
    assignedClientIds
  };
}

export function buildClientProgramLifecycleMetadata({
  assignedAt = "",
  assignedByUid = ""
} = {}) {
  const safeAssignedAt = assignedAt || new Date().toISOString();

  return {
    assignedProgramLifecycleStatus: TRAINER_PROGRAM_STATUSES.ACTIVE,
    assignedProgramVisibility: "client_active",
    assignedProgramPublishedAt: safeAssignedAt,
    assignedProgramAssignedByUid: assignedByUid || ""
  };
}
