// Curated, reviewed exercise names and movement groups for basic workouts.
// Cues are original app copy; the wider 873-entry reference catalogue is lazy.
import {
  BASIC_WORKOUT_COMPACT_EXTRA_GROUPS,
  BASIC_WORKOUT_COMPACT_LIBRARY_ADDITIONS,
  BASIC_WORKOUT_LIBRARY_SECTIONS
} from "./basicWorkoutCompactLibraryAdditions.js";
import {
  loadBasicWorkoutFullExerciseCatalogue,
  searchBasicWorkoutFullExerciseCatalogue
} from "./basicWorkoutFullExerciseCatalogue.js";

export {
  loadBasicWorkoutFullExerciseCatalogue,
  searchBasicWorkoutFullExerciseCatalogue,
  BASIC_WORKOUT_LIBRARY_SECTIONS
};

export const BASIC_WORKOUT_EXERCISE_GROUPS = [
  { id: "quads", title: "Ноги · передняя поверхность", shortTitle: "Ноги" },
  { id: "posterior_chain", title: "Ноги · задняя поверхность и ягодицы", shortTitle: "Ноги и ягодицы" },
  { id: "calves", title: "Ноги · икры", shortTitle: "Икры" },
  { id: "vertical_pull", title: "Спина · вертикальная тяга", shortTitle: "Спина" },
  { id: "horizontal_pull", title: "Спина · горизонтальная тяга", shortTitle: "Спина" },
  { id: "chest_press", title: "Грудь · горизонтальный жим", shortTitle: "Грудь" },
  { id: "chest_incline", title: "Грудь · жим под наклоном", shortTitle: "Грудь" },
  { id: "chest_fly", title: "Грудь · сведения", shortTitle: "Грудь" },
  { id: "shoulder_press", title: "Плечи · вертикальный жим", shortTitle: "Плечи" },
  { id: "side_delts", title: "Плечи · средняя дельта", shortTitle: "Плечи" },
  { id: "rear_delts", title: "Плечи · задняя дельта", shortTitle: "Плечи" },
  { id: "biceps", title: "Руки · бицепс", shortTitle: "Бицепс" },
  { id: "triceps", title: "Руки · трицепс", shortTitle: "Трицепс" },
  { id: "forearms", title: "Руки · предплечья и хват", shortTitle: "Предплечья" },
  { id: "core", title: "Кор · стабилизация и пресс", shortTitle: "Пресс" },
  ...BASIC_WORKOUT_COMPACT_EXTRA_GROUPS
];

