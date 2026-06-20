export function getProfileMeasurementFields(goal = "recomp") {
  return [
    {
      id: "weight",
      label: "Вес",
      unit: "кг",
      placeholder: "82.5",
      icon: "⚖️",
      zone: "Вес",
      hint: "Взвешивайся утром, после туалета, до еды и воды."
    },
    {
      id: "neck",
      label: "Шея",
      unit: "см",
      placeholder: "40",
      icon: "🧍",
      zone: "ШЕЯ",
      hint: "Лента проходит вокруг шеи по середине, без сильного натяжения."
    },
    {
      id: "shoulders",
      label: "Плечевой пояс",
      unit: "см",
      placeholder: "122",
      icon: "↔️",
      zone: "ПЛЕЧИ",
      hint: "Мерь по самой широкой линии плечевого пояса, ровно вокруг тела."
    },
    {
      id: "chest",
      label: "Грудь",
      unit: "см",
      placeholder: "105",
      icon: "📏",
      zone: "ГРУДЬ",
      hint: "Лента проходит по самой широкой части груди, дыхание спокойное."
    },
    {
      id: "biceps",
      label: "Бицепс",
      unit: "см",
      placeholder: "38",
      icon: "💪",
      zone: "БИЦЕПС",
      hint: "Мерь середину плеча. Всегда одинаково: расслабленно или напряжённо."
    },
    {
      id: "forearm",
      label: "Предплечье",
      unit: "см",
      placeholder: "31",
      icon: "🦾",
      zone: "ПРЕДПЛЕЧЬЕ",
      hint: "Лента по самой широкой части предплечья."
    },
    {
      id: "wrist",
      label: "Запястье",
      unit: "см",
      placeholder: "18",
      icon: "⌚",
      zone: "ЗАПЯСТЬЕ",
      hint: "Мерь над косточкой запястья, лента прилегает мягко."
    },
    {
      id: "belly",
      label: "Живот",
      unit: "см",
      placeholder: "88",
      icon: "⭕",
      zone: "ЖИВОТ",
      hint: "Мерь на уровне пупка, живот не втягивать."
    },
    {
      id: "pelvis",
      label: "Таз",
      unit: "см",
      placeholder: "98",
      icon: "⬭",
      zone: "ТАЗ",
      hint: "Лента проходит по самой широкой части таза/ягодиц."
    },
    {
      id: "thigh",
      label: "Бедро",
      unit: "см",
      placeholder: "58",
      icon: "🦵",
      zone: "БЕДРО",
      hint: "Мерь самую широкую часть бедра, нога расслаблена."
    },
    {
      id: "calf",
      label: "Голень",
      unit: "см",
      placeholder: "39",
      icon: "🦶",
      zone: "ГОЛЕНЬ",
      hint: "Мерь самую широкую часть икры."
    },
    {
      id: "ankle",
      label: "Лодыжка",
      unit: "см",
      placeholder: "23",
      icon: "🦶",
      zone: "ЛОДЫЖКА",
      hint: "Мерь самую узкую часть над стопой, лента прилегает мягко."
    }
  ];
}

export function getProfileMeasurementGoalText(goal = "recomp") {
  if (goal === "mass") return "Для набора важно видеть рост веса и объёмов без резкого набора талии.";
  if (goal === "cut" || goal === "dry") return "Для похудения и сушки важны вес, талия и объёмы — так видно, уходит ли жир.";
  if (goal === "maintain") return "Для поддержки важно, чтобы вес и талия оставались стабильными.";
  return "Для рекомпозиции важны вес, талия и объёмы: вес может стоять, но форма должна меняться.";
}

export function getMeasurementTimestampValue(measurement = {}) {
  const rawDate = measurement.date || measurement.createdAt || measurement.savedAt || "";
  const timestamp = rawDate ? new Date(rawDate).getTime() : 0;
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export function formatProfileMeasurementDate(measurement = null) {
  if (!measurement) return "Замеров пока нет";
  const rawDate = measurement.date || measurement.createdAt || "";
  if (!rawDate) return "Дата не указана";

  const parsedDate = new Date(rawDate);
  if (Number.isNaN(parsedDate.getTime())) return "Дата не указана";

  return parsedDate.toLocaleDateString("ru-RU");
}

export function getProfileMeasurementValue(measurement = null, field = {}) {
  if (!field?.id) return "—";
  const value = measurement?.[field.id];

  if (value === 0 || value === "0") return "0";
  if (value === null || value === undefined || String(value).trim() === "") return "—";

  return String(value).trim();
}
