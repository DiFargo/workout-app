const text = value => String(value ?? "").trim();
const hasValue = value => value !== undefined && value !== null && text(value) !== "";
const positiveInteger = value => {
  if (!hasValue(value) || typeof value === "boolean") return null;
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
};
const assignmentId = value => text(value?.assignedProgramAddedAt || value?.programAssignmentId);

function explicitOrder(workout) {
  const fields = [workout?.order, workout?.sortOrder].filter(hasValue);
  const values = fields.map(positiveInteger);
  return values.length && values.every(value => value !== null && value === values[0]) ? values[0] : null;
}

function isContiguous(values) {
  if (new Set(values).size !== values.length) return false;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted.every((value, index) => value === sorted[0] + index);
}

function calendarPosition(slot) {
  const order = hasValue(slot?.order) ? positiveInteger(slot.order) : null;
  const index = hasValue(slot?.index) && typeof slot.index !== "boolean" ? Number(slot.index) : null;
  if (hasValue(slot?.order) && order === null) return null;
  if (hasValue(slot?.index) && (!Number.isInteger(index) || index < 0)) return null;
  if (order !== null && index !== null && order !== index + 1) return null;
  return order ?? (index !== null ? index + 1 : null);
}

/**
 * Repair only the known mixed global/local order of one trainer assignment.
 * A complete, identity-keyed calendar supplies its confirmed positions; no
 * title/date inference, mutations, persistence, or execution selection occurs.
 */
export function resolveTrainerAssignmentWorkoutOrder(workouts = [], calendar = {}) {
  const original = Array.isArray(workouts) ? [...workouts] : [];
  if (original.length < 2) return original;

  const orders = original.map(explicitOrder);
  if (orders.some(order => order === null) || isContiguous(orders)) return original;

  const ids = original.map(workout => text(workout?.id));
  if (ids.some(id => !id) || new Set(ids).size !== ids.length) return original;
  const assignments = new Set(original.map(assignmentId).filter(Boolean));
  const programs = new Set(original.map(workout => text(workout?.assignedProgramId)).filter(Boolean));
  if (assignments.size > 1 || programs.size > 1) return original;
  const expectedAssignment = [...assignments][0] || "";
  const expectedProgram = [...programs][0] || "";
  const slots = Array.isArray(calendar?.plannedWorkouts) ? calendar.plannedWorkouts : [];
  const ownIds = new Set(ids);
  const positions = new Map();

  for (const slot of slots) {
    const id = text(slot?.workoutId);
    if (!ownIds.has(id)) continue;
    if (positions.has(id)) return original;
    // Queue versions may change while the durable assignment and exact day
    // identity stay the same. Missing legacy metadata is not a foreign ID.
    if (expectedAssignment && assignmentId(slot) && assignmentId(slot) !== expectedAssignment) return original;
    if (expectedProgram && text(slot?.assignedProgramId) && text(slot.assignedProgramId) !== expectedProgram) return original;
    const position = calendarPosition(slot);
    if (position === null) return original;
    positions.set(id, position);
  }

  if (positions.size !== original.length || new Set(positions.values()).size !== original.length) return original;
  if ([...positions.values()].some(position => position < 1 || position > original.length)) return original;

  const offsets = orders.map((order, index) => order - positions.get(ids[index]));
  const globalOffsets = new Set(offsets.filter(offset => offset !== 0));
  if (!offsets.includes(0) || globalOffsets.size !== 1 || [...globalOffsets][0] <= 0) return original;

  return original.sort((left, right) => positions.get(text(left.id)) - positions.get(text(right.id)));
}
