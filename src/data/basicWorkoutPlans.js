export const BASIC_WORKOUT_PLANS = {
  beginner: {
    id: "basic_beginner_3days",
    name: "Базовый план · Старт",
    description: "Лёгкий вход в тренировки: техника, умеренный объём, 3 тренировки.",
    workouts: [
      {
        id: "basic_beginner_day1",
        name: "Базовая — День 1 · Всё тело",
        order: 1,
        sortOrder: 1,
        exercises: [
          { id: "bb1_leg_press", name: "Жим ногами", video: "/videos/1. Жим ногами.MOV", sets: [{ reps: 12, weight: "" }, { reps: 12, weight: "" }] },
          { id: "bb1_row", name: "Тяга верхнего блока", video: "/videos/Тяга верхнего блока.MOV", sets: [{ reps: 12, weight: "" }, { reps: 12, weight: "" }] },
          { id: "bb1_db_press", name: "Жим гантелей лёжа", video: "/videos/Жим лежа с гантелями.mp4", sets: [{ reps: 12, weight: "" }, { reps: 12, weight: "" }] },
          { id: "bb1_side_raise", name: "Отведение рук с гантелями", video: "/videos/Отведение рук в сторону с гантелями.MP4", sets: [{ reps: 15, weight: "" }, { reps: 15, weight: "" }] },
          { id: "bb1_abs", name: "Пресс", video: "/videos/Пресс (скручивания обычные).MOV", sets: [{ reps: 15, weight: "" }, { reps: 15, weight: "" }] }
        ]
      },
      {
        id: "basic_beginner_day2",
        name: "Базовая — День 2 · Верх",
        order: 2,
        sortOrder: 2,
        exercises: [
          { id: "bb2_bench", name: "Жим лёжа со штангой", video: "", sets: [{ reps: 10, weight: "" }, { reps: 10, weight: "" }] },
          { id: "bb2_db_row", name: "Тяга гантели к поясу", video: "", sets: [{ reps: 12, weight: "" }, { reps: 12, weight: "" }] },
          { id: "bb2_machine_press", name: "Вертикальный жим в тренажёре", video: "", sets: [{ reps: 12, weight: "" }, { reps: 12, weight: "" }] },
          { id: "bb2_curl", name: "Сгибание рук в кроссовере", video: "/videos/Сгибание рук с гантелями.MOV", sets: [{ reps: 12, weight: "" }, { reps: 12, weight: "" }] },
          { id: "bb2_abs", name: "Пресс", video: "/videos/Пресс (скручивания обычные).MOV", sets: [{ reps: 15, weight: "" }, { reps: 15, weight: "" }] }
        ]
      },
      {
        id: "basic_beginner_day3",
        name: "Базовая — День 3 · Ноги / спина",
        order: 3,
        sortOrder: 3,
        exercises: [
          { id: "bb3_extension", name: "Разгибание ног", video: "", sets: [{ reps: 15, weight: "" }, { reps: 15, weight: "" }] },
          { id: "bb3_rdl", name: "Румынская тяга", video: "", sets: [{ reps: 10, weight: "" }, { reps: 10, weight: "" }] },
          { id: "bb3_hammer", name: "Тяга верхнего блока (хаммер)", video: "/videos/Тяга верхнего блока.MOV", sets: [{ reps: 12, weight: "" }, { reps: 12, weight: "" }] },
          { id: "bb3_triceps", name: "Разгибание рук в кроссовере", video: "/videos/Разгибание рук в кроссовере.MOV", sets: [{ reps: 12, weight: "" }, { reps: 12, weight: "" }] },
          { id: "bb3_abs", name: "Пресс", video: "/videos/Пресс (скручивания обычные).MOV", sets: [{ reps: 15, weight: "" }, { reps: 15, weight: "" }] }
        ]
      }
    ]
  },
  muscle: {
    id: "basic_muscle_4days",
    name: "Базовый план · Масса",
    description: "4 тренировки: больше объёма, базовые движения и изоляция.",
    workouts: [
      {
        id: "basic_muscle_day1",
        name: "Базовая — День 1 · Спина / плечи",
        order: 1,
        sortOrder: 1,
        exercises: [
          { id: "bm1_leg_press", name: "Жим ногами", video: "/videos/1. Жим ногами.MOV", sets: [{ reps: 10, weight: "" }, { reps: 10, weight: "" }, { reps: 10, weight: "" }] },
          { id: "bm1_row", name: "Тяга в наклоне", video: "", sets: [{ reps: 10, weight: "" }, { reps: 10, weight: "" }, { reps: 10, weight: "" }] },
          { id: "bm1_tbar", name: "Тяга Т-грифа", video: "", sets: [{ reps: 10, weight: "" }, { reps: 10, weight: "" }, { reps: 10, weight: "" }] },
          { id: "bm1_press", name: "Вертикальный жим с гантелями", video: "", sets: [{ reps: 10, weight: "" }, { reps: 10, weight: "" }, { reps: 10, weight: "" }] },
          { id: "bm1_abs", name: "Пресс", video: "/videos/Пресс (скручивания обычные).MOV", sets: [{ reps: 15, weight: "" }, { reps: 15, weight: "" }, { reps: 15, weight: "" }] }
        ]
      },
      {
        id: "basic_muscle_day2",
        name: "Базовая — День 2 · Грудь / руки",
        order: 2,
        sortOrder: 2,
        exercises: [
          { id: "bm2_bench", name: "Жим лёжа со штангой", video: "", sets: [{ reps: 10, weight: "" }, { reps: 10, weight: "" }, { reps: 10, weight: "" }] },
          { id: "bm2_smith", name: "Жим в Смите (наклон)", video: "", sets: [{ reps: 10, weight: "" }, { reps: 10, weight: "" }, { reps: 10, weight: "" }] },
          { id: "bm2_raise", name: "Отведение рук с гантелями (с опорой)", video: "", sets: [{ reps: 12, weight: "" }, { reps: 12, weight: "" }, { reps: 12, weight: "" }] },
          { id: "bm2_curl", name: "Сгибание рук в кроссовере", video: "/videos/Сгибание рук с гантелями.MOV", sets: [{ reps: 12, weight: "" }, { reps: 12, weight: "" }, { reps: 12, weight: "" }] },
          { id: "bm2_abs", name: "Пресс", video: "/videos/Пресс (скручивания обычные).MOV", sets: [{ reps: 15, weight: "" }, { reps: 15, weight: "" }, { reps: 15, weight: "" }] }
        ]
      },
      {
        id: "basic_muscle_day3",
        name: "Базовая — День 3 · Спина / плечи",
        order: 3,
        sortOrder: 3,
        exercises: [
          { id: "bm3_rdl", name: "Румынская тяга", video: "", sets: [{ reps: 10, weight: "" }, { reps: 10, weight: "" }, { reps: 10, weight: "" }] },
          { id: "bm3_db_row", name: "Тяга гантели к поясу", video: "", sets: [{ reps: 10, weight: "" }, { reps: 10, weight: "" }, { reps: 10, weight: "" }] },
          { id: "bm3_hammer", name: "Тяга верхнего блока (хаммер)", video: "/videos/Тяга верхнего блока.MOV", sets: [{ reps: 12, weight: "" }, { reps: 12, weight: "" }, { reps: 12, weight: "" }] },
          { id: "bm3_machine_press", name: "Вертикальный жим в тренажёре", video: "", sets: [{ reps: 10, weight: "" }, { reps: 10, weight: "" }, { reps: 10, weight: "" }] },
          { id: "bm3_abs", name: "Пресс", video: "/videos/Пресс (скручивания обычные).MOV", sets: [{ reps: 15, weight: "" }, { reps: 15, weight: "" }, { reps: 15, weight: "" }] }
        ]
      },
      {
        id: "basic_muscle_day4",
        name: "Базовая — День 4 · Грудь / руки",
        order: 4,
        sortOrder: 4,
        exercises: [
          { id: "bm4_lunge", name: "Выпады с гантелями", video: "", sets: [{ reps: 10, weight: "" }, { reps: 10, weight: "" }, { reps: 10, weight: "" }] },
          { id: "bm4_db_bench", name: "Жим гантелей лёжа", video: "/videos/Жим лежа с гантелями.mp4", sets: [{ reps: 10, weight: "" }, { reps: 10, weight: "" }, { reps: 10, weight: "" }] },
          { id: "bm4_fly", name: "Сведение гантелей (наклон)", video: "", sets: [{ reps: 12, weight: "" }, { reps: 12, weight: "" }, { reps: 12, weight: "" }] },
          { id: "bm4_rear", name: "Задняя дельта в кроссовере", video: "", sets: [{ reps: 12, weight: "" }, { reps: 12, weight: "" }, { reps: 12, weight: "" }] },
          { id: "bm4_abs", name: "Пресс", video: "/videos/Пресс (скручивания обычные).MOV", sets: [{ reps: 15, weight: "" }, { reps: 15, weight: "" }, { reps: 15, weight: "" }] }
        ]
      }
    ]
  }
};
