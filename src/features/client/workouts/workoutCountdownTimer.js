function toSafeSeconds(value) {
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds) : 0;
}

export function createWorkoutCountdownDeadline(seconds, now = Date.now()) {
  const safeSeconds = toSafeSeconds(seconds);
  return safeSeconds ? now + safeSeconds * 1000 : 0;
}

export function getWorkoutCountdownRemainingSeconds(deadline, now = Date.now()) {
  const safeDeadline = Number(deadline);
  if (!Number.isFinite(safeDeadline) || safeDeadline <= now) return 0;

  return Math.max(0, Math.ceil((safeDeadline - now) / 1000));
}
