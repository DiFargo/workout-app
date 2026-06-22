import { getActiveTrainerTasksCount, getTrainerTaskStatus } from "../../domain/clientInsights";

export default function TrainerClientOverviewPhotosTasks({
  adminClientProgressPhotos,
  adminClientTasks,
  adminProgressPhotoComment,
  adminProgressPhotoDate,
  adminProgressPhotoFiles,
  adminProgressPhotoUploading,
  formatTrainerSummaryDate,
  selectedLatestPhoto,
  selectedTaskPreview,
  setAdminPhotoCompareOpen,
  setAdminProgressPhotoComment,
  setAdminProgressPhotoDate,
  setAdminProgressPhotoFiles,
  setAdminTaskComposerOpen,
  updateAdminClientTask,
  uploadAdminProgressPhotos
}) {
  return (
    <div className="trainerClientOverviewGrid trainerClientOverviewGridMain">
      <section className="trainerClientOverviewSection trainerClientPhotosOverview">
        <div className="trainerClientSectionHead">
          <div>
            <span>ФОТО ПРОГРЕССА</span>
            <small>{selectedLatestPhoto ? `Последняя фотосессия: ${formatTrainerSummaryDate(selectedLatestPhoto.date || selectedLatestPhoto.createdAt)}` : "Фотосессий пока нет"}</small>
          </div>
          <div className="trainerClientSectionActions">
            <button
              type="button"
              disabled={!adminClientProgressPhotos.length}
              onClick={() => setAdminPhotoCompareOpen(true)}
            >
              Сравнить
            </button>
            <details className="trainerClientInlineEditor">
              <summary>Добавить фото</summary>
              <div className="trainerClientInlineEditorPanel">
                <div className="trainerPhotoUploadGrid">
                  {[["front", "Фронт"], ["side", "Бок"], ["back", "Спина"]].map(([view, label]) => (
                    <label key={view}>
                      <span>{label}</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(event) => setAdminProgressPhotoFiles((current) => ({
                          ...current,
                          [view]: event.target.files?.[0] || null
                        }))}
                      />
                      <em>{adminProgressPhotoFiles[view]?.name || "Выбрать"}</em>
                    </label>
                  ))}
                </div>
                <div className="trainerPhotoMetaRow">
                  <input type="date" value={adminProgressPhotoDate} onChange={(event) => setAdminProgressPhotoDate(event.target.value)} />
                  <input value={adminProgressPhotoComment} onChange={(event) => setAdminProgressPhotoComment(event.target.value)} placeholder="Комментарий тренера" />
                  <button type="button" disabled={adminProgressPhotoUploading} onClick={uploadAdminProgressPhotos}>
                    {adminProgressPhotoUploading ? "Загружаю..." : "Сохранить"}
                  </button>
                </div>
              </div>
            </details>
          </div>
        </div>
        <div className="trainerClientPhotoRow">
          {[["frontUrl", "Фронт"], ["sideUrl", "Бок"], ["backUrl", "Спина"]].map(([field, label]) => (
            <figure key={field}>
              {selectedLatestPhoto?.[field] ? (
                <img src={selectedLatestPhoto[field]} alt={label} loading="lazy" />
              ) : (
                <div><span>＋</span><small>Нет фото</small></div>
              )}
              <figcaption>{label}</figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section className="trainerClientOverviewSection trainerClientTasksOverview">
        <div className="trainerClientSectionHead">
          <div>
            <span>ЗАДАЧИ КЛИЕНТУ</span>
            <small>{getActiveTrainerTasksCount(adminClientTasks)} активных</small>
          </div>
          <button type="button" onClick={() => setAdminTaskComposerOpen(true)}>＋ Добавить задачу</button>
        </div>
        <div className="trainerClientTaskPreview">
          {selectedTaskPreview.map((task) => {
            const taskStatus = getTrainerTaskStatus(task);
            return (
              <div className={taskStatus.id} key={task.id}>
                <button
                  type="button"
                  onClick={() => updateAdminClientTask(task, taskStatus.id === "completed" ? "progress" : "completed")}
                  aria-label={taskStatus.id === "completed" ? "Вернуть задачу" : "Завершить задачу"}
                >
                  {taskStatus.id === "completed" ? "✓" : ""}
                </button>
                <span>
                  <strong>{task.title}</strong>
                  <small>{task.dueDate ? `До ${new Date(`${task.dueDate}T12:00:00`).toLocaleDateString("ru-RU")}` : "Без срока"}</small>
                </span>
                <em>{taskStatus.label}</em>
              </div>
            );
          })}
          {!selectedTaskPreview.length && <p className="trainerWorkspaceEmpty">Добавь первую задачу клиенту.</p>}
        </div>
      </section>
    </div>
  );
}
