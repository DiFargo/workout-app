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
  return (
    <div className="adminCreateClientModalOverlay">
      <div className="adminCreateClientModal">
        <button
          type="button"
          className="adminCreateClientModalClose"
          onClick={() => setAdminCreateClientModalOpen(false)}
        >
          ×
        </button>

        <h2>Пригласить клиента</h2>
        <p>Клиент сам задаст пароль по ссылке активации и войдёт по выбранному логину.</p>

        <form className="adminCreateUserForm" onSubmit={createUserFromAdminPanel}>
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

          <button type="submit" className="adminCreateUserSubmit" disabled={adminCreateUserLoading}>
            {adminCreateUserLoading ? "Создаю..." : "Создать приглашение"}
          </button>
        </form>

        {adminCreateUserStatus && <p className="adminCreateUserStatus">{adminCreateUserStatus}</p>}

        {adminCreatedCredentials && (
          <div className="adminCredentialsBox">
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
      </div>
    </div>
  );
}
