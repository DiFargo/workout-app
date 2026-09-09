import { exerciseLibraryNameKey as nameKey } from "./exerciseLibraryIdentity.js";

const text = (value) => typeof value === "string" ? value.trim() : "";
const videoOf = (exercise) => text(exercise?.video || exercise?.videoUrl || exercise?.videoURL);
const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };

export function mediaTrainerId(profile = {}) {
  const state = text(profile.trainerAssignmentState);
  if (["unassigned", "revoked"].includes(state)) return "";
  return text(profile.assignedTrainerId || profile.trainerId || profile.coachId || (state === "assigned" ? "" : profile.createdByUid));
}

function templateExercises(template) {
  const blocks = Array.isArray(template.blocks) ? template.blocks : (template.months || []).flatMap((month) => month.microcycles || month.blocks || []);
  return [...(template.workouts || []), ...blocks.flatMap((block) => (block.weeks || []).flatMap((week) => week.workouts || []))]
    .flatMap((workout) => workout.exercises || []).map((exercise) => ({ ...exercise, templateId: template.id }));
}

function uniqueVideo(candidates) {
  const videos = new Set(candidates.map(videoOf).filter(Boolean));
  return videos.size === 1 ? candidates.find((exercise) => videoOf(exercise)) : null;
}

// Resolve only missing/inherited media. Sets, schedule and completed history
// stay snapshots of the assigned programme; private overrides remain private.
export function resolveClientExerciseMedia(workouts, templates, trainerId) {
  const library = templates.filter((template) => template.ownerUid === trainerId).flatMap(templateExercises).filter((exercise) => videoOf(exercise));
  const media = [];
  for (const workout of workouts) {
    if (workout.source === "basic" || String(workout.assignedProgramUpdatedAt || "").startsWith("basic:")) continue;
    if (workout.assignedBy && workout.assignedBy !== trainerId) continue;
    if (["archived", "past"].includes(workout.assignedProgramLifecycleStatus) || workout.completed || workout.completedAt || ["completed", "completed_off_date", "missed"].includes(workout.status)) continue;
    for (const exercise of workout.exercises || []) {
      if (!exercise.id || (videoOf(exercise) && !exercise.videoAutoFilledFrom)) continue;
      const libraryId = text(exercise.libraryExerciseId || exercise.sourceId || exercise.id);
      const byId = library.filter((item) => [text(item.id), text(item.libraryExerciseId)].includes(libraryId));
      const sameTemplate = byId.filter((item) => item.templateId === workout.assignedProgramId);
      const byName = library.filter((item) => nameKey(item.name) === nameKey(exercise.name));
      const match = uniqueVideo(sameTemplate) || uniqueVideo(byId) || (!byId.length ? uniqueVideo(byName) : null);
      if (match) media.push({ workoutId: workout.id, exerciseId: exercise.id, exerciseName: exercise.name,
        assignmentVersion: workout.assignedProgramUpdatedAt || "", video: videoOf(match), sourceName: match.name });
    }
  }
  return media;
}

export async function readClientExerciseMedia({ db, context, clientId }) {
  const uid = text(clientId);
  if (!context?.uid) fail(401, "Authentication required");
  if (!uid || uid.length > 128 || uid.includes("/")) fail(400, "Invalid clientId");
  const profileSnapshot = await db.collection("users").doc(uid).get();
  if (!profileSnapshot.exists) fail(404, "Client not found");
  const profile = profileSnapshot.data();
  const trainerId = mediaTrainerId(profile);
  if (context.uid !== uid && context.token?.admin !== true && !(context.role === "trainer" && context.uid === trainerId)) fail(403, "Client access denied");
  if (!trainerId) return { media: [] };
  const [workouts, templates] = await Promise.all([
    db.collection("users").doc(uid).collection("workouts").get(),
    db.collection("trainingTemplates").where("ownerUid", "==", trainerId).get()
  ]);
  // Recheck assignment after the reads so a reassignment in flight cannot
  // return the previous trainer's private library to the new relationship.
  const latest = await db.collection("users").doc(uid).get();
  if (!latest.exists || mediaTrainerId(latest.data()) !== trainerId) fail(409, "Trainer assignment changed");
  return { media: resolveClientExerciseMedia(workouts.docs.map((doc) => ({ ...doc.data(), id: doc.id })), templates.docs.map((doc) => ({ ...doc.data(), id: doc.id })), trainerId) };
}
