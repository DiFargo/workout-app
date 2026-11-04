import { exerciseLibraryNameKey as nameKey } from "./exerciseLibraryIdentity.js";
import { findCurrentExerciseCard, publicExerciseCard, isExerciseCardWorkoutMutable, mapTemplateExerciseCards } from "./exerciseCards.js";
import { normalizeExerciseVideoPosterTime } from "./exerciseVideoPoster.js";

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

// Resolve shared card metadata, then the legacy missing-media fallback. Sets,
// schedule and completed history remain snapshots; local overrides stay local.
export function resolveClientExerciseMedia(workouts, templates, trainerId, cards = []) {
  const library = templates.filter((template) => template.ownerUid === trainerId)
    .map((template) => mapTemplateExerciseCards(template, cards)).flatMap(templateExercises)
    .filter((exercise) => videoOf(exercise) && !exercise.libraryDeletedAt);
  const media = [];
  for (const workout of workouts) {
    if (workout.source === "basic" || String(workout.assignedProgramUpdatedAt || "").startsWith("basic:")) continue;
    if (workout.assignedBy && workout.assignedBy !== trainerId && !templates.some((template) => template.id === workout.assignedProgramId && template.ownerUid === trainerId)) continue;
    if (!isExerciseCardWorkoutMutable(workout)) continue;
    for (const exercise of workout.exercises || []) {
      if (!exercise.id) continue;
      const envelope = { workoutId: workout.id, exerciseId: exercise.id, exerciseName: exercise.name,
        assignmentVersion: workout.assignedProgramUpdatedAt || "" };
      const alternativeCards = (exercise.trainerAlternatives || []).map((alternative) => {
        const card = findCurrentExerciseCard(alternative, cards, trainerId);
        return card ? { id: alternative.libraryExerciseId || alternative.id,
          card: publicExerciseCard(card) } : null;
      }).filter(Boolean);
      if (alternativeCards.length) envelope.alternativeCards = alternativeCards;
      const card = findCurrentExerciseCard(exercise, cards, trainerId);
      if (card) {
        media.push({ ...envelope,
          card: publicExerciseCard(card) });
        continue;
      }
      if (videoOf(exercise) && !exercise.videoAutoFilledFrom) {
        if (alternativeCards.length) media.push(envelope);
        continue;
      }
      const libraryId = text(exercise.libraryExerciseId || exercise.sourceId || exercise.id);
      const byId = library.filter((item) => [text(item.id), text(item.libraryExerciseId)].includes(libraryId));
      const sameTemplate = byId.filter((item) => item.templateId === workout.assignedProgramId);
      const byName = library.filter((item) => [item.name, ...(item.exerciseCardNames || [])].some((name) => nameKey(name) === nameKey(exercise.name)));
      const match = uniqueVideo(sameTemplate) || uniqueVideo(byId) || (!byId.length ? uniqueVideo(byName) : null);
      const inheritedCard = match && findCurrentExerciseCard(match, cards, trainerId);
      if (inheritedCard) media.push({ ...envelope, card: publicExerciseCard(inheritedCard) });
      else if (match) media.push({ ...envelope, video: videoOf(match), sourceName: match.name,
        videoPosterTime: normalizeExerciseVideoPosterTime(match.videoPosterTime) });
      else if (alternativeCards.length) media.push(envelope);
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
  const [workouts, templates, cards] = await Promise.all([
    db.collection("users").doc(uid).collection("workouts").get(),
    db.collection("trainingTemplates").where("ownerUid", "==", trainerId).get(),
    db.collection("trainerExerciseCards").where("ownerUid", "==", trainerId).get()
  ]);
  // Recheck assignment after the reads so a reassignment in flight cannot
  // return the previous trainer's private library to the new relationship.
  const latest = await db.collection("users").doc(uid).get();
  if (!latest.exists || mediaTrainerId(latest.data()) !== trainerId) fail(409, "Trainer assignment changed");
  return { media: resolveClientExerciseMedia(workouts.docs.map((doc) => ({ ...doc.data(), id: doc.id })), templates.docs.map((doc) => ({ ...doc.data(), id: doc.id })), trainerId,
    cards.docs.map((doc) => ({ ...doc.data(), id: doc.id }))) };
}
