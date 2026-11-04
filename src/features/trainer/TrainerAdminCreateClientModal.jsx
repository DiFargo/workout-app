import { X } from "lucide-react";
import { createPortal } from "react-dom";
import { useState } from "react";
import { buildTrainerInviteMessage } from "./trainerInviteMessage.js";
import TrainerClientInviteReady, { TrainerClientInviteSendAction } from "./TrainerClientInviteReady.jsx";
import { useTrainerInviteSubmission } from "./useTrainerInviteSubmission.js";
import styles from "./TrainerAdminCreateClientModal.module.css";

export default function TrainerAdminCreateClientModal({
  adminCreateUserLoading,
  adminCreateUserStatus,
  adminCreatedCredentials,
  adminNewUserEmail,
  adminNewUserName,
  createUserFromAdminPanel,
  setAdminCreateClientModalOpen,
  setAdminNewUserEmail,
  setAdminNewUserName
}) {
  const [telegramUsername, setTelegramUsername] = useState("");
  const { submit, submitting, error } = useTrainerInviteSubmission({ credentials: adminCreatedCredentials, loading: adminCreateUserLoading, onSubmit: createUserFromAdminPanel });
  const inviteMessage = adminCreatedCredentials
    ? buildTrainerInviteMessage({
        login: adminCreatedCredentials.existingAccount ? "" : adminCreatedCredentials.login || adminCreatedCredentials.email,
        inviteUrl: adminCreatedCredentials.shareUrl || adminCreatedCredentials.inviteUrl,
        botStartUrl: adminCreatedCredentials.botStartUrl
      })
    : "";
  const modal = (
    <div
      className={styles.backdrop} data-modal-backdrop="true"
      data-trainer-modal-backdrop="true"
      role="presentation"
      onMouseDown={(event) => {
        if (!submitting && event.target === event.currentTarget) setAdminCreateClientModalOpen(false);
      }}
    >
      <section
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="trainer-create-client-modal-title"
        data-modal-surface="true"
        data-trainer-modal-surface="true"
        data-trainer-modal-frame="true"
      >
        <header className={styles.header} data-trainer-modal-header="true">
          <div>
            <span>КЛИЕНТЫ</span>
            <h2 id="trainer-create-client-modal-title">{adminCreatedCredentials ? "Отправить приглашение" : "Пригласить клиента"}</h2>
            <p>{adminCreatedCredentials ? "Откроется готовое сообщение. Нажми «Отправить» в Telegram." : "Создай приглашение, затем отправь клиенту готовое сообщение в Telegram."}</p>
          </div>
          <button type="button" disabled={submitting} onClick={() => setAdminCreateClientModalOpen(false)} aria-label="Закрыть создание клиента">
            <X size={20} />
          </button>
        </header>

        {adminCreatedCredentials ? <div className={styles.content} data-trainer-modal-content="true"><TrainerClientInviteReady credentials={adminCreatedCredentials} message={inviteMessage} /></div> : (
        <form id="trainer-create-client-form" className={styles.content} data-trainer-modal-content="true" onSubmit={event => submit(event, telegramUsername)}>
          <label>
            <span>Имя клиента</span>
            <input
              value={adminNewUserName}
              disabled={submitting}
              onChange={(event) => setAdminNewUserName(event.target.value)}
              placeholder="Например: Иван"
            />
          </label>

          <label>
            <span>Ник в Telegram</span>
            <input
              value={telegramUsername}
              disabled={submitting}
              onChange={(event) => setTelegramUsername(event.target.value)}
              placeholder="@username"
              type="text"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck="false"
            />
          </label>
          <p className={styles.hint}>Укажи ник, чтобы подготовить персональную ссылку. Логин можно оставить пустым — он создастся автоматически.</p>

          <label>
            <span>Логин</span>
            <input
              value={adminNewUserEmail}
              disabled={submitting}
              onChange={(event) => setAdminNewUserEmail(event.target.value)}
              placeholder="например: ilya.fit"
              type="text"
              autoComplete="off"
            />
          </label>

          {error || adminCreateUserStatus ? <p className={styles.status} role="alert">{error || adminCreateUserStatus}</p> : null}
        </form>)}

        <footer className={styles.footer} data-trainer-modal-footer="true">
          {adminCreatedCredentials ? <TrainerClientInviteSendAction credentials={adminCreatedCredentials} message={inviteMessage} /> : <button type="submit" form="trainer-create-client-form" disabled={submitting}>
            {submitting ? "Создаём приглашение…" : "Создать приглашение"}
          </button>}
        </footer>
      </section>
    </div>
  );

  return typeof document === "undefined" ? modal : createPortal(modal, document.body);
}
