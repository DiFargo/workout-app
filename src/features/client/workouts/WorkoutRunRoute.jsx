import { POST_WORKOUT_FEEDBACK_OPTIONS } from "../../../domain/workoutPresentation";
import FirstSetupOnboarding from "../../auth/FirstSetupOnboarding";
import {
  PostWorkoutFeedbackDialog,
  WorkoutExitDialog,
  WorkoutIncompleteDialog,
  WorkoutReadinessDialog
} from "../../../components/workout/WorkoutDialogs";
import {
  WorkoutFullscreenVideoOverlay,
  WorkoutNotFoundPage,
  WorkoutRunTopControls
} from "./WorkoutRunOverlays";
import WorkoutRunStageView from "./WorkoutRunStageView";
import WorkoutRunPageShell from "./WorkoutRunPageShell";
import { useWorkoutRunViewModel } from "./useWorkoutRunViewModel";
import styles from "./WorkoutRunRoute.module.css";

export default function WorkoutRunRoute({ runtime }) {
  const {
    workout,
    stageProps,
    noHeader,
    topControls,
    closeMissingWorkout,
    dialogs,
    onboarding,
    fullscreenVideo
  } = useWorkoutRunViewModel(runtime);

  if (!workout) {
    return <WorkoutNotFoundPage onBackToMenu={closeMissingWorkout} />;
  }

  return (
    <WorkoutRunPageShell noHeader={noHeader}>
      <WorkoutRunTopControls {...topControls} />

      <WorkoutRunStageView {...stageProps} />

      {runtime.exerciseValidationMessage && (
        <div
          className={styles.validationToast}
          data-css-module-scope="workout-run-validation-toast"
          role="alert"
        >
          <span aria-hidden="true">!</span>
          <strong>{runtime.exerciseValidationMessage}</strong>
        </div>
      )}

      <WorkoutReadinessDialog {...dialogs.readiness} />
      <WorkoutExitDialog {...dialogs.exit} />
      <WorkoutIncompleteDialog {...dialogs.incomplete} />
      <PostWorkoutFeedbackDialog options={POST_WORKOUT_FEEDBACK_OPTIONS} {...dialogs.feedback} />
      <FirstSetupOnboarding {...onboarding} />
      <WorkoutFullscreenVideoOverlay {...fullscreenVideo} />
    </WorkoutRunPageShell>
  );
}
