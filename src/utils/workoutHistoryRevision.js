import { captureAuthSession } from "./authSession.js";

const revisions = new WeakMap();
export function workoutHistoryStateFor(auth) {
  let state = revisions.get(auth);
  if (!state?.session.isUnchanged()) {
    state = { session: captureAuthSession(auth), revision: 0, generations: new Map() };
    revisions.set(auth, state);
  }
  return state;
}

export function invalidateWorkoutHistory(auth) {
  workoutHistoryStateFor(auth).revision += 1;
}

export function getWorkoutHistoryRevision(auth) {
  return workoutHistoryStateFor(auth).revision;
}
