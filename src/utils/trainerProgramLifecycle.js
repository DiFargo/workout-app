export const TRAINER_PROGRAM_STATUSES = Object.freeze({
  DRAFT: "draft",
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
  const status = normalizeTrainerProgramStatus(program.lifecycleStatus || program.programStatus);
  return TRAINER_PROGRAM_STATUS_META[status] || TRAINER_PROGRAM_STATUS_META[TRAINER_PROGRAM_STATUSES.DRAFT];
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

export function buildProgramAssignmentMetadata(template = {}, {
  clientId = "",
  assignedAt = "",
  assignedByUid = ""
} = {}) {
  const safeAssignedAt = assignedAt || new Date().toISOString();
  const assignedClientIds = [
    ...new Set([
      ...(Array.isArray(template.assignedClientIds) ? template.assignedClientIds : []),
      clientId
    ].map((id) => String(id || "").trim()).filter(Boolean))
  ];

  return {
    lifecycleStatus: TRAINER_PROGRAM_STATUSES.ASSIGNED,
    programStatus: TRAINER_PROGRAM_STATUSES.ASSIGNED,
    visibility: "trainer_published",
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
