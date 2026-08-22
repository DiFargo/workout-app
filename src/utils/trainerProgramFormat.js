export const TRAINER_PROGRAM_FORMATS = Object.freeze([
  {
    id: "full_body",
    label: "Фулбади",
    description: "Всё тело в одной тренировке — удобный старт для новичка.",
    draftDescription: "Формат фулбади: всё тело в одной тренировке."
  },
  {
    id: "split",
    label: "Сплит",
    description: "Разделение тренировок по группам мышц в разные дни.",
    draftDescription: "Формат сплит: дни распределены по группам мышц."
  },
  {
    id: "circuit",
    label: "Круговая тренировка",
    description: "Упражнения выполняются по кругу с коротким отдыхом.",
    draftDescription: "Круговой формат с последовательным выполнением упражнений."
  },
  {
    id: "strength",
    label: "Силовая тренировка",
    description: "Фокус на базовых движениях и развитии силы.",
    draftDescription: "Силовой формат с акцентом на базовые упражнения."
  }
]);

export function getTrainerProgramFormatMeta(formatId) {
  return TRAINER_PROGRAM_FORMATS.find((format) => format.id === formatId) || null;
}

export function normalizeTrainerProgramFormat(formatId) {
  return getTrainerProgramFormatMeta(formatId)?.id || "";
}
