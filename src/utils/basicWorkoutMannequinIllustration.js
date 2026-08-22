import { BASIC_WORKOUT_EXERCISE_LIBRARY } from "../data/basicWorkoutExerciseLibrary.js";
import { getBasicWorkoutExerciseGroup } from "./basicWorkoutAlternatives.js";
import { getBasicWorkoutLibraryExercise } from "./basicWorkoutExercisePresentation.js";

const GROUP_ILLUSTRATION_FILES = Object.freeze({
  quads: "quads.webp",
  posterior_chain: "posterior-chain.webp",
  calves: "calves.webp",
  vertical_pull: "vertical-pull.webp",
  horizontal_pull: "horizontal-pull.webp",
  chest_press: "chest-press.webp",
  chest_incline: "chest-incline.webp",
  chest_fly: "chest-fly.webp",
  shoulder_press: "shoulder-press.webp",
  side_delts: "side-delts.webp",
  rear_delts: "rear-delts.webp",
  biceps: "biceps.webp",
  triceps: "triceps.webp",
  core: "core.webp"
});

function getIllustrationGroupId(exercise = {}, presentation = {}) {
  const inferredGroupId = getBasicWorkoutExerciseGroup(exercise)?.id;
  return String(
    inferredGroupId
    || presentation?.groupId
    || exercise?.basicExerciseGroupId
    || exercise?.groupId
    || ""
  ).trim();
}

function getFallbackExerciseId(exercise = {}, presentation = {}) {
  const groupId = getIllustrationGroupId(exercise, presentation);
  return BASIC_WORKOUT_EXERCISE_LIBRARY.find((item) => item.groupId === groupId)?.id || "";
}

function getFullCatalogueIllustrationSource(exercise = {}) {
  const sourceId = String(exercise?.sourceId || "").trim();
  if (!/^[A-Za-z0-9_-]+$/u.test(sourceId)) return "";
  return `/basic-workout/exercises/catalogue/v1/${sourceId}.webp`;
}

export function getBasicWorkoutGroupIllustrationSource(exercise = {}, presentation = {}) {
  const fileName = GROUP_ILLUSTRATION_FILES[getIllustrationGroupId(exercise, presentation)];
  return fileName ? `/basic-workout/illustrations/${fileName}` : "";
}

export function getBasicWorkoutMannequinIllustrationSource(
  exercise = {},
  presentation = {},
  { allowGroupFallback = true } = {}
) {
  const libraryExercise = getBasicWorkoutLibraryExercise(exercise);
  const catalogueSource = getFullCatalogueIllustrationSource(libraryExercise)
    || (exercise?.replacementId ? "" : getFullCatalogueIllustrationSource(exercise));
  if (catalogueSource) return catalogueSource;

  const exerciseId = libraryExercise?.illustrationId
    || libraryExercise?.id
    || (allowGroupFallback ? getFallbackExerciseId(exercise, presentation) : "");

  return exerciseId ? `/basic-workout/exercises/mannequin/${exerciseId}.png` : "";
}
