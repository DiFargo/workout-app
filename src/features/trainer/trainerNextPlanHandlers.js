export async function saveTrainerNextPlanWithDeps({
  plan,
  nextWorkouts,
  options = {},
  saveWorkoutsToFirebase,
  setPlan
}) {
  const nextPlan = {
    ...(plan || {}),
    workouts: nextWorkouts
  };

  setPlan(nextPlan);
  await saveWorkoutsToFirebase(nextPlan, { silent: true, ...options });
}
