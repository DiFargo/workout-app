import { useRef, useState } from "react";
import ProfileWorkoutJournalModal from "../../features/client/profile/ProfileWorkoutJournalModal";
import ProfileFeedbackModal from "../../features/client/profile/ProfileFeedbackModal";
import { WorkoutModePickerDialog } from "../../features/client/workouts/WorkoutListDialogs";

const history = Array.from({ length: 8 }, (_, index) => ({
  id: `history-${index}`, date: new Date(2026, 8, 7 - index, 14).getTime(), durationSeconds: 3000,
  workout: index === 1 ? "Тренировка для грудных мышц, ног и бицепса с дополнительными упражнениями" : `Тренировка ${8 - index}`,
  postWorkoutFeedback: { title: "Хорошо", emoji: "🙂" },
  exercises: [{ name: "Жим гантелей на наклонной скамье", sets: [{ set: 1, reps: 12, weight: 20 }] }]
}));
function dateKey(date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }

export default function WorkoutSheetsE2EHarness({ sheet = "calendar", failFirst = false }) {
  const [open, setOpen] = useState(true);
  const [tab, setTab] = useState(sheet === "history" ? "history" : "calendar");
  const [month, setMonth] = useState(8);
  const [selected, setSelected] = useState("2026-09-07");
  const [dates, setDates] = useState(["2026-09-07", "2026-09-11", "2026-09-15"]);
  const [draftDates, setDraftDates] = useState(dates);
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
    return { date, key, isCurrentMonth: date.getMonth() === monthDate.getMonth(), isToday: key === "2026-09-07",
      isScheduled: (editing ? draftDates : dates).includes(key), isScheduleLocked: false,
      scheduleEntries: order < 0 ? [] : [{ order: order + 1, status: key === "2026-09-07" ? "completed" : "planned" }],
      workouts: key === "2026-09-07" ? [history[0]] : [] };
  });
  return <>
    <output data-testid="workout-sheets-result">{result}</output>
    <ProfileWorkoutJournalModal open={open && ["calendar", "history"].includes(sheet)} activeTab={tab}
      onClose={() => setOpen(false)} onTabChange={setTab}
      calendarProps={{ monthDate, monthKey: dateKey(monthDate).slice(0, 7), calendarDays, selectedDate: selected,
        selectedItems: selected === "2026-09-07" ? [history[0]] : [], scheduledDates: dates, draftDates, editing, status,
        isTrainerManaged: true, getTimestampValue: value => value, onShiftMonth: shift => setMonth(current => current + shift),
        onStartEdit: () => { setDraftDates(dates); setEditing(true); }, onCancelEdit: () => setEditing(false),
        onSave: () => { setDates(draftDates); setEditing(false); setStatus("Расписание сохранено"); setResult(JSON.stringify(draftDates)); },
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
        setResult(JSON.stringify({ type: draft.type, message: draft.message, contact: draft.contact, file: draft.attachmentFile?.name }));
      }} />
  </>;
}
