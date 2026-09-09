import { useState } from "react";
import { CalendarDays, ChevronRight, ClipboardList, MessageSquare } from "lucide-react";
import { toWorkoutDateKey } from "../../utils/workoutSchedule.js";

import TrainerClientUtilitySheet from "./TrainerClientUtilitySheet";
import styles from "./TrainerAppleClient.module.css";

export function AppleRow({ title, description, onClick, icon: Icon = CalendarDays, value }) {
  return <button type="button" className={styles.row} onClick={onClick}><span className={styles.symbol}><Icon size={20} /></span><span className={styles.copy}><strong>{title}</strong>{description ? <small>{description}</small> : null}</span>{value ? <span className={styles.value}>{value}</span> : null}<ChevronRight size={16} /></button>;
}
export function AppleGroup({ title, action, children, className = "" }) {
  return <section className={`${styles.group} ${className}`}><header><h3>{title}</h3>{action}</header><div className={styles.surface}>{children}</div></section>;
}
export function AppleSchedule({ slots, children, onOpenHistory, onOpenProgramHistory }) {
  const [open, setOpen] = useState(false);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayKey = toWorkoutDateKey(today);
  const next = slots.find(slot => !slot.isCompleted && slot.plannedDate >= todayKey);
  const [picked, setPicked] = useState("");
  const selected = picked || next?.plannedDate || todayKey;
  const start = new Date(`${selected}T12:00:00`);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  const days = Array.from({ length: 7 }, (_, i) => { const date = new Date(start); date.setDate(date.getDate() + i); return date; });
  return <>
    <AppleGroup title="Ближайшие занятия" action={<span className={styles.calendarLabel}>Календарь</span>}>
      <div className={styles.week}>{days.map(date => { const key = toWorkoutDateKey(date); const scheduled = slots.some(slot => slot.plannedDate === key); return <button key={key} type="button" aria-label={`${date.toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}${scheduled ? ", есть тренировка" : ""}`} aria-pressed={selected === key} onClick={() => setPicked(key)}><small>{date.toLocaleDateString("ru-RU", { weekday: "short" })}</small><strong>{date.getDate()}</strong><span aria-hidden="true">{scheduled ? "•" : " "}</span></button>; })}</div>
      <div className={styles.scheduleEditRow}><span className={styles.symbol}><CalendarDays size={20} /></span><strong>Расписание и абонемент</strong><button type="button" onClick={() => setOpen(true)}>Редактировать</button></div>
    </AppleGroup>
    <AppleGroup title="Управление"><div className={styles.twoActions}><AppleRow title="История тренировок" description="Завершённые занятия и результаты" onClick={onOpenHistory} /><AppleRow title="История программ" description="Назначенные программы и изменения" icon={ClipboardList} onClick={onOpenProgramHistory} /></div></AppleGroup>
    {open ? <TrainerClientUtilitySheet title="Расписание и абонемент" variant="wide" onRequestClose={() => setOpen(false)}><div className={styles.calendarContent}>{children}</div></TrainerClientUtilitySheet> : null}
  </>;
}
export function AppleRecent({ note, lastMeasurement, onFeedback, onMeasurements, onTraining, onProgress }) {
  return <AppleGroup title="Последние события">
    {note ? <AppleRow title="Комментарий после тренировки" description={note.text} icon={MessageSquare} onClick={() => onFeedback(note)} /> : null}
    <AppleRow title="Расписание занятий" description="Ближайшие тренировки клиента" onClick={onTraining} />
    {lastMeasurement ? <AppleRow title="Добавлены замеры" description={lastMeasurement} onClick={onMeasurements} /> : null}
    <AppleRow title="Прогресс упражнений" description="Нагрузка, история и решения тренера" icon={ClipboardList} onClick={onProgress} />
  </AppleGroup>;
}
