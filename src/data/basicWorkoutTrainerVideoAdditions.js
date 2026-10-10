// Approved trainer variants, now available to automatic basic plans as requested.
const variants = [
  { id: "weighted_back_extension", name: "Гиперэкстензия с диском", groupId: "posterior_chain", sourceId: "Hyperextensions_Back_Extensions", equipment: "Римский стул и диск" },
  { id: "wide_chest_supported_tbar_row", name: "Тяга Т-грифа с упором грудью широким хватом", groupId: "horizontal_pull", sourceId: "Lying_T-Bar_Row", equipment: "Тренажёр Т-гриф" },
  { id: "one_arm_chest_supported_machine_row", name: "Тяга рычажного тренажёра одной рукой с упором грудью", groupId: "vertical_pull", sourceId: "Leverage_High_Row", equipment: "Рычажный тренажёр" },
  { id: "low_cable_fly", name: "Сведение рук в кроссовере снизу вверх", groupId: "chest_fly", sourceId: "Low_Cable_Crossover", equipment: "Кроссовер" },
  { id: "chest_dip", name: "Отжимания на брусьях", groupId: "chest_press", sourceId: "Dips_-_Chest_Version", equipment: "Брусья", requiresWeight: false },
  { id: "smith_incline_pushup", name: "Отжимания от грифа в тренажёре Смита", groupId: "chest_press", sourceId: "Incline_Push-Up", equipment: "Машина Смита", requiresWeight: false },
  { id: "supinated_lat_pulldown", name: "Тяга верхнего блока обратным хватом", groupId: "vertical_pull", sourceId: "Underhand_Cable_Pulldowns", equipment: "Блочный тренажёр" },
  { id: "wide_seated_cable_row", name: "Тяга нижнего блока широким хватом", groupId: "horizontal_pull", sourceId: "Seated_Cable_Rows", equipment: "Блочный тренажёр" },
  { id: "decline_machine_press", name: "Жим хаммера на низ груди", groupId: "chest_press", sourceId: "Leverage_Decline_Chest_Press", equipment: "Рычажный тренажёр" },
  { id: "smith_lunge", name: "Выпады в тренажёре Смита", groupId: "quads", sourceId: "Smith_Single-Leg_Split_Squat", equipment: "Машина Смита" },
  { id: "one_arm_seated_cable_row", name: "Тяга нижнего блока по одной руке", groupId: "horizontal_pull", sourceId: "Seated_One-arm_Cable_Pulley_Rows", equipment: "Блочный тренажёр" },
  { id: "hip_abduction_machine", name: "Разведение ног в тренажёре", groupId: "hip_abduction", sourceId: "Thigh_Abductor", equipment: "Тренажёр" },
  { id: "hip_adduction_machine", name: "Сведение ног в тренажёре", groupId: "hip_adduction", sourceId: "Thigh_Adductor", equipment: "Тренажёр" },
  { id: "machine_hip_thrust", name: "Ягодичный мост в тренажёре", groupId: "posterior_chain", sourceId: "Barbell_Hip_Thrust", equipment: "Тренажёр для ягодичного моста" },
  { id: "incline_barbell_press", name: "Жим лёжа на наклонной скамье со штангой", groupId: "chest_incline", sourceId: "Barbell_Incline_Bench_Press_-_Medium_Grip", equipment: "Наклонная скамья и штанга" },
  { id: "one_arm_machine_row", name: "Тяга хаммера по одной руке", groupId: "horizontal_pull", sourceId: "Leverage_Iso_Row", equipment: "Рычажный тренажёр" },
  // Keep the legacy generic name bound to reverse_lunge in old name-only plans.
  { id: "db_lunge", name: "Выпады с гантелями — вариант тренера", groupId: "quads", sourceId: "Dumbbell_Lunges", equipment: "Гантели", locations: ["gym", "home"] },
  { id: "leaning_hip_abduction_machine", name: "Разведение ног в тренажёре с наклоном корпуса вперёд", groupId: "hip_abduction", sourceId: "Thigh_Abductor", equipment: "Тренажёр" }
];

export const BASIC_WORKOUT_TRAINER_VIDEO_GROUPS = [
  { id: "hip_abduction", title: "Ягодицы · отведение бедра", shortTitle: "Ягодицы" },
  { id: "hip_adduction", title: "Ноги · приведение бедра", shortTitle: "Внутренняя поверхность бедра" }
];

export const BASIC_WORKOUT_TRAINER_VIDEO_ADDITIONS = variants.map(variant => ({
  sectionId: "strength", aliases: [], locations: ["gym"], rest: "75 сек",
  requiresWeight: true, note: "", ...variant, planEligible: true
}));
