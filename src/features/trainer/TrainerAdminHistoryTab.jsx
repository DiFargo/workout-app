export default function TrainerAdminHistoryTab({
  adminClientHistory,
  adminDeletingWorkoutId,
  adminSelectedHistoryIds,
  deleteSelectedAdminClientHistory,
  selectedClient,
  toggleAdminSelectedHistoryId,
  toggleAdminSelectAllHistory
}) {
  const visibleHistory = adminClientHistory.slice(0, 20);
  const allVisibleSelected = visibleHistory.every((item) => adminSelectedHistoryIds.includes(item.id)) && adminClientHistory.length;

  return (
    <div className="adminV3TabGrid">
      <div className="adminV3ProfileCard adminV3Wide">
        <h3>История тренировок</h3>

        <div className="adminHistoryDeleteHint">Отметь нужные тренировки и удали только выбранные.</div>

        <div className="adminHistorySelectBar">
          <button type="button" onClick={toggleAdminSelectAllHistory}>
            {allVisibleSelected ? "Снять выбор" : "Выбрать видимые"}
          </button>

          <button
            type="button"
            className="danger"
            disabled={!adminSelectedHistoryIds.length || adminDeletingWorkoutId === "bulk"}
            onClick={() => deleteSelectedAdminClientHistory(selectedClient)}
          >
            {adminDeletingWorkoutId === "bulk" ? "Удаляю..." : `Удалить выбранные${adminSelectedHistoryIds.length ? ` (${adminSelectedHistoryIds.length})` : ""}`}
          </button>
        </div>

        <div className="adminV3Timeline">
          {visibleHistory.map((item) => (
            <div key={item.id} className={adminSelectedHistoryIds.includes(item.id) ? "adminV3TimelineWorkoutItem selected" : "adminV3TimelineWorkoutItem"}>
              <label className="adminHistoryCheck">
                <input
                  type="checkbox"
                  checked={adminSelectedHistoryIds.includes(item.id)}
                  onChange={() => toggleAdminSelectedHistoryId(item.id)}
                />
                <i />
              </label>

              <span>{item.postWorkoutFeedback?.emoji || item.readiness?.emoji || "🏋️"}</span>
              <strong>{item.workout || "Тренировка"}</strong>
              <small>{item.date ? new Date(item.date).toLocaleDateString("ru-RU") : "без даты"}{item.durationSeconds ? ` · ${Math.round(item.durationSeconds / 60)} мин` : ""}</small>
              <em>{item.postWorkoutFeedback?.title || item.readiness?.title || "—"}</em>
              {item.clientComment && <p className="adminHistoryClientComment">“{item.clientComment}”</p>}
            </div>
          ))}
          {!adminClientHistory.length && <p className="adminV3Empty">Истории пока нет.</p>}
        </div>
      </div>
    </div>
  );
}
