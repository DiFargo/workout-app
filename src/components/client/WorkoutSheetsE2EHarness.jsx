import { useRef, useState } from "react";
import ProfileWorkoutJournalModal from "../../features/client/profile/ProfileWorkoutJournalModal";
import ProfileFeedbackModal from "../../features/client/profile/ProfileFeedbackModal";
import { WorkoutModePickerDialog } from "../../features/client/workouts/WorkoutListDialogs";
import { getProfileCalendarDraft, mergeProfileCalendarDraft } from "../../features/client/profile/profileCalendarDraft.js";
import { buildPlannedWorkoutSlots, getWorkoutScheduleCalendarForWorkouts } from "../../utils/workoutSchedule.js";

const regressionSlots = Array.from({ length: 8 }, (_, index) => ({
  workoutId: `day-${index + 1}`, workoutName: `Тренировка ${index + 1}`, order: index + 1,
  plannedDate: ["2026-11-04", "2026-11-07", "2026-11-11", "2026-10-31", "2026-11-14", "2026-11-18", "2026-11-21", "2026-11-25"][index],
  completedDate: index < 5 ? ["2026-10-21", "2026-10-24", "2026-10-28", "2026-10-31", "2026-11-04"][index] : "",
  isCompleted: index < 5, isCompletedOffDate: index < 5, status: index < 5 ? "completed_off_date" : "planned"
}));
const regressionWorkouts = regressionSlots.map(slot => ({ id: slot.workoutId, name: slot.workoutName, scheduledDate: slot.plannedDate,
  assignedProgramUpdatedAt: "v1", assignedProgramAddedAt: "assignment" }));
const regressionHistory = regressionSlots.filter(slot => slot.isCompleted).map(slot => ({ workoutId: slot.workoutId, date: slot.completedDate, assignedProgramUpdatedAt: "v1" }));
const initialRegressionCalendar = { plannedWorkouts: regressionSlots.map(slot => ({
  workoutId: slot.workoutId, workoutName: slot.workoutName, order: slot.order,
  date: slot.plannedDate, status: "planned", dateOrderPolicy: "workout_identity",
  assignedProgramUpdatedAt: "v1", assignedProgramAddedAt: "assignment"
})) };

const history = Array.from({ length: 8 }, (_, index) => ({
  id: `history-${index}`, date: new Date(2026, 8, 7 - index, 14).getTime(), durationSeconds: 3000,
  workout: index === 1 ? "Тренировка для грудных мышц, ног и бицепса с дополнительными упражнениями" : `Тренировка ${8 - index}`,
  postWorkoutFeedback: { title: "Хорошо", emoji: "🙂" },
  exercises: [{ name: "Жим гантелей на наклонной скамье", sets: [{ set: 1, reps: 12, weight: 20 }] }]
}));
function dateKey(date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }

