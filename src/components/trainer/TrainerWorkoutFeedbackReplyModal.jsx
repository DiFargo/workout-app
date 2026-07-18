import { useEffect, useRef } from "react";
import { Check, CircleAlert, LoaderCircle, Mail, PencilLine, X } from "lucide-react";

function formatContextDate(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "Дата не указана";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function getMessageStatus(message = {}) {
  if (message.readAt || message.clientReadAt) return "Прочитано";
  if (message.status === "error") return "Ошибка отправки";
  return "Отправлено";
}

export default function TrainerWorkoutFeedbackReplyModal({
  styles,
  clientName,
  sourceNote,
  value,
  sending,
  resolving = false,
  processed = false,
  status,
  messages = [],
  onChange,
  onSubmit,
  onMarkProcessed,
  onRequestClose,
  onAdjustWorkout
}) {
  const textareaRef = useRef(null);
  const isReply = Boolean(sourceNote);
  const canSend = value.trim().length >= 3 && !sending && !resolving;

  useEffect(() => {
    const focusTimer = window.setTimeout(() => textareaRef.current?.focus(), 100);
    return () => window.clearTimeout(focusTimer);
  }, []);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        onRequestClose();
        return;
      }
      if (event.key === "Enter" && (event.ctrlKey || event.metaKey) && canSend) {
        event.preventDefault();
        onSubmit();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [canSend, onRequestClose, onSubmit]);

  const linkedMessages = sourceNote
    ? messages.filter((message) => (
      message.replyContext?.sourceCommentId === sourceNote.id ||
      message.sourceCommentId === sourceNote.id
    ))
    : messages;

  return (
    <div className={styles.backdrop} role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onRequestClose();
    }}>
      <section className={styles.modal} role="dialog" aria-modal="true" data-modal-surface="true" aria-labelledby="trainer-feedback-reply-title">
        <header className={styles.header}>
          <div>
            <span>{isReply ? "ОТВЕТ НА КОММЕНТАРИЙ" : "СООБЩЕНИЕ КЛИЕНТУ"}</span>
            <h2 id="trainer-feedback-reply-title">{isReply ? "Ответ клиенту" : clientName}</h2>
            {isReply ? <p><strong>{clientName}</strong><small>{sourceNote.workoutName || sourceNote.title} · {formatContextDate(sourceNote.date)}</small></p> : null}
          </div>
          <button type="button" onClick={onRequestClose} aria-label="Закрыть"><X size={17} /></button>
        </header>

        {sourceNote ? (
          <section className={styles.sourceCard}>
            <span>Комментарий клиента</span>
            <blockquote>{sourceNote.text}</blockquote>
            {sourceNote.exerciseName ? <small>Упражнение: {sourceNote.exerciseName}</small> : null}
          </section>
        ) : null}

        {linkedMessages.length ? (
          <section className={styles.history}>
            <h3>{isReply ? "История ответов" : "Последние сообщения"}</h3>
            <div>
              {linkedMessages.slice(-4).map((message) => (
                <article key={message.id}>
                  <p>{message.text}</p>
                  <small>Тренер · {formatContextDate(message.sentAt)} · {getMessageStatus(message)}</small>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        <label className={styles.replyField}>
          <span>{isReply ? "Ваш ответ *" : "Сообщение *"}</span>
          <textarea
            ref={textareaRef}
            autoFocus
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder={isReply
              ? "Напишите рекомендацию, уточняющий вопрос или комментарий"
              : "Напишите сообщение клиенту"}
            rows={5}
          />
          <small>Ctrl + Enter — отправить · Enter — новая строка</small>
        </label>

        {status ? (
          <p className={`${styles.status} ${styles[status] || ""}`} role="status">
            {status === "sending" ? <LoaderCircle size={15} /> : null}
            {status === "resolving" ? <LoaderCircle size={15} /> : null}
            {status === "sent" ? <Check size={15} /> : null}
            {status === "processed" ? <Check size={15} /> : null}
            {status === "error" ? <CircleAlert size={15} /> : null}
            {status === "resolve_error" ? <CircleAlert size={15} /> : null}
            {status === "sending"
              ? "Ответ отправляется…"
              : status === "resolving"
                ? "Отмечаем сообщение обработанным…"
                : status === "sent"
                  ? "Ответ отправлен"
                  : status === "processed"
                    ? "Сообщение отмечено обработанным"
                    : status === "resolve_error"
                      ? "Не удалось отметить сообщение. Попробуйте ещё раз."
                      : "Не удалось отправить. Текст сохранён — попробуйте ещё раз."}
          </p>
        ) : null}

        {sourceNote && onAdjustWorkout ? (
          <button className={styles.adjustButton} type="button" onClick={onAdjustWorkout}>
            <PencilLine size={16} />Скорректировать следующую тренировку
          </button>
        ) : null}

        <footer className={styles.footer}>
          <button type="button" onClick={onRequestClose}>Отмена</button>
          {sourceNote && onMarkProcessed && !processed ? (
            <button
              className={styles.markProcessedButton}
              type="button"
              disabled={sending || resolving}
              onClick={onMarkProcessed}
            >
              {resolving ? <LoaderCircle className={styles.spinner} size={16} /> : <Check size={16} />}
              {resolving ? "Отмечаем…" : "Отметить обработанным"}
            </button>
          ) : null}
          <button className={styles.sendButton} type="button" disabled={!canSend} onClick={onSubmit}>
            {sending ? <LoaderCircle className={styles.spinner} size={16} /> : <Mail size={16} />}
            {sending ? "Отправляется…" : "Отправить"}
          </button>
        </footer>
      </section>
    </div>
  );
}
