import { useEffect, useState } from "react";

const FEEDBACK_TYPES = [
  { id: "bug", label: "Ошибка", hint: "Что сломалось или работает странно" },
  { id: "review", label: "Отзыв", hint: "Что нравится или мешает пользоваться" },
  { id: "idea", label: "Идея", hint: "Как можно улучшить приложение" },
  { id: "recommendation", label: "Рекомендация", hint: "Что стоит добавить в MVP" }
];

const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

const INITIAL_DRAFT = {
  type: "bug",
  message: "",
  contact: "",
  attachmentFile: null
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

  useEffect(() => {
    if (!open) return;
    setDraft({ ...INITIAL_DRAFT, contact: defaultContact });
    setStatus("");
  }, [defaultContact, open]);

  if (!open) {
    return null;
  }

  const selectedType = FEEDBACK_TYPES.find((type) => type.id === draft.type) || FEEDBACK_TYPES[0];
  const trimmedMessage = draft.message.trim();
  const saving = status === "saving";

  function handleAttachmentChange(event) {
    const file = event.target.files?.[0] || null;

    if (!file) {
      setDraft((current) => ({ ...current, attachmentFile: null }));
      return;
    }

    if (file.size > MAX_ATTACHMENT_BYTES) {
      event.target.value = "";
      setStatus("Файл слишком большой. Можно прикрепить файл до 25 МБ.");
      return;
    }

    setDraft((current) => ({ ...current, attachmentFile: file }));
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
        attachmentFile: draft.attachmentFile
      });
      setStatus("Спасибо, отправлено. Мы это увидим.");
      window.setTimeout(onClose, 850);
    } catch {
      setStatus("Не получилось отправить. Проверь интернет и попробуй ещё раз.");
    }
  }

  return (
    <div className="cabinetUtilityModalOverlay profileFeedbackOverlay" role="presentation" onClick={saving ? undefined : onClose}>
      <form
        className="cabinetUtilityModal profileFeedbackModal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="profileFeedbackTitle"
        onClick={(event) => event.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <header className="cabinetUtilityModalHead profileFeedbackHead">
          <div>
            <span>ОБРАТНАЯ СВЯЗЬ</span>
            <h2 id="profileFeedbackTitle">Сообщить нам</h2>
          </div>
          <button type="button" aria-label="Закрыть обратную связь" disabled={saving} onClick={onClose}>
            ×
          </button>
        </header>

        <div className="cabinetUtilityModalBody profileFeedbackBody">
          <div className="profileFeedbackTypeGrid" role="group" aria-label="Тип сообщения">
            {FEEDBACK_TYPES.map((type) => (
              <button
                key={type.id}
                type="button"
                className={draft.type === type.id ? "active" : ""}
                aria-pressed={draft.type === type.id}
                onClick={() => {
                  setDraft((current) => ({ ...current, type: type.id }));
                  setStatus("");
                }}
              >
                <strong>{type.label}</strong>
                <small>{type.hint}</small>
              </button>
            ))}
          </div>

          <label className="profileFeedbackField">
            <span>{selectedType.label}</span>
            <textarea
              value={draft.message}
              rows={6}
              maxLength={1200}
              placeholder="Опиши, что произошло, что стоит улучшить или какую идею хочешь предложить."
              disabled={saving}
              onChange={(event) => {
                setDraft((current) => ({ ...current, message: event.target.value }));
                setStatus("");
              }}
            />
            <small>{draft.message.length}/1200</small>
          </label>

          <label className="profileFeedbackField compact">
            <span>Контакт для ответа</span>
            <input
              value={draft.contact}
              maxLength={120}
              placeholder="Почта или Telegram, можно оставить пустым"
              disabled={saving}
              onChange={(event) => setDraft((current) => ({ ...current, contact: event.target.value }))}
            />
          </label>

          <div className="profileFeedbackAttachment">
            <label>
              <input
                type="file"
                accept="image/*,video/*,.pdf,.txt,.log"
                disabled={saving}
                onChange={handleAttachmentChange}
              />
              <span>📎 Прикрепить файл</span>
              <small>Скрин, фото, видео или лог до 25 МБ</small>
            </label>
            {draft.attachmentFile ? (
              <div className="profileFeedbackAttachmentFile">
                <span>{draft.attachmentFile.name}</span>
                <small>{formatAttachmentSize(draft.attachmentFile.size)}</small>
                <button
                  type="button"
                  aria-label="Убрать вложение"
                  disabled={saving}
                  onClick={() => setDraft((current) => ({ ...current, attachmentFile: null }))}
                >
                  ×
                </button>
              </div>
            ) : null}
          </div>

          {status ? (
            <p className={status === "saving" ? "profileFeedbackStatus" : "profileFeedbackStatus visible"}>
              {status === "saving" ? "Отправляю..." : status}
            </p>
          ) : null}
        </div>

        <button
          type="submit"
          className="profileFeedbackSubmit"
          disabled={saving || trimmedMessage.length < 8}
        >
          {saving ? "Отправляю..." : "Отправить"}
        </button>
      </form>
    </div>
  );
}
