import { useEffect, useRef, useState } from "react";
import { Bell, Camera, Check, Clock3, Dumbbell, Ruler, Send } from "lucide-react";
import { getClientReminderSettings, PROGRESS_REMINDER_PERIODS, WORKOUT_REMINDER_OFFSETS } from "../../../utils/clientReminderSettings";
import styles from "./ProfileNotificationSettingsSection.module.css";

function ReminderSwitch({ title, description, icon: Icon, checked, disabled, onClick, ...props }) {
  return <button type="button" role="switch" aria-checked={checked} aria-label={title}
    className={styles.setting} disabled={disabled} onClick={onClick} {...props}>
    <span className={styles.icon}><Icon size={20} aria-hidden="true" /></span>
    <span className={styles.copy}><strong>{title}</strong><small>{description}</small></span>
    <span className={styles.toggle} aria-hidden="true"><span /></span>
  </button>;
}

function PeriodOptions({ label, value, disabled, onChange }) {
  return <div className={styles.options} role="group" aria-label={label}>
    {PROGRESS_REMINDER_PERIODS.map(days => <button type="button" key={days}
      aria-pressed={value === days} disabled={disabled} onClick={() => onChange(days)}>
      {value === days && <Check size={14} aria-hidden="true" />}{days} дней
    </button>)}
  </div>;
}

