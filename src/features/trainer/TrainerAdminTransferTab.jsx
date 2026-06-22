export default function TrainerAdminTransferTab({
  ADMIN_EMAIL,
  adminAllUsersList,
  adminTransferFromUid,
  adminTransferLoading,
  adminTransferStatus,
  adminTransferToUid,
  setAdminTransferFromUid,
  setAdminTransferToUid,
  transferClientDataBetweenAccounts,
  usersList
}) {
  return (
    <div className="adminV3TabGrid">
      <div className="adminV3ProfileCard adminV3Wide adminTransferCard">
        <h3>Transfer Client Data</h3>
        <p className="adminV3TransferText">
          Переносит данные питания, истории, тренировок и AI-плана с одного UID на другой.
          Получатель остаётся обычным клиентом, а admin-профиль не становится клиентом.
        </p>

        <div className="adminTransferGrid">
          <label>
            <span>Источник данных</span>
            <select value={adminTransferFromUid} onChange={(event) => setAdminTransferFromUid(event.target.value)}>
              <option value="">Выбери источник: клиент или admin</option>
              {adminAllUsersList.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.email || client.name || client.id}{client.role === "admin" || client.email === ADMIN_EMAIL ? " · ADMIN" : ""}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Клиент-получатель</span>
            <select value={adminTransferToUid} onChange={(event) => setAdminTransferToUid(event.target.value)}>
              <option value="">Выбери клиента-получателя</option>
              {usersList.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.email || client.name || client.id}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="adminTransferPreview">
          <div>
            <span>Источник</span>
            <strong>{adminAllUsersList.find((item) => item.id === adminTransferFromUid)?.email || "—"}</strong>
          </div>
          <div>
            <span>Получатель</span>
            <strong>{usersList.find((item) => item.id === adminTransferToUid)?.email || "—"}</strong>
          </div>
          <div>
            <span>Что переносим</span>
            <strong>workouts · history · nutrition · profile · AI-plan</strong>
          </div>
        </div>

        <button
          className="adminV3OpenEditor"
          disabled={adminTransferLoading}
          onClick={transferClientDataBetweenAccounts}
        >
          {adminTransferLoading ? "Переношу..." : "Перенести данные клиенту"}
        </button>

        {adminTransferStatus && (
          <p className="adminV3Status">{adminTransferStatus}</p>
        )}

        <p className="adminV3TransferWarning">
          Важно: перенос копирует Firestore-данные. Firebase Auth аккаунты не объединяются.
        </p>
      </div>
    </div>
  );
}
