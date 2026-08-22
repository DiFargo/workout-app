import { X } from "lucide-react";
import { createPortal } from "react-dom";
import styles from "./TrainerAdminCreateClientModal.module.css";

export default function TrainerAdminCreateClientModal({
  adminCreateUserLoading,
  adminCreateUserStatus,
  adminCreatedCredentials,
  adminNewUserEmail,
  adminNewUserName,
  createUserFromAdminPanel,
  credentialsText,
  setAdminCreateClientModalOpen,
  setAdminNewUserEmail,
  setAdminNewUserName
}) {
  const modal = (
    <div
      className={styles.backdrop}
      data-trainer-modal-backdrop="true"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) setAdminCreateClientModalOpen(false);
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
            <h2 id="trainer-create-client-modal-title">Пригласить клиента</h2>
            <p>Клиент сам задаст пароль по ссылке активации и войдёт по выбранному логину.</p>
          </div>
          <button type="button" onClick={() => setAdminCreateClientModalOpen(false)} aria-label="Закрыть создание клиента">
            <X size={20} />
          </button>
        </header>

        <form id="trainer-create-client-form" className={styles.content} data-trainer-modal-content="true" onSubmit={createUserFromAdminPanel}>
          <label>
            <span>Имя клиента</span>
            <input
              value={adminNewUserName}
              onChange={(event) => setAdminNewUserName(event.target.value)}
              placeholder="Например: Иван"
            />
          </label>

          <label>
            <span>Логин</span>
            <input
              value={adminNewUserEmail}
              onChange={(event) => setAdminNewUserEmail(event.target.value)}
              placeholder="например: ilya.fit"
              type="text"
              autoComplete="off"
            />
          </label>

          {adminCreateUserStatus && <p className={styles.status}>{adminCreateUserStatus}</p>}

          {adminCreatedCredentials && (
            <div className={styles.credentials}>
              <span>Ссылка активации</span>
              <strong>Логин: {adminCreatedCredentials.login || adminCreatedCredentials.email}</strong>
              <code>{adminCreatedCredentials.shareUrl || adminCreatedCredentials.inviteUrl}</code>
              <button
                type="button"
                onClick={() => navigator.clipboard?.writeText(adminCreatedCredentials.shareUrl || adminCreatedCredentials.activationUrl || credentialsText)}
              >
                Скопировать ссылку
              </button>
            </div>
          )}
        </form>

        <footer className={styles.footer} data-trainer-modal-footer="true">
          <button type="submit" form="trainer-create-client-form" disabled={adminCreateUserLoading}>
            {adminCreateUserLoading ? "Создаю..." : "Создать приглашение"}
          </button>
        </footer>
      </section>
    </div>
  );

  return typeof document === "undefined" ? modal : createPortal(modal, document.body);
}