export default function ProfileNotificationSettingsSection({ telegramProfile, calendar = {}, onToggleNotifications, onSaveReminders, onTestReminder, onOpenConnections }) {
  const [draft, setDraft] = useState(() => getClientReminderSettings(calendar));
  const [timeDraft, setTimeDraft] = useState(draft.reminderTime);
  const [saveState, setSaveState] = useState("");
  const [message, setMessage] = useState("");
  const [testing, setTesting] = useState(false);
  const pending = useRef(false);
  const draftRef = useRef(draft);
  const queuedChanges = useRef({});
  const [failedSettings, setFailedSettings] = useState(null);
  const connected = telegramProfile?.connected === true;
  const enabled = connected && telegramProfile.notificationsEnabled !== false;
  const saving = saveState === "saving" || saveState === "saving-time";
  const settingsDisabled = !connected || !onSaveReminders || (saving && saveState !== "saving-time") || testing;
  const calendarKey = JSON.stringify(getClientReminderSettings(calendar));

  useEffect(() => {
    if (!pending.current) {
      const next = JSON.parse(calendarKey);
      draftRef.current = next;
      setDraft(next);
      setTimeDraft(next.reminderTime);
    }
  }, [calendarKey]);

  async function toggle() {
    if (!connected || !onToggleNotifications || pending.current) return;
    pending.current = true;
    setFailedSettings(null);
    setSaveState("saving");
    try {
      if (await onToggleNotifications(!enabled) !== true) throw new Error("Save failed");
      setSaveState("saved");
      setMessage(enabled ? "Напоминания отключены" : "Напоминания включены");
    } catch {
      setSaveState("error");
      setMessage("Не удалось сохранить. Проверьте соединение и попробуйте переключить ещё раз.");
    } finally { pending.current = false; }
  }

  async function save(next, field = null) {
    if (settingsDisabled || pending.current) return;
    const previous = draftRef.current;
    let saved = false;
    pending.current = true;
    draftRef.current = next;
    setDraft(next);
    setTimeDraft(next.reminderTime);
    setSaveState(field === "reminderTime" ? "saving-time" : "saving");
    setFailedSettings(null);
    try {
      if (await onSaveReminders(next) !== true) throw new Error("Save failed");
      saved = true;
      setSaveState("saved");
      setMessage("Настройки сохранены");
    } catch {
      draftRef.current = previous;
      setDraft(previous);
      setTimeDraft(previous.reminderTime);
      setFailedSettings({ ...next, ...queuedChanges.current });
      setSaveState("error");
      setMessage("Не удалось сохранить. Остались прежние настройки. Проверьте соединение и повторите.");
    } finally {
      pending.current = false;
      const changes = queuedChanges.current;
      queuedChanges.current = {};
      if (saved && Object.keys(changes).length) {
        void save({ ...draftRef.current, ...changes });
      }
    }
  }

  function change(field, value) {
    if (!connected || !onSaveReminders || testing) return;
    // A click can follow the time input's blur before disabled controls render.
    // Apply that field after the pending save, retaining the newly saved time.
    if (pending.current) {
      queuedChanges.current = { ...queuedChanges.current, [field]: value };
      setDraft({ ...draftRef.current, ...queuedChanges.current });
      return;
    }
    return save({ ...draftRef.current, [field]: value }, field);
  }
  function toggleOffset(hours) {
    const currentOffsets = queuedChanges.current.offsets ?? draftRef.current.offsets;
    const offsets = currentOffsets.includes(hours) ? currentOffsets.filter(value => value !== hours) : [...currentOffsets, hours];
    if (!offsets.length) {
      setSaveState("hint"); setMessage("Оставьте хотя бы одно время напоминания."); return;
    }
    return change("offsets", offsets.sort((a, b) => b - a));
  }
  function saveTime() {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(timeDraft)) {
      setTimeDraft(draft.reminderTime); setSaveState("hint"); setMessage("Укажите время в формате часы:минуты."); return;
    }
    if (timeDraft !== draft.reminderTime) void change("reminderTime", timeDraft);
  }
  async function testReminder() {
    if (!connected || !onTestReminder || pending.current || testing) return;
    setTesting(true); setSaveState(""); setFailedSettings(null);
    try {
      if (await onTestReminder() !== true) throw new Error("Delivery failed");
      setSaveState("saved"); setMessage("Тестовое напоминание отправлено в Telegram");
    } catch {
      setSaveState("error"); setMessage("Не удалось отправить. Проверьте подключение Telegram и повторите позже.");
    } finally { setTesting(false); }
  }

  return <section className={styles.root} data-testid="profile-notification-settings">
    <div className={styles.card}>
      <ReminderSwitch title="Напоминания в Telegram" description="Общий переключатель напоминаний" icon={Bell}
        checked={enabled} disabled={!connected || !onToggleNotifications || saving || testing} onClick={toggle}
        aria-describedby="telegram-reminders-help" aria-busy={saving} data-testid="profile-settings-notifications-toggle" />
      <div className={styles.connection}><Send size={16} aria-hidden="true" />
        <span>{connected ? "Telegram подключён" : "Telegram не подключён"}</span>
        {connected && <Check size={16} className={styles.check} aria-hidden="true" />}
      </div>
    </div>
    <p id="telegram-reminders-help" className={styles.help}>{!connected
      ? "Подключите Telegram, чтобы настроить и получать напоминания."
      : enabled ? "Настройки сохраняются автоматически." : "Все напоминания приостановлены. Ваши настройки сохранены."}</p>
    {!connected && onOpenConnections && <button type="button" className={styles.link} onClick={onOpenConnections}>Перейти к подключению аккаунтов</button>}
    {saveState && <div className={styles.feedback}>
      <p className={`${styles.status} ${saveState === "error" ? styles.error : ""}`} role={saveState === "error" ? "alert" : "status"}>
        {saving ? "Сохраняем…" : message}
      </p>
      {saveState === "error" && failedSettings && <button type="button" className={styles.link}
        onClick={() => save(failedSettings)}>Повторить сохранение</button>}
    </div>}

    <p className={styles.caption}>О чём напоминать</p>
    <div className={styles.card}>
      <ReminderSwitch title="Тренировки" description="Перед тренировкой по календарю" icon={Dumbbell}
        checked={draft.workoutEnabled} disabled={settingsDisabled} onClick={() => change("workoutEnabled", !draft.workoutEnabled)} />
      {draft.workoutEnabled && <div className={styles.details}>
        <p className={styles.label}>За сколько до начала</p>
        <div className={`${styles.options} ${styles.offsets}`} role="group" aria-label="Когда напоминать о тренировке">
          {WORKOUT_REMINDER_OFFSETS.map(hours => <button type="button" key={hours} aria-pressed={draft.offsets.includes(hours)}
            disabled={settingsDisabled} onClick={() => toggleOffset(hours)}>
            {draft.offsets.includes(hours) && <Check size={14} aria-hidden="true" />}{hours} ч
          </button>)}
        </div>
        <p className={styles.note}>Можно выбрать несколько. Дата и время — из календаря тренировок.</p>
      </div>}
    </div>
    <div className={styles.card}>
      <ReminderSwitch title="Фото прогресса" description="Напомнить сделать новые фото" icon={Camera}
        checked={draft.photoEnabled} disabled={settingsDisabled} onClick={() => change("photoEnabled", !draft.photoEnabled)} />
      {draft.photoEnabled && <div className={styles.details}>
        <p className={styles.label}>Повторять каждые</p>
        <PeriodOptions label="Период фото прогресса" value={draft.photoIntervalDays} disabled={settingsDisabled} onChange={value => change("photoIntervalDays", value)} />
      </div>}
    </div>
    <div className={styles.card}>
      <ReminderSwitch title="Замеры тела" description="Напомнить обновить замеры" icon={Ruler}
        checked={draft.measurementsEnabled} disabled={settingsDisabled} onClick={() => change("measurementsEnabled", !draft.measurementsEnabled)} />
      {draft.measurementsEnabled && <div className={styles.details}>
        <p className={styles.label}>Повторять каждые</p>
        <PeriodOptions label="Период замеров тела" value={draft.measurementsIntervalDays} disabled={settingsDisabled} onChange={value => change("measurementsIntervalDays", value)} />
      </div>}
    </div>
    {(draft.photoEnabled || draft.measurementsEnabled) && <div className={styles.card}>
      <label className={styles.timeRow} htmlFor="client-progress-reminder-time">
        <Clock3 size={20} aria-hidden="true" /><span>Время для фото и замеров</span>
        <input id="client-progress-reminder-time" type="time" value={timeDraft} disabled={settingsDisabled}
          onChange={event => setTimeDraft(event.target.value)} onBlur={saveTime} />
      </label>
      <p className={styles.timeHelp}>По Минску, UTC+3. Интервал считается от последнего фото или замера.</p>
    </div>}
    {connected && onTestReminder && <button type="button" className={styles.testButton} disabled={saving || testing} onClick={testReminder}>
      <Send size={18} aria-hidden="true" />{testing ? "Отправляем…" : "Отправить тестовое напоминание"}
    </button>}
    <p className={styles.help}>Сообщения от тренера и уведомления внутри приложения остаются доступными.</p>
  </section>;
}
