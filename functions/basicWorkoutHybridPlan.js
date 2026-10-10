import { BASIC_WORKOUT_AI_CATALOGUE } from "./basicWorkoutAiCatalogue.generated.js";
import { orderBasicWorkoutExercises } from "./basicWorkoutPlanOrder.js";
import { buildHybridWorkoutContext, applyHybridWorkoutChoices, HYBRID_WORKOUT_STRATEGY } from "./basicWorkoutGemini.js";
import { getWorkoutEmphasisOption, normalizeWorkoutEmphasis, summarizeWorkoutEmphasis } from "./basicWorkoutEmphasis.js";

const BY_ID = new Map(BASIC_WORKOUT_AI_CATALOGUE.map((exercise) => [exercise.id, exercise]));

export function finalizeHybridWorkoutPlan(result, profile = {}, uid = "", now = new Date()) {
  const { draft, ...generation } = result;
  const today = profile.mode === "today";
  const dayCount = today ? 1 : Number(profile.days) || 3;
  const dateKey = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Minsk", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const id = `basic_hybrid_${crypto.randomUUID()}`;
  const workouts = Array.from({ length: today ? 1 : 4 }, (_, weekIndex) => {
    const source = today ? [draft.workout] : draft.weeks[weekIndex % 2].workouts;
    return source.map((workout, dayIndex) => {
      const workoutId = `${id}_w${weekIndex + 1}_d${dayIndex + 1}`;
      const exercises = workout.exercises.map((exercise) => {
        const card = BY_ID.get(exercise.catalogueId);
        return { ...exercise, basicMovementRole: card.movementRole };
      });
      return { id: workoutId, name: today ? workout.name : `День ${dayIndex + 1} · ${workout.name}`,
        focus: workout.focus, weekNumber: weekIndex + 1, weekLabel: today ? "Сегодня" : `Неделя ${weekIndex + 1}`,
        dayNumber: dayIndex + 1, dayLabel: today ? "Сегодня" : `День ${dayIndex + 1}`,
        ...(today ? { scheduledDate: dateKey, plannedDate: dateKey } : {}),
        order: weekIndex * dayCount + dayIndex + 1, sortOrder: weekIndex * dayCount + dayIndex + 1,
        exercises: orderBasicWorkoutExercises(exercises).map((exercise, index) => {
          const card = BY_ID.get(exercise.catalogueId);
          return { id: `${workoutId}_e${index + 1}`, basicExerciseId: card.id, basicExerciseLibraryId: card.id,
            basicExerciseGroupId: card.groupId, basicMovementRole: card.movementRole,
            name: card.name, video: "", equipment: card.equipment, requiresWeight: card.requiresWeight,
            usesWeight: card.requiresWeight, rest: `${exercise.restSeconds || card.restSeconds} сек`, note: card.note, description: card.note,
            sets: exercise.sets.map((set) => ({ reps: set.reps, weight: "", durationSeconds: set.durationSeconds || 0,
              completed: false, enteredWeight: "", enteredReps: "" })) };
        }) };
    });
  }).flat();
  const trainingEmphasis = normalizeWorkoutEmphasis(draft.trainingEmphasis);
  return { id, name: draft.name, description: today ? draft.description
    : `${getWorkoutEmphasisOption(trainingEmphasis).label}. План на 4 недели: два варианта недель, затем их повтор без автоматического увеличения нагрузки.`,
    ...(!today ? { trainingEmphasis, weeklySetDistribution: summarizeWorkoutEmphasis(workouts.filter((workout) => workout.weekNumber === 1)) } : {}),
    safetyNote: draft.safetyNote,
    progressionNote: "Рабочий вес укажи вручную. Повышение нагрузки не назначается автоматически; при сомнениях обсуди его с тренером.",
    durationWeeks: today ? 1 : 4, structure: today ? "on_demand" : "variants_then_repeat",
    generatedAt: now.toISOString(), ...generation, startingWeightPolicy: "manual", requiresReview: false,
    profile: { ...profile, days: String(dayCount), requestedBy: String(uid || "") }, workouts };
}

export function buildLocalHybridWorkoutPlan(profile = {}) {
  const context = buildHybridWorkoutContext(profile);
  const draft = applyHybridWorkoutChoices(context,
    context.slots.map((slot) => ({ slotId: slot.id, catalogueId: slot.baseId })), profile);
  return finalizeHybridWorkoutPlan({ draft, personalization: context.personalization, generatedBy: "template_fallback", generationFallback: true,
    generationStrategy: HYBRID_WORKOUT_STRATEGY, generationProvider: "templates", generationReason: "offline" }, profile);
}
