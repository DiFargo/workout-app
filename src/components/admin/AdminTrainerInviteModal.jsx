import { useRef, useState } from "react";
import { Check, Copy, Link2, UserPlus, X } from "lucide-react";
import { createPortal } from "react-dom";
import { useModalBackNavigation } from "../../shared/hooks/useModalBackNavigation.js";
import styles from "./AdminTrainerInviteModal.module.css";

function getInviteUrl(invite) {
  return String(invite?.shareUrl || invite?.activationUrl || invite?.inviteUrl || "").trim();
}

/**
 * Admin-only account creation sheet. It never creates a client or attaches a
 * trainer to client data: the API called by its parent creates a trainer invite.
 */
export default function AdminTrainerInviteModal(props) {
  // A new opening is a new form session, not a reset performed after paint.
  return props.open ? <AdminTrainerInviteForm {...props} /> : null;
}

function AdminTrainerInviteForm({
  createdInvite,
  isSubmitting = false,
  onClose,
  onSubmit,
  status = ""
}) {
  const [name, setName] = useState("");
  const [login, setLogin] = useState("");
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState("");
  const [localPending, setLocalPending] = useState(false);
  const [localError, setLocalError] = useState("");
  const pending = useRef(false);
  const busy = isSubmitting || localPending;
  const inviteUrl = getInviteUrl(createdInvite);
  const isCreated = Boolean(createdInvite && inviteUrl);
  const close = () => { if (!busy && !pending.current) onClose?.(); };
  useModalBackNavigation({ open: true, onBack: close });

  const copyInviteLink = async () => {
    if (!inviteUrl) return;

    try {
      if (typeof navigator === "undefined" || typeof navigator.clipboard?.writeText !== "function") {
        throw new Error("clipboard_unavailable");
      }
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setCopyError("");
    } catch {
      setCopied(false);
      setCopyError("Не удалось скопировать автоматически. Выделите и скопируйте ссылку вручную.");
    }
  };

  const modal = (
    <div
      className={styles.backdrop} data-modal-backdrop="true"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <section
        aria-labelledby="admin-trainer-invite-title"
        aria-modal="true"
        className={styles.modal}
        role="dialog"
        onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); close(); } }}
      >
        <header className={styles.header}>
          <span className={styles.icon} aria-hidden="true"><UserPlus size={22} strokeWidth={2} /></span>
          <div className={styles.headerCopy}>
            <p>Новый тренер</p>
            <h2 id="admin-trainer-invite-title">Пригласить тренера</h2>
            <span>Тренер сам задаст пароль по ссылке и получит отдельный рабочий кабинет.</span>
          </div>
          <button aria-label="Закрыть" disabled={busy} type="button" onClick={close}>
            <X size={22} strokeWidth={2.2} />
          </button>
        </header>

        {isCreated ? (
          <div className={styles.successContent}>
            <span className={styles.successIcon} aria-hidden="true"><Check size={24} strokeWidth={2.4} /></span>
            <div>
              <h3>Приглашение готово</h3>
              <p>Передайте тренеру ссылку ниже — автоматически она не отправляется. Аккаунт ожидает активации, клиенты ему ещё не назначены.</p>
            </div>
            <div className={styles.credentials}>
              <span>Логин</span>
              <strong>{createdInvite.login || login}</strong>
              <span>Ссылка активации</span>
              <input aria-label="Ссылка активации для ручного копирования" readOnly value={inviteUrl} onFocus={(event) => event.target.select()} />
              <button type="button" onClick={copyInviteLink}>
                {copied ? <Check aria-hidden="true" size={17} strokeWidth={2.2} /> : <Copy aria-hidden="true" size={17} strokeWidth={2} />}
                {copied ? "Ссылка скопирована" : "Скопировать ссылку"}
              </button>
              {copyError ? <p role="status">{copyError}</p> : null}
            </div>
          </div>
        ) : (
          <form
            className={styles.content}
            id="admin-trainer-invite-form"
            onSubmit={async (event) => {
              event.preventDefault();
              if (busy || pending.current || typeof onSubmit !== "function") return;
              if (!name.trim()) { setLocalError("Укажите имя тренера."); return; }
              if (!/^[a-z0-9._-]{3,32}$/.test(login.trim())) { setLocalError("Логин: 3–32 символа, латиница, цифры, точка, дефис или _."); return; }
              pending.current = true;
              setLocalPending(true);
              setLocalError("");
              try { await onSubmit({ login: login.trim(), name: name.trim() }); }
              catch { setLocalError("Не удалось создать приглашение. Проверьте подключение и повторите попытку."); }
              finally { pending.current = false; setLocalPending(false); }
            }}
          >
            <label>
              <span id="admin-trainer-name-label">Имя тренера</span>
              <input
                aria-labelledby="admin-trainer-name-label"
                autoComplete="name"
                disabled={busy}
                placeholder="Например: Мария"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            <label>
              <span id="admin-trainer-login-label">Логин для входа</span>
              <input
                aria-labelledby="admin-trainer-login-label"
                aria-describedby="admin-trainer-login-help"
                autoCapitalize="none"
                autoComplete="username"
                disabled={busy}
                placeholder="Например: maria.fit"
                spellCheck="false"
                value={login}
                onChange={(event) => setLogin(event.target.value.toLowerCase())}
              />
              <small id="admin-trainer-login-help">От 3 до 32 символов: латиница, цифры, точка, дефис или _.</small>
            </label>
            {localError || status ? <p className={styles.status} role="alert">{localError || status}</p> : null}
          </form>
        )}

        <footer className={styles.footer}>
          {isCreated ? (
            <button className={styles.primaryButton} type="button" onClick={close}>Готово</button>
          ) : (
            <button className={styles.primaryButton} disabled={busy || typeof onSubmit !== "function"} form="admin-trainer-invite-form" type="submit">
              <Link2 aria-hidden="true" size={18} strokeWidth={2.1} />
              {busy ? "Создаём приглашение…" : "Создать приглашение"}
            </button>
          )}
        </footer>
      </section>
    </div>
  );

  return typeof document === "undefined" ? modal : createPortal(modal, document.body);
}
