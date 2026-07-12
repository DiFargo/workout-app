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
  setAdminNewUserName,
  setAdminNewUserPassword
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
        <p>Клиент сам задаст пароль по ссылке активации и сможет войти по email, логину или Google.</p>

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
            <span>Логин / email</span>
            <input
              value={adminNewUserEmail}
              onChange={(event) => setAdminNewUserEmail(event.target.value)}
              placeholder="client@email.com"
              type="email"
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
            <span>Приглашение для клиента</span>
            <pre>{credentialsText}</pre>
            <button type="button" onClick={() => navigator.clipboard?.writeText(credentialsText)}>
              Скопировать приглашение
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
