import { getBasicWorkoutExerciseGroup } from "./basicWorkoutAlternatives.js";

export const TRAINER_LIBRARY_MUSCLES = [
  ["chest", "Грудь"], ["back", "Спина"], ["shoulders", "Плечи"],
  ["legs", "Ноги и ягодицы"], ["calves", "Икры"], ["biceps", "Бицепс"],
  ["triceps", "Трицепс"], ["core", "Пресс"], ["other", "Без группы"]
];

export function getTrainerLibraryMuscle(exercise) {
  const group = getBasicWorkoutExerciseGroup(exercise)?.id;
  if (["chest_incline", "chest_fly", "chest_press"].includes(group)) return "chest";
  if (["vertical_pull", "horizontal_pull"].includes(group)) return "back";
  if (["rear_delts", "side_delts", "shoulder_press"].includes(group)) return "shoulders";
  if (["posterior_chain", "quads"].includes(group)) return "legs";
  return ["calves", "biceps", "triceps", "core"].includes(group) ? group : "other";
}
