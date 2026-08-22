export function getProfileMeasurementFields() {
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

// These ranges are deliberately broad enough for the adult fitness audience,
// while still catching the most common input mistakes (a missing decimal point
// or a value entered in the wrong unit) before they become part of progress
// history.
export const PROFILE_MEASUREMENT_LIMITS = Object.freeze({
  weight: { min: 25, max: 350, unit: "кг" },
  neck: { min: 20, max: 80, unit: "см" },
  shoulders: { min: 50, max: 250, unit: "см" },
  chest: { min: 40, max: 250, unit: "см" },
  biceps: { min: 10, max: 100, unit: "см" },
  forearm: { min: 10, max: 80, unit: "см" },
  wrist: { min: 8, max: 50, unit: "см" },
  belly: { min: 30, max: 300, unit: "см" },
  pelvis: { min: 30, max: 300, unit: "см" },
  thigh: { min: 15, max: 150, unit: "см" },
  calf: { min: 15, max: 100, unit: "см" },
  ankle: { min: 10, max: 70, unit: "см" }
});

function formatProfileMeasurementNumber(value) {
  const rounded = Math.round(value * 100) / 100;
  return String(rounded);
}

export function validateProfileMeasurementValue(field = {}, value = "") {
  const rawValue = String(value ?? "").trim();
  const limits = PROFILE_MEASUREMENT_LIMITS[field?.id];

  if (!rawValue) {
    return { valid: true, empty: true, value: "", error: "" };
  }

  if (!/^\d{1,3}(?:[.,]\d{1,2})?$/u.test(rawValue)) {
    return {
      valid: false,
      empty: false,
      value: rawValue,
      error: `${field?.label || "Значение"}: введи число, например 82,5.`
    };
  }

  const numericValue = Number(rawValue.replace(",", "."));
  if (!Number.isFinite(numericValue)) {
    return {
      valid: false,
      empty: false,
      value: rawValue,
      error: `${field?.label || "Значение"}: введи корректное число.`
    };
  }

  if (limits && (numericValue < limits.min || numericValue > limits.max)) {
    return {
      valid: false,
      empty: false,
      value: rawValue,
      error: `${field.label}: укажи значение от ${limits.min} до ${limits.max} ${limits.unit}.`
    };
  }

  return {
    valid: true,
    empty: false,
    value: formatProfileMeasurementNumber(numericValue),
    numericValue,
    error: ""
  };
}

export function validateProfileMeasurementDraft(draft = {}, fields = getProfileMeasurementFields()) {
  const values = {};
  const errors = {};
  let hasValue = false;

  fields.forEach((field) => {
    const validation = validateProfileMeasurementValue(field, draft?.[field.id]);
    values[field.id] = validation.value;
    if (!validation.empty) hasValue = true;
    if (!validation.valid) errors[field.id] = validation.error;
  });

  return {
    valid: Object.keys(errors).length === 0,
    hasValue,
    values,
    errors,
    firstError: Object.values(errors)[0] || ""
  };
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

export function formatProfileProgressPhotoDate(photo = null) {
  const dateValue = photo?.date || photo?.createdAt?.slice(0, 10);
  if (!dateValue) return "Дата не указана";

  const date = new Date(`${dateValue}T12:00:00`);
  return Number.isNaN(date.getTime()) ? "Дата не указана" : date.toLocaleDateString("ru-RU");
}

export function getProfileMeasurementValue(measurement = null, field = {}) {
  if (!field?.id) return "—";
  const value = measurement?.[field.id];

  if (value === 0 || value === "0") return "0";
  if (value === null || value === undefined || String(value).trim() === "") return "—";

  return String(value).trim();
}

export function getProfileMeasurementValueById(measurement = null, fields = [], fieldId = "") {
  const field = fields.find((item) => item.id === fieldId);
  return field && measurement ? getProfileMeasurementValue(measurement, field) : "";
}

export function getProfileMeasurementDelta(currentValue, previousValue) {
  if (String(currentValue ?? "").trim() === "" || String(previousValue ?? "").trim() === "") return null;

  const currentNumber = Number(String(currentValue || "").replace(",", "."));
  const previousNumber = Number(String(previousValue || "").replace(",", "."));
  if (!Number.isFinite(currentNumber) || !Number.isFinite(previousNumber)) return null;

  return Math.round((currentNumber - previousNumber) * 10) / 10;
}
