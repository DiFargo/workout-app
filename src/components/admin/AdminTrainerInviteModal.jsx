import { useEffect, useState } from "react";
import { Check, Copy, Link2, UserPlus, X } from "lucide-react";
import { createPortal } from "react-dom";
import styles from "./AdminTrainerInviteModal.module.css";

function getInviteUrl(invite) {
  return String(invite?.shareUrl || invite?.activationUrl || invite?.inviteUrl || "").trim();
}

/**
 * Admin-only account creation sheet. It never creates a client or attaches a
 * trainer to client data: the API called by its parent creates a trainer invite.
 */
export default function AdminTrainerInviteModal({
  createdInvite,
  isSubmitting = false,
  onClose,
  onSubmit,
  open = false,
  status = ""
}) {
  const [name, setName] = useState("");
  const [login, setLogin] = useState("");
  const [copied, setCopied] = useState(false);
  const inviteUrl = getInviteUrl(createdInvite);
  const isCreated = Boolean(createdInvite && inviteUrl);

  useEffect(() => {
    if (!open) return;

    setName("");
    setLogin("");
    setCopied(false);
  }, [open]);

  useEffect(() => {
    if (!open || typeof window === "undefined") return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape" && !isSubmitting) onClose?.();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isSubmitting, onClose, open]);

  if (!open) return null;

  const copyInviteLink = async () => {
    if (!inviteUrl) return;

    try {
      await navigator.clipboard?.writeText(inviteUrl);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const modal = (
    <div
      className={styles.backdrop}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSubmitting) onClose?.();
      }}
    >
      <section
        aria-labelledby="admin-trainer-invite-title"
        aria-modal="true"
        className={styles.modal}
        role="dialog"
      >
        <header className={styles.header}>
          <span className={styles.icon} aria-hidden="true"><UserPlus size={22} strokeWidth={2} /></span>
          <div className={styles.headerCopy}>
            <p>Новый тренер</p>
            <h2 id="admin-trainer-invite-title">Пригласить тренера</h2>
            <span>Тренер сам задаст пароль по ссылке и получит отдельный рабочий кабинет.</span>
          </div>
          <button aria-label="Закрыть" disabled={isSubmitting} type="button" onClick={onClose}>
            <X size={22} strokeWidth={2.2} />
          </button>
        </header>

        {isCreated ? (
          <div className={styles.successContent}>
            <span className={styles.successIcon} aria-hidden="true"><Check size={24} strokeWidth={2.4} /></span>
            <div>
              <h3>Приглашение готово</h3>
              <p>Передайте тренеру ссылку ниже. Его аккаунт появится в списке с пометкой «Ожидает активации».</p>
            </div>
            <div className={styles.credentials}>
              <span>Логин</span>
              <strong>{createdInvite.login || login}</strong>
              <span>Ссылка активации</span>
              <code>{inviteUrl}</code>
              <button type="button" onClick={copyInviteLink}>
                {copied ? <Check aria-hidden="true" size={17} strokeWidth={2.2} /> : <Copy aria-hidden="true" size={17} strokeWidth={2} />}
                {copied ? "Ссылка скопирована" : "Скопировать ссылку"}
              </button>
            </div>
          </div>
        ) : (
          <form
            className={styles.content}
            id="admin-trainer-invite-form"
            onSubmit={(event) => {
              event.preventDefault();
              onSubmit?.({ login, name });
            }}
          >
            <label>
              <span>Имя тренера</span>
              <input
                autoComplete="name"
                disabled={isSubmitting}
                placeholder="Например: Мария"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            <label>
              <span>Логин для входа</span>
              <input
                autoCapitalize="none"
                autoComplete="username"
                disabled={isSubmitting}
                placeholder="Например: maria.fit"
                spellCheck="false"
                value={login}
                onChange={(event) => setLogin(event.target.value.toLowerCase())}
              />
              <small>От 3 до 32 символов: латиница, цифры, точка, дефис или _.</small>
            </label>
            {status ? <p className={styles.status} role="alert">{status}</p> : null}
          </form>
        )}

        <footer className={styles.footer}>
          {isCreated ? (
            <button className={styles.primaryButton} type="button" onClick={onClose}>Готово</button>
          ) : (
            <button className={styles.primaryButton} disabled={isSubmitting} form="admin-trainer-invite-form" type="submit">
              <Link2 aria-hidden="true" size={18} strokeWidth={2.1} />
              {isSubmitting ? "Создаём приглашение…" : "Создать приглашение"}
            </button>
          )}
        </footer>
      </section>
    </div>
  );

  return typeof document === "undefined" ? modal : createPortal(modal, document.body);
}
