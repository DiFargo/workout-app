function getAssignmentVersion(item = {}) {
  const legacyAssignedAt = typeof item.assignedAt === "string" ? item.assignedAt : "";
  return String(
    item.assignedProgramUpdatedAt || item.assignmentVersion || legacyAssignedAt || ""
  ).trim();
}

function getProgramId(item = {}) {
  return String(item.assignedProgramId || "").trim();
}

function isBasicWorkout(item = {}) {
  return item.source === "basic" || getAssignmentVersion(item).startsWith("basic:");
}

function getAssignmentTimestamp(item = {}) {
  const candidates = [
    getAssignmentVersion(item),
    item.assignedAt,
    item.updatedAt,
    item.createdAt
  ];

  for (const candidate of candidates) {
    if (candidate && typeof candidate.toMillis === "function") return candidate.toMillis();
    if (candidate?.seconds) return Number(candidate.seconds) * 1000;
    const timestamp = Date.parse(String(candidate || ""));
    if (Number.isFinite(timestamp)) return timestamp;
  }

  return 0;
}

function keepLatestAssignmentGroup(workouts = []) {
  if (workouts.length < 2) return workouts;

  const groups = new Map();
  workouts.forEach((workout, index) => {
    const version = getAssignmentVersion(workout);
    const programId = getProgramId(workout);
    const key = version ? `version:${version}` : programId ? `program:${programId}` : "legacy";
    const current = groups.get(key) || { items: [], timestamp: 0, lastIndex: index };
    current.items.push(workout);
    current.timestamp = Math.max(current.timestamp, getAssignmentTimestamp(workout));
    current.lastIndex = index;
    groups.set(key, current);
  });

  if (groups.size < 2) return workouts;

  return [...groups.values()]
    .sort((left, right) => (
      right.timestamp - left.timestamp || right.lastIndex - left.lastIndex
    ))[0].items;
}

export function filterTrainerCurrentPlanWorkouts(workouts = [], client = {}) {
  const safeWorkouts = Array.isArray(workouts) ? workouts : [];
  const activeVersion = String(
    client.assignedProgramUpdatedAt || client.assignedProgramAt || ""
  ).trim();
  const activeProgramId = getProgramId(client);

  if (activeVersion) {
    const versionMatches = safeWorkouts.filter((workout) => (
      getAssignmentVersion(workout) === activeVersion
    ));
    if (versionMatches.length) return versionMatches;
  }

  if (activeProgramId) {
    const programMatches = safeWorkouts.filter((workout) => (
      getProgramId(workout) === activeProgramId
    ));
    if (programMatches.length) return keepLatestAssignmentGroup(programMatches);
  }

  const individualWorkouts = safeWorkouts.filter((workout) => !isBasicWorkout(workout));
  const hasBasicWorkouts = individualWorkouts.length !== safeWorkouts.length;

  const currentCandidates = hasBasicWorkouts && individualWorkouts.length
    ? individualWorkouts
    : safeWorkouts;

  return keepLatestAssignmentGroup(currentCandidates);
}
