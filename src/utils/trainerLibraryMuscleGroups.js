import { getBasicWorkoutExerciseGroup } from "./basicWorkoutAlternatives.js";
import { exerciseLibraryNameKey } from "../../functions/exerciseLibraryIdentity.js";

export const TRAINER_LIBRARY_MUSCLES = [
  ["chest", "Грудь"], ["back", "Спина"], ["shoulders", "Плечи"],
  ["legs", "Ноги и ягодицы"], ["calves", "Икры"], ["biceps", "Бицепс"],
  ["triceps", "Трицепс"], ["core", "Пресс"], ["other", "Без группы"]
];

function libraryGroup(group) {
  if (["chest_incline", "chest_fly", "chest_press"].includes(group)) return "chest";
  if (["vertical_pull", "horizontal_pull"].includes(group)) return "back";
  if (["rear_delts", "side_delts", "shoulder_press"].includes(group)) return "shoulders";
  if (["posterior_chain", "quads"].includes(group)) return "legs";
  return ["calves", "biceps", "triceps", "core"].includes(group) ? group : "other";
}

export function getTrainerLibraryMuscle(exercise = {}) {
  // A trainer's explicit choice wins over guesses from the exercise name.
  const saved = String(exercise.muscleGroup || "").trim().toLocaleLowerCase("ru");
  const explicit = TRAINER_LIBRARY_MUSCLES.find(([id, title]) => id === saved || title.toLocaleLowerCase("ru") === saved);
  if (explicit) return explicit[0];
  const savedGroup = getBasicWorkoutExerciseGroup({
    muscleGroup: exercise.muscleGroup, groupId: exercise.groupId,
    basicExerciseGroupId: exercise.basicExerciseGroupId,
    basicExerciseGroupTitle: exercise.basicExerciseGroupTitle
  });
  if (savedGroup) return libraryGroup(savedGroup.id);

  const name = exerciseLibraryNameKey(exercise.name);
  if (/подъем.*(гантел|рук).*вперед|(?:отведение|разведение).*рук.*в наклоне|(?:разведение|разведения).*гантел.*в стороны/.test(name)) return "shoulders";
  if (/жим.*одной ногой|(?:разведение|сведение) ног/.test(name)) return "legs";
  if (/альпинист/.test(name)) return "core";
  return libraryGroup(getBasicWorkoutExerciseGroup({ ...exercise, name })?.id);
}
