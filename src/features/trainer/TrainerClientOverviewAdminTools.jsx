import TrainerAdminDangerZone from "./TrainerAdminDangerZone";

export default function TrainerClientOverviewAdminTools({
  ADMIN_EMAIL,
  adminAllUsersList,
  adminTrainerNote,
  adminTransferFromUid,
  adminTransferLoading,
  adminTransferStatus,
  adminTransferToUid,
  deleteClientEverywhereFromAdminPanel,
  saveAdminTrainerNote,
  selectedClient,
  setAdminTrainerNote,
  setAdminTransferFromUid,
  setAdminTransferToUid,
  transferClientDataBetweenAccounts,
  usersList
}) {
  return (
    <div className="adminClientOverviewOnlyBlocks">
      <div className="adminClientBottomTools">
        <div className="adminClientTabContent adminClientNotesBlock">
          <div className="adminClientBottomBlockHead">
            <span>NOTES</span>
            <h3>Заметка тренера</h3>
          </div>
          <textarea
            className="adminV3Note"
            value={adminTrainerNote}
            onChange={(event) => setAdminTrainerNote(event.target.value)}
            placeholder="Заметки тренера по клиенту..."
          />
          <button className="adminV3OpenEditor" type="button" onClick={saveAdminTrainerNote}>Сохранить заметку</button>
        </div>

        <div className="adminClientTabContent adminClientTransferBlock">
          <div className="adminClientBottomBlockHead">
            <span>TRANSFER</span>
            <h3>Перенос данных</h3>
          </div>
          <div className="adminTransferGrid">
            <label>
              <span>Источник данных</span>
              <select value={adminTransferFromUid} onChange={(event) => setAdminTransferFromUid(event.target.value)}>
                <option value="">Выбери источник</option>
                {adminAllUsersList.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.email || client.name || client.id}{client.role === "admin" || client.email === ADMIN_EMAIL ? " · ADMIN" : ""}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Клиент-получатель</span>
              <select value={adminTransferToUid || selectedClient.id} onChange={(event) => setAdminTransferToUid(event.target.value)}>
                <option value="">Выбери клиента</option>
                {usersList.map((client) => (
                  <option key={client.id} value={client.id}>{client.email || client.name || client.id}</option>
                ))}
              </select>
            </label>
          </div>

          <button
            className="adminV3OpenEditor"
            type="button"
            disabled={adminTransferLoading}
            onClick={() => {
              transferClientDataBetweenAccounts(adminTransferFromUid, adminTransferToUid || selectedClient.id);
            }}
          >
            {adminTransferLoading ? "Переношу..." : "Перенести данные"}
          </button>
          {adminTransferStatus && <p className="adminV3Status">{adminTransferStatus}</p>}
        </div>
      </div>

      <TrainerAdminDangerZone
        onDeleteClient={deleteClientEverywhereFromAdminPanel}
        selectedClient={selectedClient}
      />
    </div>
  );
}
