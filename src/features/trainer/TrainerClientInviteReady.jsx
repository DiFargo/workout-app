import { Check, Copy, Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { buildTrainerTelegramChatUrl } from "./trainerInviteMessage.js";
import styles from "./TrainerClientInviteReady.module.css";

export default function TrainerClientInviteReady({ credentials, message }) {
  const title = useRef(null);
  const [copyStatus, setCopyStatus] = useState("");
  useEffect(() => { title.current?.focus(); }, []);

  async function copyInvitation() {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("clipboard_unavailable");
      await navigator.clipboard.writeText(message);
      setCopyStatus("Приглашение скопировано");
    } catch {
      setCopyStatus("Не удалось скопировать. Открой ссылку ниже и скопируй её вручную.");
    }
  }

  const link = credentials.botStartUrl || credentials.shareUrl || credentials.activationUrl || credentials.inviteUrl || "";
  return (
    <section className={styles.ready} data-testid="trainer-invite-ready">
      <div className={styles.confirmation}>
        <span className={styles.successIcon} aria-hidden="true"><Check size={24} /></span>
        <h3 ref={title} tabIndex={-1}>Приглашение готово</h3>
        <p>{credentials.telegramUsername
          ? "Открой Telegram и отправь клиенту подготовленное сообщение."
          : "Скопируй приглашение и передай его клиенту."}</p>
      </div>
      <dl className={styles.client}>
        {credentials.name ? <div><dt>Клиент</dt><dd>{credentials.name}</dd></div> : null}
        {credentials.telegramUsername ? <div><dt>Telegram</dt><dd>@{credentials.telegramUsername.replace(/^@/, "")}</dd></div> : null}
      </dl>
      {credentials.existingAccount ? <p className={styles.note}>Клиент войдёт в свой существующий аккаунт. Его данные сохранятся.</p> : null}
      <button className={styles.copyButton} type="button" onClick={copyInvitation}>
        <Copy size={18} aria-hidden="true" />Скопировать приглашение
      </button>
      <p className={styles.feedback} role="status" aria-live="polite">{copyStatus}</p>
      <details className={styles.details}>
        <summary>{credentials.existingAccount ? "Ссылка приглашения" : "Запасной вход"}</summary>
        {!credentials.existingAccount && (credentials.login || credentials.email) ? <p>Логин: <strong>{credentials.login || credentials.email}</strong></p> : null}
        <p className={styles.note}>Ссылка для входа и принятия приглашения:</p>
        <code>{link}</code>
      </details>
    </section>
  );
}

export function TrainerClientInviteSendAction({ credentials, message }) {
  const url = buildTrainerTelegramChatUrl(credentials.telegramUsername, message);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  if (url) return (
    <a className={styles.primaryAction} href={url} target="_blank" rel="noopener noreferrer">
      <Send size={19} aria-hidden="true" />Отправить в Telegram
    </a>
  );
  return <>
    <button className={styles.primaryAction} type="button" onClick={async () => {
      try {
        if (!navigator.clipboard?.writeText) throw new Error("clipboard_unavailable");
        await navigator.clipboard.writeText(message);
        setCopied(true);
        setError("");
      } catch { setError("Не удалось скопировать. Ссылка доступна выше."); }
    }}>{copied ? <Check size={19} aria-hidden="true" /> : <Copy size={19} aria-hidden="true" />}{copied ? "Приглашение скопировано" : "Скопировать приглашение"}</button>
    {error ? <p className={styles.feedback} role="status">{error}</p> : null}
  </>;
}
