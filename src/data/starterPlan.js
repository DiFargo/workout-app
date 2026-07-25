import { makeThreeSets } from "../utils/workoutPlanNormalization";

export const starterPlan = {
  workouts: [
    {
      id: "day1",
      name: "День 1 — спина/плечи",
      exercises: [
        {
          id: "d1e1",
          name: "Жим ногами",
          video: "/videos/1. Жим ногами.MOV",
          sets: [{ reps: 8, weight: "120" }]
        },
        {
          id: "d1e2",
          name: "Тяга в наклоне",
          video: "",
          sets: [{ reps: 8, weight: "70" }]
        },
        {
          id: "d1e3",
          name: "Тяга Т-грифа",
          video: "",
          sets: [{ reps: 8, weight: "30" }]
        },
        {
          id: "d1e4",
          name: "Вертикальный жим с гантелями",
          video: "",
          sets: [{ reps: 8, weight: "18" }]
        },
        {
          id: "d1e5",
          name: "Отведение рук с гантелями",
          video: "/videos/Отведение рук в сторону с гантелями.MP4",
          sets: [{ reps: 8, weight: "8" }]
        },
        {
          id: "d1e6",
          name: "Разгибание рук в кроссовере",
          video: "/videos/Разгибание рук в кроссовере.MOV",
          sets: [{ reps: 8, weight: "22.5" }]
        },
        {
          id: "d1e7",
          name: "Пресс",
          video: "/videos/Пресс (скручивания обычные).MOV",
          sets: [{ reps: 15, weight: "" }]
        }
      ]
    },
    {
      id: "day2",
      name: "День 2 — грудь/плечи/руки",
      exercises: [
        {
          id: "d2e1",
          name: "Выпады с гантелями",
          video: "",
          sets: [{ reps: 8, weight: "12" }]
        },
        {
          id: "d2e2",
          name: "Жим лёжа со штангой",
          video: "",
          sets: [{ reps: 8, weight: "60" }]
        },
        {
          id: "d2e3",
          name: "Жим в Смите (наклон)",
          video: "",
          sets: [{ reps: 8, weight: "10" }]
        },
        {
          id: "d2e4",
          name: "Отведение рук с гантелями (с опорой)",
          video: "",
          sets: [{ reps: 8, weight: "10" }]
        },
        {
          id: "d2e5",
          name: "Отведение рук сидя в наклоне",
          video: "",
          sets: [{ reps: 8, weight: "4" }]
        },
        {
          id: "d2e6",
          name: "Сгибание рук в кроссовере",
          video: "/videos/Сгибание рук с гантелями.MOV",
          sets: [{ reps: 8, weight: "20" }]
        },
        {
          id: "d2e7",
          name: "Пресс",
          video: "",
          sets: [{ reps: 15, weight: "" }]
        }
      ]
    },
    {
      id: "day3",
      name: "День 3 — грудь + руки",
      exercises: [
        {
          id: "d3e1",
          name: "Разгибание ног",
          video: "",
          sets: [{ reps: 8, weight: "45" }]
        },
        {
          id: "d3e2",
          name: "Жим гантелей лёжа",
          video: "/videos/Жим лежа с гантелями.mp4",
          sets: [{ reps: 8, weight: "24" }]
        },
        {
          id: "d3e3",
          name: "Сведение гантелей (наклон)",
          video: "",
          sets: [{ reps: 8, weight: "14" }]
        },
        {
          id: "d3e4",
          name: "Задняя дельта в кроссовере",
          video: "",
          sets: [{ reps: 8, weight: "5" }]
        },
        {
          id: "d3e5",
          name: "Разгибание рук (Скотт)",
          video: "",
          sets: [{ reps: 8, weight: "16" }]
        },
        {
          id: "d3e6",
          name: "Сгибание рук (Скотт)",
          video: "",
          sets: makeThreeSets([], 8)
        },
        {
          id: "d3e7",
          name: "Пресс",
          video: "",
          sets: [{ reps: 15, weight: "" }]
        }
      ]
    },
    {
      id: "day4",
      name: "День 4 — спина + плечи",
      exercises: [
        {
          id: "d4e1",
          name: "Румынская тяга",
          video: "",
          sets: [{ reps: 8, weight: "80" }]
        },
        {
          id: "d4e2",
          name: "Тяга гантели к поясу",
          video: "",
          sets: [{ reps: 8, weight: "24" }]
        },
        {
          id: "d4e3",
          name: "Тяга верхнего блока (хаммер)",
          video: "/videos/Тяга верхнего блока.MOV",
          sets: [{ reps: 8, weight: "75" }]
        },
        {
          id: "d4e4",
          name: "Вертикальный жим в тренажёре",
          video: "",
          sets: [{ reps: 8, weight: "45" }]
        },
        {
          id: "d4e5",
          name: "Отведение рук в сторону",
          video: "",
          sets: [{ reps: 8, weight: "4" }]
        },
        {
          id: "d4e6",
          name: "Разгибание рук в тренажёре",
          video: "",
          sets: makeThreeSets([], 8)
        },
        {
          id: "d4e7",
          name: "Пресс",
          video: "",
          sets: [{ reps: 15, weight: "" }]
        }
      ]
    }
  ]
};

