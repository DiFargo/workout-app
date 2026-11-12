export function createInitialBasicWorkoutQuiz() {
  return {
    goal: "general_fitness",
    level: "beginner",
    location: "gym",
    days: "3",
    duration: "45",
    restrictions: "none",
    restrictionDetails: "",
    twoDayStructure: "recovery_split"
  };
}

export function createInitialTrainerCalendarDraft() {
  return {
    enabled: true,
    reminderEnabled: true,
    reminderOffsetsHours: [24],
    reminderTime: "19:00",
    workoutTime: "13:00",
    hourReminderEnabled: false,
    trainingDays: [],
    daySettings: {}
  };
}

export function createInitialProfileMeasurementDraft() {
  return {
    weight: "",
    neck: "",
    shoulders: "",
    chest: "",
    biceps: "",
    forearm: "",
    wrist: "",
    belly: "",
    pelvis: "",
    thigh: "",
    calf: "",
    ankle: "",
    note: ""
  };
}
