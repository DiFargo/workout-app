import { useState } from "react";
import { createRoot } from "react-dom/client";
import TrainerClientSetupFlowModal from "../../../src/components/trainer/TrainerClientSetupFlowModal.jsx";
import { TrainerShell } from "../../../src/components/trainer/TrainerWorkspace.jsx";
import "../../../src/styles/_variables.css";
import "../../../src/styles/index.css";
import "../../../src/components/trainer/TrainerWorkspaceV2.module.css";

const template = { id: "template", name: "Программа Т", lifecycleStatus: "ready", workouts: [
  { id: "one", name: "Тренировка 1", exercises: [
    { id: "legs", name: "Жим ногами", requiresWeight: true, sets: [{ weight: "120", reps: "12" }] },
    { id: "row", name: "Тяга гантели с опорой на скамью", requiresWeight: true, sets: [{ weight: "20", reps: "12" }, { weight: "25", reps: "12" }] },
    { id: "body", name: "Планка", requiresWeight: false, sets: [{ reps: "30" }] }
  ] },
  { id: "two", name: "Тренировка 2", exercises: [] }
] };
const assignment = { assignedProgramId: "template", assignedProgramAddedAt: "new-copy", assignedProgramName: template.name };
export default function Harness() {
  const [step, setStep] = useState(() => new URLSearchParams(location.search).get("step") || "program");
  const [client, setClient] = useState({ id: "test", name: "Тестовый клиент", ...assignment });
  const [workouts] = useState(template.workouts.map((workout, index) => ({ ...workout, ...assignment, order: index + 1, status: "planned" })));
  const [saveAttempts, setSaveAttempts] = useState(0);
  const [saved, setSaved] = useState(null);
  return <TrainerShell activeSection="clients" trainerName="Тестовый тренер" onNavigate={() => {}}><div className="trainerNextPage trainerNextClientPage">
    <output hidden data-testid="saved-setup">{JSON.stringify(saved)}</output>
    <TrainerClientSetupFlowModal client={client} clientName={client.name} workouts={workouts} checklist={{ currentStep: step }} programTemplates={[template]} selectedProgramId="template"
      onAssignProgram={async options => { setSaved(options); setStep("schedule"); return { assignment: { assignedAt: "new-copy" } }; }}
      onSaveWorkoutSchedule={async (payload, selected) => {
        setSaveAttempts(value => value + 1);
        if (new URLSearchParams(location.search).has("failure") && saveAttempts === 0) throw Object.assign(new Error("fixture conflict"), { assignmentMessage: "Расписание или тренировка изменились. Обновите карточку и повторите сохранение." });
        setSaved({ payload, ids: selected.map(item => item.id) });
        setClient(current => ({ ...current, workoutCalendar: { plannedWorkouts: payload.workoutDates.map(row => ({ ...row, status: "planned" })) } }));
        setStep("nutrition"); return true;
      }}
      onSaveNutritionPlan={async () => { setStep("notifications"); return true; }}
      onSaveNotifications={async () => { setStep("done"); return true; }} onClose={() => setStep("done")} />
  </div></TrainerShell>;
}
globalThis.__trainerSetupHarnessRoot ||= createRoot(document.getElementById("root"));
globalThis.__trainerSetupHarnessRoot.render(<Harness />);
