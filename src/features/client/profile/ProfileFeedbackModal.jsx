import { useState } from "react";
import { Bug, Lightbulb, MessageCircle, Paperclip, Sparkles } from "lucide-react";
import ClientPageHeader from "../../../shared/ui/ClientPageHeader";
import ProfileModalCloseButton from "./ProfileModalCloseButton";
import styles from "./ProfileFeedbackModal.module.css";
import { mergeFeedbackFiles, validateFeedbackFiles } from "../../../utils/feedbackAttachments.js";

const FEEDBACK_TYPES = [
  { id: "bug", label: "Ошибка", hint: "Что работает странно", icon: Bug },
  { id: "review", label: "Отзыв", hint: "Что нравится или мешает", icon: MessageCircle },
  { id: "idea", label: "Идея", hint: "Как улучшить приложение", icon: Lightbulb },
  { id: "recommendation", label: "Предложение", hint: "Чего не хватает", icon: Sparkles }
];

const INITIAL_DRAFT = {
  type: "bug",
  message: "",
  contact: "",
  attachmentFiles: []
};

function formatAttachmentSize(size) {
  if (!Number.isFinite(size) || size <= 0) return "";
  if (size >= 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} МБ`;
  if (size >= 1024) return `${Math.ceil(size / 1024)} КБ`;
  return `${size} Б`;
}

export default function ProfileFeedbackModal({
  open,
  defaultContact = "",
  onClose,
  onSubmit
}) {
  const [draft, setDraft] = useState(() => ({ ...INITIAL_DRAFT, contact: defaultContact }));
  const [status, setStatus] = useState("");

  if (!open) {
    return null;
  }

  const selectedType = FEEDBACK_TYPES.find((type) => type.id === draft.type) || FEEDBACK_TYPES[0];
  const trimmedMessage = draft.message.trim();
  const saving = status === "saving";

  function handleAttachmentChange(event) {
    const files = mergeFeedbackFiles(draft.attachmentFiles, [...(event.target.files || [])]);
    event.target.value = "";
    const error = validateFeedbackFiles(files);
    if (error) { setStatus(error); return; }
    setDraft((current) => ({ ...current, attachmentFiles: files }));
    setStatus("");
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (saving) return;

    if (trimmedMessage.length < 8) {
      setStatus("Напиши чуть подробнее, чтобы мы точно поняли мысль.");
      return;
    }

    setStatus("saving");

    try {
      await onSubmit({
        type: draft.type,
        typeLabel: selectedType.label,
        message: trimmedMessage,
        contact: draft.contact.trim(),
        attachmentFiles: draft.attachmentFiles
      });
      setDraft({ ...INITIAL_DRAFT, contact: defaultContact });
      setStatus("Отправлено администратору. Спасибо!");
      window.setTimeout(onClose, 850);
    } catch {
      setStatus("Не получилось отправить. Проверь интернет и попробуй ещё раз.");
    }
  }

  return (
    <div
      className={styles.overlay} data-modal-backdrop="true"
      data-testid="profile-feedback-overlay"
      data-css-module-scope="profile-feedback"
      role="presentation"
      onClick={saving ? undefined : onClose}
    >
      <form
        className={styles.dialog}
        data-testid="profile-feedback-dialog"
        role="dialog"
        aria-modal="true"
        data-modal-surface="true"
        data-cabinet-sheet="true"
        aria-labelledby="profileFeedbackTitle"
        onClick={(event) => event.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <ClientPageHeader
          compact
          embedded
          controlsVariant="workout"
          frameClassName={styles.headerFrame}
          className={styles.header}
          title="Обратная связь"
          titleId="profileFeedbackTitle"
          eyebrow="Сообщить нам"
          actions={(
            <ProfileModalCloseButton
              testId="profile-feedback-close"
              className={styles.closeButton}
              ariaLabel="Закрыть обратную связь"
              disabled={saving}
              onClick={onClose}
            />
          )}
          scope="profile-feedback-header"
        />

        <div className={styles.body}>
          <p className={styles.recipient}>Сообщение получит администратор приложения.</p>
          <div className={styles.typeGrid} role="group" aria-label="Тип сообщения">
            {FEEDBACK_TYPES.map((type) => {
              const TypeIcon = type.icon;
              return (
              <button
                key={type.id}
                type="button"
                className={`${styles.typeButton} ${draft.type === type.id ? styles.activeType : ""}`}
                data-testid="profile-feedback-type"
                aria-pressed={draft.type === type.id}
                disabled={saving}
                title={type.hint}
                onClick={() => {
                  setDraft((current) => ({ ...current, type: type.id }));
                  setStatus("");
                }}
              >
                <span className={styles.typeIcon} aria-hidden="true"><TypeIcon /></span>
                <span className={styles.typeCopy}>
                  <strong className={styles.typeTitle}>{type.label}</strong>
                  <small className={styles.typeHint}>{type.hint}</small>
                </span>
              </button>
              );
            })}
          </div>

          <div className={styles.attachment}>
            <label className={styles.attachmentPicker}>
              <input className={styles.fileInput} type="file" multiple
                accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime,.pdf,.txt,.log"
                disabled={saving} onChange={handleAttachmentChange} />
              <span className={styles.attachmentTitle}><Paperclip size={17} aria-hidden="true" /> Прикрепить файлы</span>
              <small className={styles.attachmentHint}>До 5 файлов · каждый меньше 25 МБ · всего до 50 МБ</small>
            </label>
            {draft.attachmentFiles.map((file, index) => <div className={styles.attachmentFile} key={`${file.name}:${file.size}:${index}`}>
              <span className={styles.fileName}>{file.name}</span>
              <small className={styles.fileSize}>{formatAttachmentSize(file.size)}</small>
              <button className={styles.removeAttachment} type="button" aria-label={`Убрать вложение ${file.name}`} disabled={saving}
                onClick={() => setDraft(current => ({ ...current, attachmentFiles: current.attachmentFiles.filter((_, position) => position !== index) }))}>×</button>
            </div>)}
          </div>

          <label className={styles.field}>
            <span className={styles.fieldLabel}>Сообщение</span>
            <textarea
              className={styles.textarea}
              value={draft.message}
              rows={4}
              maxLength={1200}
              placeholder="Опиши, что произошло, что стоит улучшить или какую идею хочешь предложить."
              disabled={saving}
              onChange={(event) => {
                setDraft((current) => ({ ...current, message: event.target.value }));
                setStatus("");
              }}
            />
            <small className={styles.counter}>{draft.message.length}/1200</small>
          </label>

          <details className={styles.contactDetails}>
          <summary>Контакт для ответа <small>{draft.contact || "Не указан"}</small></summary>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Контакт для ответа</span>
            <input
              className={styles.input}
              value={draft.contact}
              maxLength={120}
              placeholder="Почта или Telegram, можно оставить пустым"
              disabled={saving}
              onChange={(event) => setDraft((current) => ({ ...current, contact: event.target.value }))}
            />
          </label>
          </details>

          {status ? (
            <p className={`${styles.status} ${status === "saving" ? "" : styles.visibleStatus}`} role="status" aria-live="polite">
              {status === "saving" ? "Отправляю..." : status}
            </p>
          ) : null}
        </div>

        <button
          type="submit"
          className={styles.submit}
          disabled={saving || trimmedMessage.length < 8}
        >
          {saving ? "Отправляю..." : "Отправить"}
        </button>
      </form>
    </div>
  );
}
