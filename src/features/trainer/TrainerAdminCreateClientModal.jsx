export default function TrainerAdminCreateClientModal({
  adminCreateUserLoading,
  adminCreateUserStatus,
  adminCreatedCredentials,
  adminNewUserEmail,
  adminNewUserName,
  adminNewUserPassword,
  createUserFromAdminPanel,
  credentialsText,
  generateAdminPassword,
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

        <h2>Создать клиента</h2>
        <p>Создай логин, пароль и стартовую программу для нового клиента.</p>

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

          <label>
            <span>Пароль</span>
            <div className="adminPasswordRow">
              <input
                value={adminNewUserPassword}
                onChange={(event) => setAdminNewUserPassword(event.target.value)}
                placeholder="Минимум 6 символов"
                type="text"
                autoComplete="new-password"
              />
              <button type="button" onClick={generateAdminPassword}>Сген.</button>
            </div>
          </label>

          <button type="submit" className="adminCreateUserSubmit" disabled={adminCreateUserLoading}>
            {adminCreateUserLoading ? "Создаю..." : "Создать клиента"}
          </button>
        </form>

        {adminCreateUserStatus && <p className="adminCreateUserStatus">{adminCreateUserStatus}</p>}

        {adminCreatedCredentials && (
          <div className="adminCredentialsBox">
            <span>Данные для клиента</span>
            <pre>{credentialsText}</pre>
            <button type="button" onClick={() => navigator.clipboard?.writeText(credentialsText)}>
              Скопировать логин и пароль
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
