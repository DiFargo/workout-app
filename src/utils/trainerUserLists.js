export function normalizeTrainerClientRecord(item = {}) {
  return {
    ...item,
    role: item.role || "client"
  };
}

const TRAINER_ID_FIELDS = ["assignedTrainerId", "trainerId", "coachId"];
const TRAINER_EMAIL_FIELDS = ["assignedTrainerEmail", "trainerEmail", "coachEmail"];
const LEGACY_TRAINER_ID_FIELDS = ["createdByUid"];
const LEGACY_TRAINER_EMAIL_FIELDS = ["createdByEmail", "createdBy"];

function normalizedValue(value) {
  return String(value || "").trim();
}

function normalizedEmail(value) {
  return normalizedValue(value).toLocaleLowerCase("ru");
}

function matchesPrimaryTrainerId(record, trainerUid) {
  const assignedTrainerId = normalizedValue(record?.assignedTrainerId);
  if (assignedTrainerId) return assignedTrainerId === trainerUid;

  const trainerId = normalizedValue(record?.trainerId);
  if (trainerId) return trainerId === trainerUid;

  const coachId = normalizedValue(record?.coachId);
  return Boolean(coachId && coachId === trainerUid);
}

function matchesPrimaryTrainerEmail(record, trainerEmail) {
  if (!trainerEmail) return false;

  const assignedTrainerEmail = normalizedEmail(record?.assignedTrainerEmail);
  if (assignedTrainerEmail) return assignedTrainerEmail === trainerEmail;

  const trainerEmailValue = normalizedEmail(record?.trainerEmail);
  if (trainerEmailValue) return trainerEmailValue === trainerEmail;

  const coachEmail = normalizedEmail(record?.coachEmail);
  return Boolean(coachEmail && coachEmail === trainerEmail);
}

/**
 * Keep historical creator fields useful for legacy accounts without letting them
 * override an explicit admin assignment. This mirrors the access precedence in
 * Firestore rules and prevents a previous trainer from retaining a stale client
 * card after reassignment or unassignment.
 */
export function isCurrentTrainerClient(record = {}, { trainerUid = "", trainerEmail = "" } = {}) {
  if (normalizedValue(record?.role || "client").toLocaleLowerCase("ru") !== "client") {
    return false;
  }

  // A link-only mirror is a cache, not an authority. The canonical user
  // document must be readable and confirm the assignment before a trainer can
  // see a client, otherwise an old mirror could survive a reassignment.
  if (record?.trainerLinkOnly) return false;

  const normalizedTrainerUid = normalizedValue(trainerUid);
  const normalizedTrainerEmail = normalizedEmail(trainerEmail);
  if (!normalizedTrainerUid && !normalizedTrainerEmail) return false;

  const assignmentState = normalizedValue(record?.trainerAssignmentState).toLocaleLowerCase("ru");
  const hasExplicitAssignmentState = assignmentState === "assigned" || assignmentState === "unassigned";
  const hasPrimaryAssignment = TRAINER_ID_FIELDS.some((field) => normalizedValue(record?.[field])) ||
    TRAINER_EMAIL_FIELDS.some((field) => normalizedEmail(record?.[field]));
  const primaryMatch = (
    (normalizedTrainerUid && matchesPrimaryTrainerId(record, normalizedTrainerUid)) ||
    (normalizedTrainerEmail && matchesPrimaryTrainerEmail(record, normalizedTrainerEmail))
  );

  if (hasExplicitAssignmentState) {
    return Boolean(assignmentState === "assigned" && primaryMatch);
  }
  if (hasPrimaryAssignment) return primaryMatch;

  return (
    (normalizedTrainerUid && LEGACY_TRAINER_ID_FIELDS.some(
      (field) => normalizedValue(record?.[field]) === normalizedTrainerUid
    )) ||
    (normalizedTrainerEmail && LEGACY_TRAINER_EMAIL_FIELDS.some(
      (field) => normalizedEmail(record?.[field]) === normalizedTrainerEmail
    ))
  );
}

export function buildTrainerUserLists(items = [], options = {}) {
  const isAdmin = Boolean(options.isAdmin);
  const adminEmail = String(options.adminEmail || "").toLowerCase();
  const uniqueUsers = new Map();

  items.forEach((item) => {
    if (!item?.id) return;
    uniqueUsers.set(item.id, normalizeTrainerClientRecord(item));
  });

  const users = [...uniqueUsers.values()].sort((a, b) =>
    String(a.name || a.email || "").localeCompare(String(b.name || b.email || ""), "ru")
  );
  const clients = users.filter((item) => {
    const role = item.role || "client";
    const email = String(item.email || "").toLowerCase();
    if (email === adminEmail) return false;
    return isAdmin
      ? ["client", "trainer"].includes(role)
      : role === "client";
  });

  return { users, clients };
}