const BASIC_WORKOUT_PLAN_EXERCISE_LIBRARY = [
  { id: "leg_press", name: "Жим ногами", groupId: "quads", aliases: ["жим ногами в тренажёре"], equipment: "Тренажёр", locations: ["gym"], rest: "90 сек", requiresWeight: true, note: "Плотно прижмите спину к опоре и ведите колени по линии стоп." },
  { id: "smith_squat", name: "Приседания в Смите", groupId: "quads", aliases: ["присед в смите"], equipment: "Машина Смита", locations: ["gym"], rest: "90 сек", requiresWeight: true, note: "Сохраняйте опору на всю стопу и контролируйте глубину без боли." },
  { id: "goblet_squat", name: "Гоблет-присед с гантелью", groupId: "quads", aliases: ["гоблет присед"], equipment: "Гантель", locations: ["gym", "home"], rest: "75 сек", requiresWeight: true, note: "Держите гантель у груди, а колени направляйте по линии стоп." },
  { id: "reverse_lunge", name: "Выпады назад с гантелями", groupId: "quads", aliases: ["обратные выпады", "выпады с гантелями", "выпады"], equipment: "Гантели", locations: ["gym", "home"], rest: "75 сек", requiresWeight: true, note: "Сделайте контролируемый шаг назад и держите корпус устойчиво." },
  { id: "bulgarian_split_squat", name: "Болгарские выпады", groupId: "quads", aliases: ["болгарский сплит-присед"], equipment: "Скамья и гантели", locations: ["gym", "home"], rest: "90 сек", requiresWeight: true, note: "Начните с небольшой амплитуды и удерживайте баланс у опоры." },
  { id: "step_up", name: "Зашагивания на платформу", groupId: "quads", aliases: ["зашагивания"], equipment: "Платформа", locations: ["gym", "home"], rest: "75 сек", requiresWeight: false, note: "Отталкивайтесь пяткой рабочей ноги и не спешите внизу." },
  { id: "leg_extension", name: "Разгибание ног в тренажёре", groupId: "quads", aliases: ["разгибание ног"], equipment: "Тренажёр", locations: ["gym"], rest: "60 сек", requiresWeight: true, note: "Поднимайте вес плавно, не выпрямляя колени с рывком." },

  { id: "glute_bridge", name: "Ягодичный мост", groupId: "posterior_chain", aliases: ["мостик", "ягодичный мостик"], equipment: "Собственный вес", locations: ["gym", "home"], rest: "60 сек", requiresWeight: false, note: "Поднимайте таз до ровной линии корпуса и контролируйте движение." },
  { id: "leg_curl", name: "Сгибание ног лёжа в тренажёре", groupId: "posterior_chain", aliases: ["сгибание ног лёжа", "сгибание ног"], equipment: "Тренажёр", locations: ["gym"], rest: "75 сек", requiresWeight: true, note: "Не отрывайте таз от опоры и опускайте вес медленно." },
  { id: "back_extension", name: "Гиперэкстензия", groupId: "posterior_chain", aliases: ["разгибание спины"], equipment: "Римский стул", locations: ["gym", "home"], rest: "60 сек", requiresWeight: false, note: "Поднимайтесь до прямой линии корпуса без переразгибания поясницы." },
  { id: "db_rdl", name: "Наклоны с гантелями", groupId: "posterior_chain", aliases: ["румынская тяга с гантелями"], equipment: "Гантели", locations: ["gym", "home"], rest: "90 сек", requiresWeight: true, note: "Отводите таз назад и не округляйте поясницу." },
  { id: "hip_thrust", name: "Ягодичный мост со штангой", groupId: "posterior_chain", aliases: ["хип-траст", "хип траст"], equipment: "Штанга и скамья", locations: ["gym"], rest: "90 сек", requiresWeight: true, note: "В верхней точке напрягите ягодицы, не переразгибая поясницу." },
  { id: "romanian_deadlift", name: "Румынская тяга со штангой", groupId: "posterior_chain", aliases: ["румынская тяга"], equipment: "Штанга", locations: ["gym"], rest: "105 сек", requiresWeight: true, note: "Отводите таз назад и удерживайте нейтральное положение спины." },
  { id: "deadlift", name: "Становая тяга", groupId: "posterior_chain", aliases: ["становая тяга со штангой", "классическая становая тяга"], equipment: "Штанга", locations: ["gym"], rest: "120 сек", requiresWeight: true, note: "Поднимайте штангу ногами и тазом, сохраняя нейтральное положение спины." },

  { id: "standing_calf_raise", name: "Подъёмы на носки стоя", groupId: "calves", aliases: ["подъём на носки стоя", "подъёмы на носки"], equipment: "Тренажёр или ступень", locations: ["gym", "home"], rest: "45 сек", requiresWeight: false, note: "Сделайте паузу вверху и опускайте пятки под контролем." },
  { id: "seated_calf_raise", name: "Подъёмы на носки сидя", groupId: "calves", aliases: ["подъём на носки сидя"], equipment: "Тренажёр", locations: ["gym"], rest: "45 сек", requiresWeight: true, note: "Работайте в полной комфортной амплитуде без рывка." },
  { id: "leg_press_calf_raise", name: "Подъёмы на носки в жиме ногами", groupId: "calves", aliases: ["икры в жиме ногами"], equipment: "Тренажёр", locations: ["gym"], rest: "45 сек", requiresWeight: true, note: "Двигайте только стопой и не блокируйте колени." },
  { id: "single_leg_calf_raise", name: "Подъёмы на носки на одной ноге", groupId: "calves", aliases: ["икры на одной ноге"], equipment: "Ступень", locations: ["gym", "home"], rest: "45 сек", requiresWeight: false, note: "Держитесь за опору и сохраняйте ровный темп." },

  { id: "lat_pulldown", name: "Тяга верхнего блока", groupId: "vertical_pull", aliases: ["верхняя тяга", "тяга верхнего блока широким хватом"], equipment: "Блочный тренажёр", locations: ["gym"], rest: "75 сек", requiresWeight: true, note: "Тяните рукоять к верхней части груди и не поднимайте плечи." },
  { id: "neutral_lat_pulldown", name: "Тяга верхнего блока нейтральным хватом", groupId: "vertical_pull", aliases: ["тяга верхнего блока узким хватом"], equipment: "Блочный тренажёр", locations: ["gym"], rest: "75 сек", requiresWeight: true, note: "Ведите локти вниз и сохраняйте устойчивый корпус." },
  { id: "pull_up", name: "Подтягивания", groupId: "vertical_pull", aliases: ["подтягивания на перекладине", "подтягивания широким хватом", "подтягивания узким хватом"], equipment: "Перекладина", locations: ["gym", "home"], rest: "90 сек", requiresWeight: false, note: "Начинайте движение лопатками и тяните локти вниз без раскачивания корпуса." },
  { id: "assisted_pullup", name: "Подтягивания в гравитроне", groupId: "vertical_pull", aliases: ["подтягивания с противовесом"], equipment: "Гравитрон", locations: ["gym"], rest: "90 сек", requiresWeight: true, note: "Начинайте движение лопатками и тяните локти вниз." },
  { id: "hammer_high_row", name: "Тяга сверху в тренажёре", groupId: "vertical_pull", aliases: ["тяга верхнего блока хаммер", "верхняя тяга хаммер"], equipment: "Тренажёр", locations: ["gym"], rest: "75 сек", requiresWeight: true, note: "Не раскачивайте корпус и тяните рукояти к рёбрам." },
  { id: "straight_arm_pulldown", name: "Тяга прямыми руками в кроссовере", groupId: "vertical_pull", aliases: ["пуловер в кроссовере"], equipment: "Кроссовер", locations: ["gym"], rest: "60 сек", requiresWeight: true, note: "Оставьте мягкий сгиб локтей и опускайте рукоять к бёдрам." },

  { id: "seated_cable_row", name: "Горизонтальная тяга блока", groupId: "horizontal_pull", aliases: ["тяга нижнего блока", "горизонтальная тяга", "тяга горизонтального блока", "тяга нижнего блока сидя"], equipment: "Блочный тренажёр", locations: ["gym"], rest: "75 сек", requiresWeight: true, note: "Сначала сведите лопатки, затем ведите рукоять к животу." },
  { id: "one_arm_db_row", name: "Тяга гантели с опорой", groupId: "horizontal_pull", aliases: ["тяга гантели к поясу", "тяга гантели в наклоне", "тяга гантели в упоре", "тяга гантели к поясу с опорой"], equipment: "Гантель", locations: ["gym", "home"], rest: "75 сек", requiresWeight: true, note: "Зафиксируйте корпус у опоры и тяните локоть к тазу." },
  { id: "chest_supported_row", name: "Тяга с опорой грудью", groupId: "horizontal_pull", aliases: ["тяга гантелей с опорой грудью", "тяга гантелей лёжа на наклонной скамье"], equipment: "Наклонная скамья и гантели", locations: ["gym"], rest: "75 сек", requiresWeight: true, note: "Не поднимайте плечи и не раскачивайте корпус." },
  { id: "t_bar_row", name: "Тяга в тренажёре с упором грудью", groupId: "horizontal_pull", aliases: ["т-тяга", "тяга т грифа"], equipment: "Тренажёр", locations: ["gym"], rest: "75 сек", requiresWeight: true, note: "Держите грудь у опоры и плавно ведите локти назад." },
  { id: "barbell_row", name: "Тяга штанги в наклоне", groupId: "horizontal_pull", aliases: ["тяга в наклоне"], equipment: "Штанга", locations: ["gym"], rest: "90 сек", requiresWeight: true, note: "Сохраняйте наклон корпуса стабильным и не дёргайте вес." },
  { id: "machine_row", name: "Тяга в рычажном тренажёре", groupId: "horizontal_pull", aliases: ["тяга в тренажёре"], equipment: "Рычажный тренажёр", locations: ["gym"], rest: "75 сек", requiresWeight: true, note: "Сводите лопатки без рывка и контролируйте возврат рукоятей." },

  { id: "machine_chest_press", name: "Жим от груди в тренажёре", groupId: "chest_press", aliases: ["жим в тренажёре", "грудной жим в тренажёре"], equipment: "Тренажёр", locations: ["gym"], rest: "75 сек", requiresWeight: true, note: "Настройте сиденье так, чтобы рукояти были на уровне середины груди." },
  { id: "db_bench_press", name: "Жим гантелей лёжа", groupId: "chest_press", aliases: ["жим лежа с гантелями"], equipment: "Скамья и гантели", locations: ["gym", "home"], rest: "90 сек", requiresWeight: true, note: "Контролируйте опускание гантелей и не теряйте положение лопаток." },
  { id: "incline_pushup", name: "Отжимания от высокой опоры", groupId: "chest_press", aliases: ["отжимания от скамьи"], equipment: "Скамья или стол", locations: ["gym", "home"], rest: "60 сек", requiresWeight: false, note: "Держите корпус прямой линией и опускайтесь в комфортной амплитуде." },
  { id: "pushup", name: "Отжимания от пола", groupId: "chest_press", aliases: ["классические отжимания", "отжимания", "отжимания на полу"], equipment: "Собственный вес", locations: ["gym", "home"], rest: "60 сек", requiresWeight: false, note: "Не проваливайтесь в пояснице и сохраняйте контроль на всём движении." },
  { id: "smith_bench_press", name: "Жим лёжа в Смите", groupId: "chest_press", aliases: ["жим в смите лёжа"], equipment: "Машина Смита", locations: ["gym"], rest: "90 сек", requiresWeight: true, note: "Сохраните устойчивую опору стоп и плавно ведите гриф." },
  { id: "barbell_bench_press", name: "Жим штанги лёжа", groupId: "chest_press", aliases: ["жим лёжа", "жим лежа", "жим лёжа со штангой", "жим штанги от груди лёжа"], equipment: "Скамья и штанга", locations: ["gym"], rest: "105 сек", requiresWeight: true, note: "Сведите лопатки, поставьте стопы устойчиво и опускайте гриф под контролем." },

  { id: "incline_db_press", name: "Жим гантелей на наклонной скамье", groupId: "chest_incline", aliases: ["наклонный жим гантелей"], equipment: "Наклонная скамья и гантели", locations: ["gym"], rest: "90 сек", requiresWeight: true, note: "Выберите умеренный наклон и контролируйте положение лопаток." },
  { id: "incline_smith_press", name: "Жим в Смите на наклонной скамье", groupId: "chest_incline", aliases: ["жим в смите наклон"], equipment: "Машина Смита", locations: ["gym"], rest: "90 сек", requiresWeight: true, note: "Опускайте гриф плавно к верхней части груди." },
  { id: "incline_machine_press", name: "Наклонный жим в тренажёре", groupId: "chest_incline", aliases: ["жим под углом в тренажёре"], equipment: "Тренажёр", locations: ["gym"], rest: "75 сек", requiresWeight: true, note: "Настройте спинку и не выводите плечи вперёд." },
  { id: "low_incline_pushup", name: "Отжимания с ногами на опоре", groupId: "chest_incline", aliases: ["наклонные отжимания"], equipment: "Скамья", locations: ["gym", "home"], rest: "60 сек", requiresWeight: false, note: "Сначала убедитесь, что плечам комфортно в выбранной высоте." },

  { id: "cable_fly", name: "Сведение рук в кроссовере", groupId: "chest_fly", aliases: ["сведения в кроссовере"], equipment: "Кроссовер", locations: ["gym"], rest: "60 сек", requiresWeight: true, note: "Сводите руки по дуге без рывка и не поднимайте плечи." },
  { id: "pec_deck", name: "Сведение рук в тренажёре", groupId: "chest_fly", aliases: ["бабочка", "пек-дек"], equipment: "Тренажёр", locations: ["gym"], rest: "60 сек", requiresWeight: true, note: "Держите грудь у опоры и возвращайте рукояти медленно." },
  { id: "db_fly", name: "Разведение гантелей лёжа", groupId: "chest_fly", aliases: ["сведение гантелей", "разводка гантелей"], equipment: "Скамья и гантели", locations: ["gym", "home"], rest: "60 сек", requiresWeight: true, note: "Сохраняйте лёгкий сгиб локтей и небольшую комфортную амплитуду." },
  { id: "incline_db_fly", name: "Разведение гантелей на наклонной скамье", groupId: "chest_fly", aliases: ["сведение гантелей наклон"], equipment: "Наклонная скамья и гантели", locations: ["gym"], rest: "60 сек", requiresWeight: true, note: "Не опускайте локти слишком глубоко и ведите вес плавно." },

  { id: "seated_db_press", name: "Жим гантелей сидя", groupId: "shoulder_press", aliases: ["вертикальный жим с гантелями", "жим гантелей над головой"], equipment: "Скамья и гантели", locations: ["gym", "home"], rest: "90 сек", requiresWeight: true, note: "Опирайтесь на спинку и не переразгибайте поясницу." },
  { id: "shoulder_press_machine", name: "Вертикальный жим в тренажёре", groupId: "shoulder_press", aliases: ["жим от плеч в тренажёре"], equipment: "Тренажёр", locations: ["gym"], rest: "75 сек", requiresWeight: true, note: "Настройте сиденье так, чтобы рукояти стартовали чуть ниже уровня ушей." },
  { id: "smith_shoulder_press", name: "Жим над головой в Смите", groupId: "shoulder_press", aliases: ["вертикальный жим в смите"], equipment: "Машина Смита", locations: ["gym"], rest: "90 сек", requiresWeight: true, note: "Ведите гриф плавно и держите рёбра под контролем." },
  { id: "standing_db_press", name: "Жим гантелей стоя", groupId: "shoulder_press", aliases: ["жим гантели одной рукой стоя"], equipment: "Гантели", locations: ["gym", "home"], rest: "75 сек", requiresWeight: true, note: "Работайте с лёгким весом и не прогибайтесь в пояснице." },

  { id: "db_lateral_raise", name: "Отведение рук с гантелями в стороны", groupId: "side_delts", aliases: ["подъём гантелей в стороны", "отведение рук с гантелями"], equipment: "Гантели", locations: ["gym", "home"], rest: "60 сек", requiresWeight: true, note: "Поднимайте руки до уровня плеч без раскачивания корпуса." },
  { id: "cable_lateral_raise", name: "Отведение руки в сторону в кроссовере", groupId: "side_delts", aliases: ["отведение руки в кроссовере"], equipment: "Кроссовер", locations: ["gym"], rest: "60 сек", requiresWeight: true, note: "Двигайтесь от плеча и не помогайте себе наклоном корпуса." },
  { id: "lateral_raise_machine", name: "Отведение рук в тренажёре", groupId: "side_delts", aliases: ["тренажёр на среднюю дельту"], equipment: "Тренажёр", locations: ["gym"], rest: "60 сек", requiresWeight: true, note: "Не поднимайте плечи и сохраняйте ровный темп." },
  { id: "supported_lateral_raise", name: "Отведение руки с опорой", groupId: "side_delts", aliases: ["отведение рук с опорой", "отведение рук с гантелями с опорой"], equipment: "Гантель и скамья", locations: ["gym", "home"], rest: "60 сек", requiresWeight: true, note: "Используйте лёгкий вес и контролируйте движение без рывка." },

  { id: "rear_delt_machine", name: "Разведение рук в тренажёре на заднюю дельту", groupId: "rear_delts", aliases: ["задняя дельта в тренажёре", "обратная бабочка"], equipment: "Тренажёр", locations: ["gym"], rest: "60 сек", requiresWeight: true, note: "Не тяните трапецией: ведите локти назад и в стороны." },
  { id: "rear_delt_cable_fly", name: "Разведение рук в кроссовере на заднюю дельту", groupId: "rear_delts", aliases: ["задняя дельта в кроссовере"], equipment: "Кроссовер", locations: ["gym"], rest: "60 сек", requiresWeight: true, note: "Держите плечи опущенными и разводите руки плавно." },
  { id: "rear_delt_db_fly", name: "Разведение гантелей в наклоне", groupId: "rear_delts", aliases: ["разведение рук в наклоне"], equipment: "Гантели", locations: ["gym", "home"], rest: "60 сек", requiresWeight: true, note: "Сохраните лёгкий сгиб локтей и не раскачивайте корпус." },
  { id: "face_pull", name: "Тяга каната к лицу", groupId: "rear_delts", aliases: ["фейс-пул", "face pull"], equipment: "Кроссовер", locations: ["gym"], rest: "60 сек", requiresWeight: true, note: "Ведите канат к уровню лица, разводя концы в стороны." },

  { id: "db_curl", name: "Сгибание рук с гантелями", groupId: "biceps", aliases: ["сгибание рук с гантелями стоя"], equipment: "Гантели", locations: ["gym", "home"], rest: "60 сек", requiresWeight: true, note: "Держите локти рядом с корпусом и не раскачивайтесь." },
  { id: "hammer_curl", name: "Молотковые сгибания с гантелями", groupId: "biceps", aliases: ["молотки"], equipment: "Гантели", locations: ["gym", "home"], rest: "60 сек", requiresWeight: true, note: "Сохраняйте нейтральный хват и контролируйте опускание." },
  { id: "cable_curl", name: "Сгибание рук в кроссовере", groupId: "biceps", aliases: ["сгибание рук на блоке"], equipment: "Кроссовер", locations: ["gym"], rest: "60 сек", requiresWeight: true, note: "Не выводите локти вперёд и не помогайте корпусом." },
  { id: "barbell_curl", name: "Сгибание рук со штангой", groupId: "biceps", aliases: ["сгибание рук с ez-грифом", "подъём штанги на бицепс"], equipment: "Штанга", locations: ["gym"], rest: "75 сек", requiresWeight: true, note: "Выберите вес, при котором корпус остаётся неподвижным." },
  { id: "preacher_curl", name: "Сгибание рук на скамье Скотта", groupId: "biceps", aliases: ["скамья скотта"], equipment: "Скамья Скотта", locations: ["gym"], rest: "60 сек", requiresWeight: true, note: "Не выпрямляйте локти до жёсткой блокировки." },

  { id: "rope_pushdown", name: "Разгибание рук с канатом", groupId: "triceps", aliases: ["разгибание рук в кроссовере", "разгибание рук с канатом"], equipment: "Кроссовер", locations: ["gym"], rest: "60 сек", requiresWeight: true, note: "Держите локти у корпуса и не наклоняйтесь за весом." },
  { id: "bar_pushdown", name: "Разгибание рук с прямой рукоятью", groupId: "triceps", aliases: ["разгибание рук на блоке"], equipment: "Кроссовер", locations: ["gym"], rest: "60 сек", requiresWeight: true, note: "Фиксируйте плечи и выпрямляйте руки плавно." },
  { id: "overhead_db_extension", name: "Разгибание гантели из-за головы", groupId: "triceps", aliases: ["французское разгибание с гантелью"], equipment: "Гантель", locations: ["gym", "home"], rest: "60 сек", requiresWeight: true, note: "Не разводите локти широко и контролируйте амплитуду." },
  { id: "overhead_cable_extension", name: "Разгибание рук из-за головы в кроссовере", groupId: "triceps", aliases: ["верхний блок на трицепс"], equipment: "Кроссовер", locations: ["gym"], rest: "60 сек", requiresWeight: true, note: "Встаньте устойчиво и держите локти направленными вперёд." },
  { id: "bench_dip", name: "Обратные отжимания от скамьи", groupId: "triceps", aliases: ["отжимания от скамьи на трицепс"], equipment: "Скамья", locations: ["gym", "home"], rest: "60 сек", requiresWeight: false, note: "Работайте только в комфортной для плеч глубине." },

  { id: "db_wrist_curl", illustrationId: "db_curl", name: "Сгибание кистей с гантелями", groupId: "forearms", aliases: ["сгибания кистей", "wrist curl"], equipment: "Гантели", locations: ["gym", "home"], rest: "45 сек", requiresWeight: true, note: "Опирайте предплечья и двигайте только кистями без рывка." },
  { id: "db_reverse_wrist_curl", illustrationId: "db_curl", name: "Разгибание кистей с гантелями", groupId: "forearms", aliases: ["разгибания кистей", "reverse wrist curl"], equipment: "Гантели", locations: ["gym", "home"], rest: "45 сек", requiresWeight: true, note: "Используйте лёгкий вес и удерживайте предплечья неподвижно." },
  { id: "farmer_carry", illustrationId: "hammer_curl", name: "Прогулка фермера с гантелями", groupId: "forearms", aliases: ["фермерская прогулка", "farmer carry"], equipment: "Гантели", locations: ["gym", "home"], rest: "60 сек", requiresWeight: true, note: "Держите корпус ровно, плечи опущенными и идите спокойным шагом." },

  { id: "cable_crunch", name: "Скручивания в кроссовере", groupId: "core", aliases: ["скручивания на блоке"], equipment: "Кроссовер", locations: ["gym"], rest: "45 сек", requiresWeight: true, note: "Скручивайте корпус, а не тяните рукоять руками." },
  { id: "floor_crunch", name: "Скручивания лёжа", groupId: "core", aliases: ["пресс", "обычные скручивания"], equipment: "Собственный вес", locations: ["gym", "home"], rest: "45 сек", requiresWeight: false, note: "Не тяните шею руками и выдыхайте в верхней точке." },
  { id: "reverse_crunch", name: "Обратные скручивания", groupId: "core", aliases: ["скручивания с подъёмом таза"], equipment: "Собственный вес", locations: ["gym", "home"], rest: "45 сек", requiresWeight: false, note: "Подкручивайте таз плавно, не раскачиваясь ногами." },
  { id: "dead_bug", name: "Упражнение «мёртвый жук»", groupId: "core", aliases: ["dead bug", "дед баг"], equipment: "Собственный вес", locations: ["gym", "home"], rest: "45 сек", requiresWeight: false, note: "Прижимайте поясницу к полу и двигайте противоположные руку и ногу медленно." },
  { id: "plank", name: "Планка", groupId: "core", aliases: ["фронтальная планка"], equipment: "Собственный вес", locations: ["gym", "home"], rest: "45 сек", durationSeconds: 30, requiresWeight: false, note: "Держите корпус ровной линией и дышите спокойно." },
  { id: "hanging_knee_raise", name: "Подъём коленей в висе", groupId: "core", aliases: ["подъём ног в висе"], equipment: "Перекладина", locations: ["gym", "home"], rest: "60 сек", requiresWeight: false, note: "Не раскачивайтесь: начинайте подъём с подкручивания таза." }
];

export const BASIC_WORKOUT_PLAN_LIBRARY_COUNT = BASIC_WORKOUT_PLAN_EXERCISE_LIBRARY.length;

export const BASIC_WORKOUT_EXERCISE_LIBRARY = [
  ...BASIC_WORKOUT_PLAN_EXERCISE_LIBRARY.map((exercise) => ({
    ...exercise,
    sectionId: "strength",
    planEligible: true
  })),
  ...BASIC_WORKOUT_COMPACT_LIBRARY_ADDITIONS
];

export const BASIC_WORKOUT_COMPACT_LIBRARY_COUNT = BASIC_WORKOUT_EXERCISE_LIBRARY.length;

export const BASIC_WORKOUT_LIBRARY_SOURCE = {
  name: "Внутренняя проверенная база базовых планов",
  url: "",
  accessedAt: "2026-08-06",
  note: "В библиотеке 99 понятных упражнений: 75 силовых для готовых и ИИ-планов, 16 для мобильности и 8 для кардио. ИИ использует отдельный проверенный поднабор силовых упражнений. Полный справочник из 873 упражнений хранится скрытым резервом и не попадает в базовые планы."
};
