function getText(value = "") {
  return String(value || "").trim();
}

function getTimestamp(value = "") {
  if (value && typeof value.toMillis === "function") return value.toMillis();
  if (value?.seconds) return Number(value.seconds) * 1000;
  const parsed = Date.parse(String(value || ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function hasManualWorkoutCompletion(workout = {}) {
  const status = getText(workout.status).toLowerCase();
  if (status === "completed" || status === "completed_off_date" || workout.completed === true) return true;
  return false;
}

function isExplicitlyIncompleteWorkout(workout = {}) {
  return ["not_completed", "missed"].includes(getText(workout.status).toLowerCase());
}

function getHistoryAssignmentTime(entry = {}) {
  return getText(entry.assignedProgramAddedAt || entry.programAssignmentId || entry.assignedAt);
}

function getAssignmentVersion(entry = {}) {
  return getText(entry.assignedProgramUpdatedAt || entry.assignmentVersion);
}

function matchesWorkoutAssignment(historyItem = {}, workout = {}, assignmentContext = {}) {
  if (getText(historyItem.workoutId).toLowerCase() !== getText(workout.id).toLowerCase()) return false;

  const workoutId = getText(workout.id).toLowerCase();
  const isAmbiguousWorkoutId = assignmentContext.ambiguousWorkoutIds?.has(workoutId);
  const historyAssignmentTime = getHistoryAssignmentTime(historyItem);
  const workoutAssignmentTime = getHistoryAssignmentTime(workout);
  const historyProgramId = getText(historyItem.assignedProgramId);
  const workoutProgramId = getText(workout.assignedProgramId);

  if (historyProgramId && workoutProgramId && historyProgramId !== workoutProgramId) return false;

  if (workoutAssignmentTime) {
    if (historyAssignmentTime) return historyAssignmentTime === workoutAssignmentTime;

    // Older history records did not persist the durable assignment id.  They
    // may still describe this template, but can never belong to a program
    // assigned after the session was completed.
    const historyTimestamp = getTimestamp(
      historyItem.date || historyItem.completedAt || historyItem.finishedAt || historyItem.createdAt
    );
    const assignmentTimestamp = getTimestamp(workoutAssignmentTime);
    if (historyTimestamp && assignmentTimestamp && historyTimestamp < assignmentTimestamp) {
      const assignmentTimestamps = assignmentContext.assignmentTimestampsByWorkoutId?.get(workoutId) || [];
      const earliestAssignmentTimestamp = assignmentTimestamps[0] || assignmentTimestamp;
      // Some legacy sessions lack assignment metadata and have an unreliable
      // date. Attribute them to the earliest matching assignment only: this
      // preserves an old completed program without moving it to a newer one.
      return assignmentTimestamp === earliestAssignmentTimestamp;
    }
  }

  if (historyProgramId && workoutProgramId) {
    const programIds = assignmentContext.programIdsByWorkoutId?.get(workoutId) || new Set();
    if (!isAmbiguousWorkoutId || programIds.size > 1) return true;

    // The same template may be assigned again. An old unmarked history entry
    // belongs to the earliest copy; current completions always carry the
    // durable assignment id written by the client save flow.
    const assignmentTimestamps = assignmentContext.assignmentTimestampsByWorkoutId?.get(workoutId) || [];
    const workoutAssignmentTimestamp = getTimestamp(workoutAssignmentTime);
    return Boolean(workoutAssignmentTimestamp) && workoutAssignmentTimestamp === assignmentTimestamps[0];
  }

  const historyVersion = getAssignmentVersion(historyItem);
  const workoutVersion = getAssignmentVersion(workout);
  if (historyVersion && workoutVersion) {
    return historyVersion === workoutVersion && !isAmbiguousWorkoutId;
  }

  // A legacy history item without any assignment metadata is safe only when
  // the workout id exists in one assignment.  With a duplicate id we cannot
  // honestly attribute that completion to the newly appended program.
  return !isAmbiguousWorkoutId;
}

function getAssignmentCompletion(workout = {}, history = [], assignmentContext = {}) {
  if (isExplicitlyIncompleteWorkout(workout)) return { completed: false, history: [] };
  if (hasManualWorkoutCompletion(workout)) return { completed: true, history: [] };

  const matchingHistory = (Array.isArray(history) ? history : []).filter((entry) => (
    matchesWorkoutAssignment(entry, workout, assignmentContext)
  ));

  return {
    completed: matchingHistory.length > 0,
    history: matchingHistory
  };
}

/**
 * A basic plan is created by the client, not assigned by a trainer. Keep this
 * check deliberately narrow: legacy trainer assignments must stay visible.
 */
export function isTrainerClientBasicWorkout(workout = {}) {
  return getText(workout?.source).toLowerCase() === "basic" ||
    getText(workout?.assignedProgramUpdatedAt).startsWith("basic:") ||
    getText(workout?.assignedProgramId).startsWith("basic_");
}

/**
 * `assignedProgramUpdatedAt` is the queue version shared by appended programs.
 * A separate `assignedProgramAddedAt` is therefore the durable identity of one
 * client assignment. Older documents fall back to their original assignedAt.
 */
export function getTrainerClientProgramAssignmentKey(item = {}, fallbackIndex = 0) {
  const assignmentTime = getText(
    item.assignedProgramAddedAt || item.programAssignmentId || item.assignedAt
  );
  const programId = getText(item.assignedProgramId);

  if (assignmentTime) return `time:${assignmentTime}`;
  if (programId) return `program:${programId}`;
  return `legacy:${fallbackIndex}`;
}

export function buildTrainerClientProgramTimeline({
  workouts = [],
  archivedWorkouts = [],
  history = [],
  clientProfile = {}
} = {}) {
  const allWorkouts = [
    ...(Array.isArray(workouts) ? workouts : []),
    ...(Array.isArray(archivedWorkouts) ? archivedWorkouts : [])
  ];
  const workoutIdCounts = new Map();
  const programIdsByWorkoutId = new Map();
  const assignmentTimestampsByWorkoutId = new Map();

  allWorkouts.forEach((workout) => {
    const workoutId = getText(workout?.id).toLowerCase();
    if (!workoutId) return;
    workoutIdCounts.set(workoutId, (workoutIdCounts.get(workoutId) || 0) + 1);
    const programId = getText(workout?.assignedProgramId);
    if (!programIdsByWorkoutId.has(workoutId)) programIdsByWorkoutId.set(workoutId, new Set());
    if (programId) programIdsByWorkoutId.get(workoutId).add(programId);
    const assignmentTimestamp = getTimestamp(getHistoryAssignmentTime(workout));
    if (!assignmentTimestampsByWorkoutId.has(workoutId)) assignmentTimestampsByWorkoutId.set(workoutId, []);
    if (assignmentTimestamp && !assignmentTimestampsByWorkoutId.get(workoutId).includes(assignmentTimestamp)) {
      assignmentTimestampsByWorkoutId.get(workoutId).push(assignmentTimestamp);
    }
  });

  assignmentTimestampsByWorkoutId.forEach((timestamps) => timestamps.sort((left, right) => left - right));

  const assignmentContext = {
    ambiguousWorkoutIds: new Set(
      [...workoutIdCounts.entries()]
        .filter(([, count]) => count > 1)
        .map(([workoutId]) => workoutId)
    ),
    programIdsByWorkoutId,
    assignmentTimestampsByWorkoutId
  };
  const groups = new Map();

  function addWorkout(workout, archived, index) {
    const assignmentKey = getTrainerClientProgramAssignmentKey(workout, index);
    const current = groups.get(assignmentKey) || {
      key: assignmentKey,
      programId: getText(workout?.assignedProgramId),
      name: getText(workout?.assignedProgramName) || "Индивидуальная программа",
      assignedAt: getText(
        workout?.assignedProgramAddedAt || workout?.assignedAt || workout?.assignedProgramUpdatedAt
      ),
      timestamp: 0,
      workouts: [],
      completedCount: 0,
      missedCount: 0,
      completedWorkoutIds: [],
      history: [],
      archived: false,
      isBasic: false,
      order: index
    };
    const timestamp = getTimestamp(
      workout?.assignedProgramAddedAt || workout?.assignedAt || workout?.assignedProgramUpdatedAt
    );

    current.programId = current.programId || getText(workout?.assignedProgramId);
    current.name = current.name || getText(workout?.assignedProgramName) || "Индивидуальная программа";
    current.assignedAt = current.assignedAt || getText(
      workout?.assignedProgramAddedAt || workout?.assignedAt || workout?.assignedProgramUpdatedAt
    );
    current.timestamp = Math.max(current.timestamp, timestamp);
    current.order = Math.max(current.order, index);
    current.archived = current.archived || archived || getText(workout?.assignedProgramLifecycleStatus).toLowerCase() === "archived";
    current.isBasic = current.isBasic || isTrainerClientBasicWorkout(workout);
    current.workouts.push(workout);
    if (isExplicitlyIncompleteWorkout(workout)) current.missedCount += 1;
    const completion = getAssignmentCompletion(workout, history, assignmentContext);
    if (completion.completed) {
      current.completedCount += 1;
      const workoutId = getText(workout?.id);
      if (workoutId) current.completedWorkoutIds.push(workoutId);
    }
    completion.history.forEach((entry) => {
      if (!current.history.includes(entry)) current.history.push(entry);
    });
    groups.set(assignmentKey, current);
  }

  (Array.isArray(workouts) ? workouts : []).forEach((workout, index) => addWorkout(workout, false, index));
  const activeLength = Array.isArray(workouts) ? workouts.length : 0;
  (Array.isArray(archivedWorkouts) ? archivedWorkouts : []).forEach((workout, index) => addWorkout(workout, true, activeLength + index));

  const activeAssignmentTime = getText(
    clientProfile?.assignedProgramAddedAt ||
    clientProfile?.assignedProgramAt ||
    clientProfile?.assignedAt
  );
  const activeProgramId = getText(clientProfile?.assignedProgramId);
  const activeAssignmentTimestamp = getTimestamp(activeAssignmentTime);

  return [...groups.values()]
    .map((group) => {
      const workoutCount = group.workouts.length;
      const isComplete = workoutCount > 0 && group.completedCount >= workoutCount;
      // A previous assignment can contain no completed sessions because all
      // of its days were explicitly marked missed. It must not stay first in
      // the "future" queue and shadow a newly assigned program with the same
      // name. A program is still future until the first real completion, but
      // a fully missed copy belongs to history.
      const isFullyMissed = workoutCount > 0 && group.missedCount >= workoutCount;
      const isProfileAssignment = Boolean(activeAssignmentTime) &&
        group.key === `time:${activeAssignmentTime}` &&
        (!activeProgramId || !group.programId || group.programId === activeProgramId);
      const isOlderThanProfileAssignment = Boolean(
        activeAssignmentTimestamp && group.timestamp && group.timestamp < activeAssignmentTimestamp
      );
      const status = group.archived
        ? "archived"
        : isComplete || isFullyMissed
          ? "past"
          : isProfileAssignment
            ? (group.completedCount > 0 ? "current" : "future")
            : activeAssignmentTime && isOlderThanProfileAssignment
              ? "past"
              : group.completedCount > 0
                ? "current"
                : "future";

      return {
        ...group,
        workoutCount,
        status,
        completion: workoutCount ? Math.round(group.completedCount / workoutCount * 100) : 0
      };
    })
    .sort((left, right) => left.timestamp - right.timestamp || left.order - right.order);
}

export function getNextTrainerClientActiveProgramAssignment(workouts = [], history = [], clientProfile = {}) {
  const timeline = buildTrainerClientProgramTimeline({ workouts, history, clientProfile });
  return timeline.find((assignment) => assignment.status === "current") ||
    timeline.find((assignment) => assignment.status === "future") ||
    null;
}

export function isTrainerClientProgramAssignmentMatch(workout = {}, assignmentKey = "") {
  const key = getText(assignmentKey);
  return Boolean(key) && getTrainerClientProgramAssignmentKey(workout) === key;
}

/**
 * The client profile points to one concrete trainer assignment, not to every
 * historical copy made from the same template.  `assignedProgramAddedAt` is
 * the durable identity written when the copy is created for this client.
 */
export function isTrainerClientCurrentAssignmentWorkout(workout = {}, clientProfile = {}) {
  if (isTrainerClientBasicWorkout(workout)) return false;

  const activeProgramId = getText(clientProfile?.assignedProgramId);
  const workoutProgramId = getText(workout?.assignedProgramId);
  if (!activeProgramId || !workoutProgramId || workoutProgramId !== activeProgramId) return false;

  const activeAssignmentTime = getText(
    clientProfile?.assignedProgramAddedAt ||
    clientProfile?.assignedProgramAt ||
    clientProfile?.assignedAt
  );
  if (!activeAssignmentTime) return true;

  const workoutAssignmentTime = getText(
    workout?.assignedProgramAddedAt ||
    workout?.programAssignmentId ||
    workout?.assignedAt
  );

  // Do not guess for a legacy row with no durable assignment id: guessing
  // could attach a completed old copy to a newly assigned identical template.
  return Boolean(workoutAssignmentTime) && workoutAssignmentTime === activeAssignmentTime;
}
