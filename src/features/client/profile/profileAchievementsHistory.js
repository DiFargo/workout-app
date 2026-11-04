import { captureAuthSession } from "../../../utils/authSession.js";
import { getClientWorkoutCompletionHistory, getClientWorkoutReadModel } from "../../../utils/clientWorkoutEvidence.js";
import { readWorkoutHistory } from "../../../utils/workoutHistoryResource.js";
import { getWorkoutHistoryRevision } from "../../../utils/workoutHistoryRevision.js";

// Counts may reuse the verified compact all-period snapshot. Detailed records
// share the existing history resource on demand; no new startup read is added.
export async function loadProfileAchievementsHistory({ auth, db, plan, history = [], uid, requireDetails = false }, readHistory = readWorkoutHistory) {
  const session = captureAuthSession(auth);
  if (!session.isCurrent() || session.uid !== uid) return null;
  const revision = getWorkoutHistoryRevision(auth);
  const isCurrent = () => session.isCurrent() && getWorkoutHistoryRevision(auth) === revision;
  const model = getClientWorkoutReadModel(plan);
  if (model && !requireDetails) {
    return {
      items: getClientWorkoutCompletionHistory(plan, history),
      isCurrent
    };
  }

  const request = readHistory(auth, db, session.uid);
  const read = await request;
  if (!session.isCurrent() || !read?.isCurrent?.() || !read.snapshot ||
    read.snapshot.metadata?.fromCache || read.snapshot.metadata?.hasPendingWrites) return null;
  const items = [];
  read.snapshot.forEach(item => items.push({ ...item.data(), id: item.id }));
  items.push(...history.filter(item => item?.pendingSync));
  // A later background read may replace its resource generation. The accepted
  // read-only snapshot stays valid until data invalidation or an auth transition.
  return { items, isCurrent };
}