export default function WorkoutSheetsE2EHarness({ sheet = "calendar", failFirst = false }) {
  const regression = new URLSearchParams(window.location.search).has("calendarRegression");
  const [open, setOpen] = useState(true);
  const [tab, setTab] = useState(sheet === "history" ? "history" : "calendar");
  const [month, setMonth] = useState(regression ? 10 : 8);
  const [selected, setSelected] = useState("2026-09-07");
  const [dates, setDates] = useState(["2026-09-07", "2026-09-11", "2026-09-15"]);
  const [regressionCalendar, setRegressionCalendar] = useState(() => regression
    ? JSON.parse(localStorage.getItem("e2e-calendar-reload") || "null") || initialRegressionCalendar : initialRegressionCalendar);
  const loadedRegressionSlots = buildPlannedWorkoutSlots({ workouts: regressionWorkouts,
    calendar: getWorkoutScheduleCalendarForWorkouts(regressionCalendar, regressionWorkouts),
    history: regressionHistory, now: new Date("2026-11-08T12:00:00") });
  const [draftDates, setDraftDates] = useState(regression ? getProfileCalendarDraft(regressionSlots).dates : dates);
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState("");
  const [openItemId, setOpenItemId] = useState("");
  const [remember, setRemember] = useState(true);
  const [mode, setMode] = useState("individual");
  const [result, setResult] = useState("");
  const attempts = useRef(0);
  const monthDate = new Date(2026, month, 1, 12);
  const offset = (monthDate.getDay() + 6) % 7;
  const calendarDays = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(2026, month, 1 - offset + index, 12);
    const key = dateKey(date);
    const order = dates.indexOf(key);
    const entries = regression ? getProfileCalendarDraft(loadedRegressionSlots, editing ? draftDates : null).entries.filter(entry => entry.date === key) : null;
    return { date, key, isCurrentMonth: date.getMonth() === monthDate.getMonth(), isToday: key === "2026-09-07",
      isScheduled: (editing ? draftDates : dates).includes(key), isScheduleLocked: regression && regressionSlots.some(slot => slot.isCompleted && slot.completedDate === key),
      scheduleEntries: entries || (order < 0 ? [] : [{ order: order + 1, status: key === "2026-09-07" ? "completed" : "planned" }]),
      workouts: key === "2026-09-07" ? [history[0]] : [] };
  });
  return <>
    <output data-testid="workout-sheets-result">{result}</output>
    <ProfileWorkoutJournalModal open={open && ["calendar", "history"].includes(sheet)} activeTab={tab}
      onClose={() => setOpen(false)} onTabChange={setTab}
      calendarProps={{ monthDate, monthKey: dateKey(monthDate).slice(0, 7), calendarDays, selectedDate: selected,
        selectedItems: selected === "2026-09-07" ? [history[0]] : [], scheduledDates: dates, draftDates, editing, status,
        isTrainerManaged: true, getTimestampValue: value => value, onShiftMonth: shift => setMonth(current => current + shift),
        scheduleRequiredCount: regression ? 3 : 0, completedCount: regression ? 5 : 0,
        statusTone: status === "Расписание сохранено" ? "success" : "error",
        onStartEdit: () => { setDraftDates(regression ? getProfileCalendarDraft(loadedRegressionSlots).dates : dates); setEditing(true); }, onCancelEdit: () => setEditing(false),
        onSave: () => {
          if (regression) {
            const baseline = regressionCalendar;
            const current = { ...baseline, assignedProgramUpdatedAt: "queue-refreshed",
              plannedWorkouts: baseline.plannedWorkouts.map(entry => Object.fromEntries(Object.entries(entry).reverse())).reverse() };
            const saved = mergeProfileCalendarDraft(current, baseline, loadedRegressionSlots, draftDates, new Date("2026-11-08T12:00:00"));
            setRegressionCalendar(saved);
            localStorage.setItem("e2e-calendar-reload", JSON.stringify(saved));
          }
          setDates(draftDates); setEditing(false); setStatus("Расписание сохранено"); setResult(JSON.stringify([...draftDates].sort()));
        },
        onDayClick: day => { setSelected(day.key); if (editing) setDraftDates(current => current.includes(day.key) ? current.filter(key => key !== day.key) : [...current, day.key]); },
        onOpenHistory: id => { setTab("history"); setOpenItemId(id); }
      }}
      historyProps={{ items: history, openItemId, getTimestampValue: value => value,
        onToggleItem: id => setOpenItemId(current => current === id ? "" : id), onRequestDelete: item => setResult(`delete-request:${item.id}`) }}
    />
    <WorkoutModePickerDialog open={open && sheet === "mode"} workoutModePreference={{ mode }} rememberChoice={remember}
      onClose={() => setOpen(false)} onRememberChoiceChange={setRemember}
      onOpenBasic={() => { setMode("basic"); setResult(`basic:${remember}`); }}
      onOpenIndividual={() => { setMode("individual"); setResult(`individual:${remember}`); }} />
    <ProfileFeedbackModal open={open && sheet === "feedback"} defaultContact="test@invite.tren-85720.app"
      onClose={() => setOpen(false)} onSubmit={async draft => {
        attempts.current += 1;
        if (failFirst && attempts.current === 1) throw new Error("Test network failure");
        setResult(JSON.stringify({ type: draft.type, message: draft.message, contact: draft.contact, files: draft.attachmentFiles?.map(file => file.name) }));
      }} />
  </>;
}
