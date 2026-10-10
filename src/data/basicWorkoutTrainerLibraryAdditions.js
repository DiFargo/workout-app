// Public exercise metadata only. No trainer identity, programme loads or client data.
// Distinct movements from the approved personal library; existing movements keep their IDs.
const SOURCES = { db_box_squat: "Dumbbell_Squat_To_A_Bench", trainer_db_squat: "Dumbbell_Squat",
  db_front_raise: "Front_Dumbbell_Raise", machine_preacher_curl: "Machine_Preacher_Curls",
  machine_triceps_extension: "Machine_Triceps_Extension", french_press: "EZ-Bar_Skullcrusher",
  bicycle_crunch: "Cross-Body_Crunch", v_up: "Jackknife_Sit-Up", mountain_climber: "Mountain_Climbers" };
export const BASIC_WORKOUT_TRAINER_LIBRARY_ADDITIONS = [
  { id: "single_leg_press", name: "Жим одной ногой", groupId: "quads", equipment: "Тренажёр", locations: ["gym"] },
  { id: "db_box_squat", name: "Присед с гантелью на скамью", groupId: "quads", equipment: "Гантели и скамья", locations: ["gym", "home"] },
  { id: "trainer_db_squat", name: "Приседания с гантелью", groupId: "quads", equipment: "Гантель", locations: ["gym", "home"] },
  { id: "seated_rear_delt_db_fly", name: "Отведение рук с гантелями сидя в наклоне", groupId: "rear_delts", equipment: "Гантели и скамья", locations: ["gym", "home"] },
  { id: "db_front_raise", name: "Подъём гантелей вперёд", groupId: "shoulder_front", equipment: "Гантели", locations: ["gym", "home"] },
  { id: "incline_cable_curl", name: "Сгибание рук в кроссовере на наклонной скамье", groupId: "biceps", equipment: "Кроссовер и наклонная скамья", locations: ["gym"] },
  { id: "machine_preacher_curl", name: "Сгибание рук в тренажёре Скотта", groupId: "biceps", equipment: "Тренажёр Скотта", locations: ["gym"] },
  { id: "machine_triceps_extension", name: "Разгибание рук в тренажёре", groupId: "triceps", equipment: "Тренажёр", locations: ["gym"] },
  { id: "scott_triceps_extension", name: "Разгибание рук на скамье Скотта", groupId: "triceps", equipment: "Скамья Скотта", locations: ["gym"] },
  { id: "french_press", name: "Французский жим", groupId: "triceps", equipment: "Штанга и скамья", locations: ["gym"] },
  { id: "straight_leg_crunch", name: "Скручивания с поднятыми прямыми ногами", groupId: "core", equipment: "Коврик", locations: ["gym", "home"], requiresWeight: false },
  { id: "bicycle_crunch", name: "Пресс · велосипед", groupId: "core", equipment: "Коврик", locations: ["gym", "home"], requiresWeight: false },
  { id: "v_up", name: "Пресс · складка", groupId: "core", equipment: "Коврик", locations: ["gym", "home"], requiresWeight: false },
  { id: "mountain_climber", name: "Пресс · шаги альпиниста", groupId: "core", equipment: "Коврик", locations: ["gym", "home"], requiresWeight: false }
].map(exercise => ({ sectionId: "strength", aliases: [], planEligible: true, rest: "75 сек", requiresWeight: true,
  note: "Выполняйте движение плавно, в комфортной амплитуде. При боли остановитесь.", ...exercise,
  ...(SOURCES[exercise.id] ? { sourceId: SOURCES[exercise.id] } : { illustrationUnavailable: true }) }));

export const BASIC_WORKOUT_TRAINER_LIBRARY_GROUPS = [
  { id: "shoulder_front", title: "Плечи · передняя дельта", shortTitle: "Плечи" }
];

// Verified shared media. Used for deterministic video-first selection, including offline fallback.
// The actual URLs remain in basicExerciseOverrides and can be maintained independently of loads.
export const BASIC_WORKOUT_VIDEO_IDS = new Set([
  "seated_cable_row", "db_lunge", "smith_lunge", "neutral_lat_pulldown", "wide_seated_cable_row",
  "barbell_bench_press", "leg_press", "leg_curl", "hip_abduction_machine", "lat_pulldown",
  "machine_hip_thrust", "hammer_high_row", "decline_machine_press", "incline_db_press", "one_arm_machine_row",
  "incline_barbell_press", "leg_extension", "one_arm_db_row", "db_bench_press", "hip_adduction_machine",
  "db_fly", "machine_chest_press", "supinated_lat_pulldown", "machine_row", "smith_squat",
  "one_arm_seated_cable_row", "romanian_deadlift", "pec_deck", "incline_db_fly", "leaning_hip_abduction_machine",
  "weighted_back_extension", "wide_chest_supported_tbar_row", "t_bar_row", "one_arm_chest_supported_machine_row",
  "barbell_row", "low_cable_fly", "chest_dip", "smith_incline_pushup", "pushup",
  "seated_db_press", "db_lateral_raise", "rope_pushdown", "bicycle_crunch", "db_box_squat", "face_pull",
  "rear_delt_db_fly", "incline_cable_curl", "shoulder_press_machine", "db_front_raise",
  "machine_triceps_extension", "rear_delt_cable_fly", "machine_preacher_curl", "incline_smith_press"
]);
