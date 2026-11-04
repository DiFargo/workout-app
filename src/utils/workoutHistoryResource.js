import { collection, getDocs } from "firebase/firestore";
import { runSessionResource } from "./sessionResource.js";
import { workoutHistoryStateFor } from "./workoutHistoryRevision.js";
export { invalidateWorkoutHistory, getWorkoutHistoryRevision } from "./workoutHistoryRevision.js";

export function readWorkoutHistory(auth, db, uid, { force = false } = {}) {
  const state = workoutHistoryStateFor(auth), revision = state.revision;
  const generation = (state.generations.get(uid) || 0) + (force ? 1 : 0);
  state.generations.set(uid, generation);
  let resourceIsCurrent = () => true;
  const isCurrent = () => resourceIsCurrent() && state.session.isCurrent()
    && state.revision === revision && state.generations.get(uid) === generation;
  const request = runSessionResource(auth, `workout-history:${uid}:${revision}`, async (resource) => {
    resourceIsCurrent = resource.isCurrent;
    return { snapshot: await getDocs(collection(db, "users", uid, "history")), isCurrent };
  }, { force });
  // Available even if I/O rejects, so an obsolete error cannot replace a newer
  // successful response or clear its loading indicator.
  const result = request.then(read => read
    ? { ...read, isCurrent: () => isCurrent() && read.isCurrent() }
    : { snapshot: null, isCurrent: () => false });
  result.isCurrent = isCurrent;
  return result;
}
