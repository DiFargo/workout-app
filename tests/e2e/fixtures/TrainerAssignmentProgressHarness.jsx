import { useState } from "react";
import { createRoot } from "react-dom/client";
import TrainerProgramAssignmentAdjustmentModal from "../../../src/components/trainer/TrainerProgramAssignmentAdjustmentModal.jsx";
import { useModalFocusTrap } from "../../../src/shared/hooks/useModalFocusTrap";
import workspaceStyles from "../../../src/components/trainer/TrainerWorkspaceCalm.module.css";
import modalStyles from "../../../src/components/trainer/TrainerWorkspaceModalSystem.module.css";
import "../../../src/styles/index.css";
import "../../../src/styles/_variables.css";
import "../../../src/AppCoreFoundation.module.css";
import "../../../src/AppCoreTheme.module.css";
import "../../../src/AppCoreSurface.module.css";
import "../../../src/AppCoreLayout.module.css";
import "../../../src/AppCoreClientAppleTheme.css";
import "../../../src/components/trainer/TrainerWorkspaceV2.module.css";
import "../../../src/components/trainer/TrainerWorkspaceResponsivePass.module.css";

if (!import.meta.env.DEV) throw new Error("Assignment progress fixture is development-only");

const scenario = new URLSearchParams(window.location.search).get("scenario") || "return";
const bodyweight = scenario === "bodyweight";
const exercise = { id: "fixture-exercise", name: bodyweight ? "Отжимания" : "Жим лёжа", usesWeight: !bodyweight };
const repetitions = (weight, count = 3, reps = 12) => Array.from({ length: count }, (_, index) => ({ set: index + 1, reps, weight }));
const configurations = {
  return: { actual: [30, 35, 30], planned: [30, 30, 30] },
  search: { actual: [30, 35, 30], planned: [30, 30, 30] },
  trend: { actual: [25, 27.5, 30, 30, 32.5, 35], planned: [25, 25, null, 30, 30, 30] },
  unknown: { actual: [30, 35, 30], planned: [] },
  single: { actual: [30], planned: [30] },
  bodyweight: { actual: [0, 0, 0], planned: [0, 0, 0] },
  mixed: { actual: [30, 35, 30], planned: [30, 30, 30] },
  variableplan: { actual: [30, 35, 30], planned: [30, 35, 30] },
  eight: { actual: [25, 27.5, 30, 32.5, 30, 35, 32.5, 35], planned: [25, 25, 30, 30, null, 30, 32.5, 35] },
  empty: { actual: [], planned: [] }
};
const configuration = configurations[scenario];
if (!configuration) throw new Error("Unknown isolated assignment scenario");

const history = configuration.actual.map((weight, index) => {
  const lastMixed = scenario === "mixed" && index === configuration.actual.length - 1;
  const actualSets = repetitions(weight, lastMixed ? 2 : 3, lastMixed ? 8 : 12)
    .map(set => ({ ...set, completed: true, targetReps: 12 }));
  // Preserve an unfinished set in the real recording: it must not become fact.
  if (lastMixed) actualSets.push({ set: 3, reps: 12, weight, completed: false, targetReps: 12 });
  const record = {
    id: `fixture-history-${index + 1}`,
    date: new Date(Date.UTC(2026, 9, 1 + index * 3, 12)).toISOString(),
    completed: true,
    status: "completed",
    assignedProgramId: "fixture-past-program",
    exercises: [{ ...exercise, sets: actualSets }]
  };
  const plannedWeight = configuration.planned[index];
  if (plannedWeight !== undefined && plannedWeight !== null) {
    record.plannedSnapshot = { exercises: [{ ...exercise, sets: repetitions(plannedWeight) }] };
  }
  return record;
});
const workouts = [{
  id: "fixture-future-workout",
  name: "Следующая тренировка",
  exercises: [
    { ...exercise, sets: repetitions(bodyweight ? 0 : 40) },
    ...(scenario === "search" ? [
      { id: "fixture-pulldown", name: "Тяга верхнего блока", usesWeight: true, sets: repetitions(45) },
      { id: "fixture-plank", name: "Планка", usesWeight: false, sets: repetitions(0, 3, 30) }
    ] : [])
  ]
}];

export default function TrainerAssignmentProgressHarness() {
  useModalFocusTrap();
  const [open, setOpen] = useState(true);
  const [result, setResult] = useState(null);
  const [confirmCalls, setConfirmCalls] = useState(0);
  return <main className={`trainerNextRoot ${workspaceStyles.workspaceRoot} ${modalStyles.scope}`}>
    <output hidden data-testid="assignment-fixture-state" data-scenario={scenario} data-session-count={history.length} data-confirm-calls={confirmCalls} />
    <output hidden data-testid="assignment-confirm-result">{result ? JSON.stringify(result) : ""}</output>
    {open ? <TrainerProgramAssignmentAdjustmentModal
      client={{ id: "fixture-client", name: "Тестовый клиент" }}
      template={{ id: "fixture-template", name: "Следующая программа" }}
      workouts={workouts}
      history={history}
      onClose={() => setOpen(false)}
      onConfirm={async value => {
        setConfirmCalls(count => count + 1);
        setResult(value);
        return true;
      }}
    /> : <p data-testid="assignment-fixture-closed">Окно закрыто</p>}
  </main>;
}

createRoot(document.getElementById("root")).render(<TrainerAssignmentProgressHarness />);
