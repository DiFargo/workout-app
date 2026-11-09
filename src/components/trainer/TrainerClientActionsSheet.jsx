import { useId, useRef, useState } from "react";
import { Archive, ArchiveRestore, Bell, CalendarDays, ChevronDown, ChevronRight, Download, Dumbbell, FileText, FlaskConical, SlidersHorizontal, Trash2, UserRound } from "lucide-react";
import { useModalBackNavigation } from "../../shared/hooks/useModalBackNavigation";
import TrainerClientUtilitySheet from "./TrainerClientUtilitySheet";
import styles from "./TrainerClientActionsSheet.module.css";

const SUCCESS = {
  export_excel: "Таблица CSV скачана.",
  export_pdf: "Отчёт открыт. Его можно распечатать или сохранить в PDF.",
  mark_test: "Клиент отмечен как тестовый и не учитывается в общей статистике.",
  mark_real: "Тестовая отметка снята. Клиент снова учитывается в статистике.",
  archive: "Клиент убран в архив. История и программа сохранены.",
  restore: "Клиент возвращён в активный список.",
  delete: "Клиент удалён."
};

function ActionRow({ icon: Icon, title, description, onClick, disabled, danger = false, busy = false }) {
  return <button type="button" className={`${styles.row}${danger ? ` ${styles.danger}` : ""}`} onClick={onClick} disabled={disabled} aria-busy={busy || undefined}>
    <span className={styles.icon} aria-hidden="true"><Icon size={20} /></span>
    <span className={styles.copy}><strong>{busy ? "Выполняем…" : title}</strong><small>{description}</small></span>
    <ChevronRight className={styles.chevron} size={18} aria-hidden="true" />
  </button>;
}

export default function TrainerClientActionsSheet({ clientName, archived = false, isTest = false, canDeleteClient = false, basicWorkoutAccess = false, showSchedule = true, status = "", onAction, onClose }) {
  const id = useId();
  const busyRef = useRef(false);
  const [startingStatus, setStartingStatus] = useState(status);
  const [busyAction, setBusyAction] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [attemptedAction, setAttemptedAction] = useState("");
  const [observedStatus, setObservedStatus] = useState(status);
  const close = () => { if (!busyRef.current) onClose(); };
  useModalBackNavigation({ open: true, onBack: close });
  if (observedStatus !== status) {
    setObservedStatus(status);
    if (attemptedAction && status && status !== startingStatus) {
      // Remember server feedback so the same message survives an identical retry.
      setFeedback({ text: status, action: attemptedAction, error: false });
    }
  }

  async function perform(action) {
    if (busyRef.current) return;
    busyRef.current = true;
    setStartingStatus(status);
    setBusyAction(action);
    setAttemptedAction(action);
    setFeedback(current => current?.action === action ? current : null);
    try {
      const result = await onAction(action);
      if (result === true && SUCCESS[action]) setFeedback({ text: SUCCESS[action], action, error: false });
      // false/undefined may mean that the user cancelled a confirmation.
    } catch {
      setFeedback({ text: "Не удалось выполнить действие. Повторите попытку.", action, error: true });
    } finally {
      busyRef.current = false;
      setBusyAction("");
    }
  }

  function row(action, Icon, title, description, danger = false) {
    return <ActionRow key={action} icon={Icon} title={title} description={description} danger={danger} disabled={Boolean(busyAction)} busy={busyAction === action} onClick={() => void perform(action)} />;
  }

  return <TrainerClientUtilitySheet title="Управление клиентом" eyebrow={clientName} variant="clientActions" onRequestClose={close}>
    <div className={styles.root} data-testid="trainer-client-actions">
      <div className={styles.group} aria-label="Основные действия">
        {showSchedule ? row("open_calendar", CalendarDays, "Расписание и абонемент", "Даты тренировок и баланс занятий") : null}
        {row("open_notifications", Bell, "Напоминания", "Тренировки, фото и замеры")}
        {row("open_access_info", UserRound, "Данные для входа и связи", "Логин, почта и Telegram — без пароля")}
        {canDeleteClient ? row(basicWorkoutAccess ? "revoke_basic_access" : "grant_basic_access", Dumbbell, basicWorkoutAccess ? "Базовые тренировки: доступны" : "Открыть базовые тренировки", basicWorkoutAccess ? "Отключить самостоятельный режим · история сохранится" : "Разрешить режим «Сейчас» и «На месяц» · только администратор") : null}
      </div>
      <details className={styles.more}>
        <summary aria-controls={`${id}-extra`}>
          <SlidersHorizontal size={20} aria-hidden="true" />
          <span><strong>Дополнительно</strong><small>Отчёты и тестовая отметка</small></span>
          <ChevronDown className={styles.disclosureIcon} size={18} aria-hidden="true" />
        </summary>
        <div id={`${id}-extra`} className={styles.group}>
          {row("export_excel", Download, "Скачать таблицу CSV", "Тренировки, питание и замеры")}
          {row("export_pdf", FileText, "Отчёт для печати / PDF", "Открыть отчёт и сохранить через печать")}
          {row(isTest ? "mark_real" : "mark_test", FlaskConical, isTest ? "Снять тестовую отметку" : "Отметить как тестового", isTest ? "Снова учитывать клиента в статистике" : "Исключить клиента из общей статистики")}
          {canDeleteClient ? row("delete", Trash2, "Удалить клиента", "Удаление аккаунта и данных · только администратор", true) : null}
        </div>
      </details>
      <div className={styles.archive}>
        {row(archived ? "restore" : "archive", archived ? ArchiveRestore : Archive, archived ? "Восстановить клиента" : "Архивировать клиента", archived ? "Вернуть в активный список" : "Отключить доступ, сохранив историю и программу")}
      </div>
      {!busyAction && feedback ? <p className={`${styles.feedback}${feedback.error ? ` ${styles.error}` : ""}`} role={feedback.error ? "alert" : "status"}>{feedback.text}</p> : null}
    </div>
  </TrainerClientUtilitySheet>;
}
