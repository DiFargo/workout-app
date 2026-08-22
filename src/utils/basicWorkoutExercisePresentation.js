import { getBasicWorkoutExerciseGroup } from "./basicWorkoutAlternatives.js";
import { BASIC_WORKOUT_EXERCISE_LIBRARY } from "../data/basicWorkoutExerciseLibrary.js";

function normalizeExerciseName(name = "") {
  return String(name || "")
    .toLocaleLowerCase("ru")
    .replace(/ё/gu, "е")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

const LIBRARY_EXERCISE_BY_NAME = new Map();

function getRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function getText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function hasOwn(record, key) {
  return Object.prototype.hasOwnProperty.call(record, key);
}

BASIC_WORKOUT_EXERCISE_LIBRARY.forEach((libraryExercise) => {
  [libraryExercise.name, ...(libraryExercise.aliases || [])]
    .map(normalizeExerciseName)
    .filter(Boolean)
    .forEach((name) => {
      if (!LIBRARY_EXERCISE_BY_NAME.has(name)) {
        LIBRARY_EXERCISE_BY_NAME.set(name, libraryExercise);
      }
    });
});

export function getBasicWorkoutLibraryExercise(exercise = {}) {
  const safeExercise = exercise && typeof exercise === "object" ? exercise : {};
  const libraryId = [
    safeExercise.replacementId,
    safeExercise.basicExerciseOverrideId,
    safeExercise.basicExerciseId,
    safeExercise.basicExerciseLibraryId,
    safeExercise.libraryExerciseId,
    safeExercise.id
  ]
    .map(getText)
    .find((id) => BASIC_WORKOUT_EXERCISE_LIBRARY.some((item) => item.id === id));

  if (libraryId) {
    return BASIC_WORKOUT_EXERCISE_LIBRARY.find((item) => item.id === libraryId) || null;
  }

  const normalizedName = normalizeExerciseName(safeExercise.name);
  const exactMatch = LIBRARY_EXERCISE_BY_NAME.get(normalizedName);
  if (exactMatch) return exactMatch;

  // AI plans created before the library was attached can contain a clear
  // variation of a known name. Resolve it only when there is one unambiguous
  // exercise match, never by falling back to the first item in a muscle group.
  const partialMatches = BASIC_WORKOUT_EXERCISE_LIBRARY.filter((libraryExercise) => (
    [libraryExercise.name, ...(libraryExercise.aliases || [])]
      .map(normalizeExerciseName)
      .some((candidateName) => candidateName && (
        normalizedName.includes(candidateName) || candidateName.includes(normalizedName)
      ))
  ));

  return partialMatches.length === 1 ? partialMatches[0] : null;
}

// Overrides are intentionally limited to presentation data. They never touch
// sets, history, workout ordering or the ids persisted in an assigned plan.
export function normalizeBasicWorkoutExerciseOverrides(overrides = {}) {
  const entries = Array.isArray(overrides)
    ? overrides.map((override) => [getText(override?.id), override])
    : Object.entries(getRecord(overrides));

  return entries.reduce((normalized, [rawId, value]) => {
    const id = getText(rawId);
    const record = getRecord(value);
    if (!id) return normalized;

    normalized[id] = {
      name: getText(record.name),
      equipment: getText(record.equipment),
      note: getText(record.note),
      imageUrl: getText(record.imageUrl),
      videoUrl: getText(record.videoUrl),
      imageDisabled: record.imageDisabled === true,
      videoDisabled: record.videoDisabled === true,
      // This helper is intentionally idempotent: the client hook caches an
      // already-normalized map, while unit callers may pass the raw Firestore
      // object. Keep the original presence flags when they are available so
      // an omitted field never erases a saved-plan presentation value.
      hasName: typeof record.hasName === "boolean" ? record.hasName : hasOwn(record, "name"),
      hasEquipment: typeof record.hasEquipment === "boolean" ? record.hasEquipment : hasOwn(record, "equipment"),
      hasNote: typeof record.hasNote === "boolean" ? record.hasNote : hasOwn(record, "note"),
      hasImageUrl: typeof record.hasImageUrl === "boolean" ? record.hasImageUrl : hasOwn(record, "imageUrl"),
      hasVideoUrl: typeof record.hasVideoUrl === "boolean" ? record.hasVideoUrl : hasOwn(record, "videoUrl")
    };

    return normalized;
  }, {});
}

export function getBasicWorkoutExerciseOverrideId(exercise = {}) {
  return getBasicWorkoutLibraryExercise(exercise)?.id || "";
}

export function applyBasicWorkoutExerciseOverride(exercise = {}, overrides = {}) {
  const originalExercise = getRecord(exercise);
  const exerciseId = getBasicWorkoutExerciseOverrideId(originalExercise);
  const override = normalizeBasicWorkoutExerciseOverrides(overrides)[exerciseId];

  if (!exerciseId || !override) return originalExercise;

  const originalName = getText(originalExercise.name);
  const originalEquipment = getText(originalExercise.equipment);
  const originalNote = getText(originalExercise.note);
  const imageUrl = override.imageDisabled ? "" : override.imageUrl;
  const videoUrl = override.videoDisabled ? "" : override.videoUrl;

  return {
    ...originalExercise,
    // Keep an immutable catalogue reference so an overridden title still
    // resolves to the same muscles, equipment illustration and fallback art.
    basicExerciseId: getText(originalExercise.basicExerciseId) || exerciseId,
    basicExerciseOverrideId: exerciseId,
    basicExerciseOriginalName: getText(originalExercise.basicExerciseOriginalName) || originalName,
    name: override.hasName ? override.name || originalName : originalName,
    equipment: override.hasEquipment ? override.equipment || originalEquipment : originalEquipment,
    note: override.hasNote ? override.note : originalNote,
    basicExerciseImageUrl: imageUrl,
    basicExerciseImageDisabled: override.imageDisabled,
    basicExerciseVideoUrl: videoUrl,
    basicExerciseVideoDisabled: override.videoDisabled,
    // A removed video intentionally clears only the rendered source. The
    // original plan object remains untouched for history and sync purposes.
    video: override.videoDisabled ? "" : videoUrl || originalExercise.video
  };
}

export function getBasicWorkoutExerciseTechniqueHint(exercise = {}, fallbackHint = "") {
  return getText(exercise?.note) || fallbackHint;
}

// Every basic-workout movement group has its own original anatomy map.
// Primary areas receive the main lavender colour; assisting muscles are lighter.
const MUSCLE_PRESENTATIONS = {
  quads: {
    bodyZone: "quads",
    view: "front",
    title: "Ноги",
    description: "Основная нагрузка — передняя часть бедра.",
    primaryMuscles: ["Квадрицепс"],
    secondaryMuscles: ["Ягодицы"],
    primaryAreas: ["quads"],
    secondaryAreas: ["glutes"]
  },
  posterior_chain: {
    bodyZone: "glutes",
    view: "back",
    title: "Ноги и ягодицы",
    description: "Основная нагрузка — ягодицы и задняя часть бедра.",
    primaryMuscles: ["Ягодицы", "Задняя часть бедра"],
    secondaryMuscles: ["Нижняя часть спины"],
    primaryAreas: ["glutes", "hamstrings"],
    secondaryAreas: ["lowerBack"]
  },
  calves: {
    bodyZone: "calves",
    view: "back",
    title: "Икры",
    description: "Основная нагрузка — мышцы голени.",
    primaryMuscles: ["Икры"],
    secondaryMuscles: [],
    primaryAreas: ["calves"],
    secondaryAreas: []
  },
  vertical_pull: {
    bodyZone: "back",
    view: "back",
    title: "Спина",
    description: "Основная нагрузка — широчайшие мышцы и верхняя часть спины.",
    primaryMuscles: ["Широчайшие", "Верх спины"],
    secondaryMuscles: ["Бицепс"],
    primaryAreas: ["lats", "upperBack"],
    secondaryAreas: ["biceps"]
  },
  horizontal_pull: {
    bodyZone: "back",
    view: "back",
    title: "Спина",
    description: "Основная нагрузка — середина и широчайшие мышцы спины.",
    primaryMuscles: ["Середина спины", "Широчайшие"],
    secondaryMuscles: ["Бицепс"],
    primaryAreas: ["midBack", "lats"],
    secondaryAreas: ["biceps"]
  },
  chest_press: {
    bodyZone: "chest",
    view: "front",
    title: "Грудь",
    description: "Основная нагрузка — грудные мышцы.",
    primaryMuscles: ["Грудь"],
    secondaryMuscles: ["Передняя дельта", "Трицепс"],
    primaryAreas: ["chest"],
    secondaryAreas: ["frontDelts", "triceps"]
  },
  chest_incline: {
    bodyZone: "chest",
    view: "front",
    title: "Грудь",
    description: "Основная нагрузка — верхняя часть груди.",
    primaryMuscles: ["Верх груди"],
    secondaryMuscles: ["Передняя дельта", "Трицепс"],
    primaryAreas: ["upperChest"],
    secondaryAreas: ["frontDelts", "triceps"]
  },
  chest_fly: {
    bodyZone: "chest",
    view: "front",
    title: "Грудь",
    description: "Основная нагрузка — грудные мышцы.",
    primaryMuscles: ["Грудь"],
    secondaryMuscles: ["Передняя дельта"],
    primaryAreas: ["chest"],
    secondaryAreas: ["frontDelts"]
  },
  shoulder_press: {
    bodyZone: "shoulders",
    view: "front",
    title: "Плечи",
    description: "Основная нагрузка — передняя и средняя часть плеч.",
    primaryMuscles: ["Плечи"],
    secondaryMuscles: ["Трицепс"],
    primaryAreas: ["frontDelts", "sideDelts"],
    secondaryAreas: ["triceps"]
  },
  side_delts: {
    bodyZone: "shoulders",
    view: "front",
    title: "Плечи",
    description: "Основная нагрузка — средняя часть плеч.",
    primaryMuscles: ["Средняя дельта"],
    secondaryMuscles: [],
    primaryAreas: ["sideDelts"],
    secondaryAreas: []
  },
  rear_delts: {
    bodyZone: "shoulders",
    view: "back",
    title: "Плечи",
    description: "Основная нагрузка — задняя часть плеч.",
    primaryMuscles: ["Задняя дельта"],
    secondaryMuscles: ["Верх спины"],
    primaryAreas: ["rearDelts"],
    secondaryAreas: ["upperBack"]
  },
  biceps: {
    bodyZone: "biceps",
    view: "front",
    title: "Бицепс",
    description: "Основная нагрузка — передняя часть рук.",
    primaryMuscles: ["Бицепс"],
    secondaryMuscles: ["Предплечья"],
    primaryAreas: ["biceps"],
    secondaryAreas: ["forearms"]
  },
  triceps: {
    bodyZone: "triceps",
    view: "back",
    title: "Трицепс",
    description: "Основная нагрузка — задняя часть рук.",
    primaryMuscles: ["Трицепс"],
    secondaryMuscles: ["Плечи"],
    primaryAreas: ["triceps"],
    secondaryAreas: ["rearDelts"]
  },
  core: {
    bodyZone: "core",
    view: "front",
    title: "Пресс",
    description: "Основная нагрузка — мышцы корпуса.",
    primaryMuscles: ["Прямая мышца живота"],
    secondaryMuscles: ["Косые мышцы"],
    primaryAreas: ["abs"],
    secondaryAreas: ["obliques"]
  },
  mobility: {
    bodyZone: "fullBody",
    view: "front",
    title: "Мобильность",
    description: "Мягкое движение для разминки, заминки или восстановления.",
    primaryMuscles: ["Подвижность и восстановление"],
    secondaryMuscles: [],
    primaryAreas: ["abs", "quads", "frontDelts"],
    secondaryAreas: []
  },
  cardio: {
    bodyZone: "fullBody",
    view: "front",
    title: "Кардио",
    description: "Ровная аэробная нагрузка в комфортном темпе.",
    primaryMuscles: ["Всё тело"],
    secondaryMuscles: ["Сердечно-сосудистая система"],
    primaryAreas: ["quads", "calves"],
    secondaryAreas: ["abs"]
  }
};

const FALLBACK_MUSCLE_PRESENTATION = {
  bodyZone: "fullBody",
  view: "front",
  title: "Всё тело",
  description: "Работают основные мышцы тела.",
  primaryMuscles: ["Основные мышцы"],
  secondaryMuscles: [],
  primaryAreas: ["chest", "abs", "quads"],
  secondaryAreas: ["frontDelts", "biceps"]
};

function getEquipmentType(equipment = "") {
  const normalized = String(equipment || "").toLocaleLowerCase("ru");

  if (!normalized || normalized.includes("собствен")) return "bodyweight";
  if (normalized.includes("кроссовер")) return "cable";
  if (normalized.includes("штанг") || normalized.includes("гриф") || normalized.includes("смит")) return "barbell";
  if (normalized.includes("скамь")) return "bench";
  if (normalized.includes("гантел")) return "dumbbells";
  if (normalized.includes("переклад")) return "bar";
  if (normalized.includes("платформ")) return "platform";
  if (normalized.includes("римск")) return "backExtension";
  return "machine";
}

export function getBasicWorkoutExercisePresentation(exercise = {}) {
  const group = getBasicWorkoutExerciseGroup(exercise);
  const libraryExercise = getBasicWorkoutLibraryExercise(exercise);
  const musclePresentation = MUSCLE_PRESENTATIONS[group?.id] || FALLBACK_MUSCLE_PRESENTATION;
  const equipment = String(exercise?.equipment || libraryExercise?.equipment || "Собственный вес").trim() || "Собственный вес";

  return {
    ...musclePresentation,
    groupId: group?.id || "fullBody",
    equipment,
    equipmentType: getEquipmentType(equipment),
    imageUrl: getText(exercise?.basicExerciseImageUrl),
    videoUrl: getText(exercise?.basicExerciseVideoUrl)
  };
}
