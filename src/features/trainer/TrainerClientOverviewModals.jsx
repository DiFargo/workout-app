import { createPortal } from "react-dom";
import { X } from "lucide-react";
import styles from "./TrainerClientOverviewModals.module.css";

export default function TrainerClientOverviewModals({
  adminClientProgressPhotos,
  adminNewTaskDueDate,
  adminNewTaskTitle,
  adminPaymentDraft,
  adminPhotoCompareIds,
  adminPhotoCompareOpen,
  adminProgramControlOpen,
  adminTaskComposerOpen,
  createAdminClientTask,
  formatTrainerSummaryDate,
  saveAdminClientPayment,
  selectedPhotoCompare,
  setAdminNewTaskDueDate,
  setAdminNewTaskTitle,
  setAdminPaymentDraft,
  setAdminPhotoCompareIds,
  setAdminPhotoCompareOpen,
  setAdminProgramControlOpen,
  setAdminTaskComposerOpen
}) {
  const taskTemplates = [
    { label: "Замеры", title: "Сделать контрольный замер" },
    { label: "Фото", title: "Загрузить фото прогресса" },
    { label: "Питание", title: "Заполнить дневник питания" },
    { label: "Тренировка", title: "Выполнить ближайшую тренировку" }
  ];

  const modals = (
    <>
      {adminTaskComposerOpen && (
        <div
          className={styles.overlay}
          data-trainer-modal-backdrop="true"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setAdminTaskComposerOpen(false);
          }}
        >
          <section className={styles.modal} role="dialog" aria-modal="true" data-modal-surface="true" data-trainer-modal-surface="true" data-trainer-modal-frame="true" aria-labelledby="trainerTaskModalTitle">
            <header className={styles.header} data-trainer-modal-header="true">
              <div>
                <span>ЗАДАЧА КЛИЕНТУ</span>
                <h3 id="trainerTaskModalTitle">Назначить новую задачу</h3>
              </div>
              <button type="button" onClick={() => setAdminTaskComposerOpen(false)} aria-label="Закрыть"><X size={20} /></button>
            </header>
            <div className={`${styles.body} ${styles.taskCreate}`} data-trainer-modal-content="true">
              <label>
                <span>Что нужно сделать</span>
                <input value={adminNewTaskTitle} onChange={(event) => setAdminNewTaskTitle(event.target.value)} placeholder="Например: сделать контрольный замер" autoFocus />
              </label>
              <div className={styles.templateRow} role="group" aria-label="Быстрые шаблоны задач">
                {taskTemplates.map((template) => (
                  <button
                    type="button"
                    key={template.label}
                    onClick={() => setAdminNewTaskTitle(template.title)}
                  >
                    {template.label}
                  </button>
                ))}
              </div>
              <label>
                <span>Срок выполнения</span>
                <input type="date" value={adminNewTaskDueDate} onChange={(event) => setAdminNewTaskDueDate(event.target.value)} />
              </label>
            </div>
            <footer className={styles.footer} data-trainer-modal-footer="true">
              <button
                type="button"
                onClick={async () => {
                  if (!adminNewTaskTitle.trim()) return;
                  await createAdminClientTask();
                  setAdminTaskComposerOpen(false);
                }}
              >
                Назначить задачу
              </button>
            </footer>
          </section>
        </div>
      )}

      {adminPhotoCompareOpen && (
        <div
          className={styles.overlay}
          data-trainer-modal-backdrop="true"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setAdminPhotoCompareOpen(false);
          }}
        >
          <section className={`${styles.modal} ${styles.photoCompareModal}`} role="dialog" aria-modal="true" data-modal-surface="true" data-trainer-modal-surface="true" data-trainer-modal-frame="true" aria-labelledby="trainerPhotoCompareTitle">
            <header className={styles.header} data-trainer-modal-header="true">
              <div>
                <span>ФОТО ПРОГРЕССА</span>
                <h3 id="trainerPhotoCompareTitle">Сравнить фотосессии</h3>
              </div>
              <button type="button" onClick={() => setAdminPhotoCompareOpen(false)} aria-label="Закрыть"><X size={20} /></button>
            </header>
            <div className={styles.body} data-trainer-modal-content="true">
              <div className={styles.photoCompareControls}>
                {[0, 1].map((slot) => (
                  <label key={slot}>
                    <span>{slot === 0 ? "Предыдущая фотосессия" : "Новая фотосессия"}</span>
                    <select
                      aria-label={slot === 0 ? "Предыдущая фотосессия для сравнения" : "Новая фотосессия для сравнения"}
                      value={adminPhotoCompareIds[slot] || ""}
                      onChange={(event) => setAdminPhotoCompareIds((current) => {
                        const next = [...current];
                        next[slot] = event.target.value;
                        return next;
                      })}
                    >
                      <option value="">Выбрать дату</option>
                      {adminClientProgressPhotos.map((photo) => (
                        <option key={photo.id} value={photo.id}>
                          {formatTrainerSummaryDate(photo.date || photo.createdAt)}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
              <div className={styles.photoCompare}>
                {selectedPhotoCompare.map((photo, slot) => (
                  <div key={slot}>
                    {photo ? (
                      <>
                        <strong>{formatTrainerSummaryDate(photo.date || photo.createdAt)}</strong>
                        <div>
                          {[photo.frontUrl, photo.sideUrl, photo.backUrl].filter(Boolean).map((url, index) => (
                            <img key={`${index}_${url}`} src={url} alt="" loading="lazy" />
                          ))}
                        </div>
                        {photo.comment && <small>{photo.comment}</small>}
                      </>
                    ) : <span>Выбери фотосессию для сравнения</span>}
                  </div>
                ))}
              </div>
            </div>
            <footer className={styles.footer} data-trainer-modal-footer="true">
              <button type="button" onClick={() => setAdminPhotoCompareOpen(false)}>Готово</button>
            </footer>
          </section>
        </div>
      )}

      {adminProgramControlOpen && (
        <div
          className={styles.overlay}
          data-trainer-modal-backdrop="true"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setAdminProgramControlOpen(false);
          }}
        >
          <section className={styles.modal} role="dialog" aria-modal="true" data-modal-surface="true" data-trainer-modal-surface="true" data-trainer-modal-frame="true" aria-labelledby="trainerProgramControlTitle">
            <header className={styles.header} data-trainer-modal-header="true">
              <div>
                <span>КОНТРОЛЬ ПРОГРАММЫ</span>
                <h3 id="trainerProgramControlTitle">Изменить сопровождение</h3>
              </div>
              <button type="button" onClick={() => setAdminProgramControlOpen(false)} aria-label="Закрыть"><X size={20} /></button>
            </header>
            <div className={`${styles.body} ${styles.paymentGrid}`} data-trainer-modal-content="true">
              <label><span>Назначена от</span><input type="date" value={adminPaymentDraft.assignedFrom} onChange={(event) => setAdminPaymentDraft((current) => ({ ...current, assignedFrom: event.target.value }))} /></label>
              <label><span>Контроль до</span><input type="date" value={adminPaymentDraft.controlUntil} onChange={(event) => setAdminPaymentDraft((current) => ({ ...current, controlUntil: event.target.value }))} /></label>
              <label><span>Формат</span><input value={adminPaymentDraft.format} onChange={(event) => setAdminPaymentDraft((current) => ({ ...current, format: event.target.value }))} placeholder="Например: персональная · 4 недели" /></label>
              <label><span>Состояние</span><select aria-label="Состояние контроля программы" value={adminPaymentDraft.status} onChange={(event) => setAdminPaymentDraft((current) => ({ ...current, status: event.target.value }))}><option value="active">Активна</option><option value="review">Требует проверки</option><option value="paused">Приостановлена</option></select></label>
              <label className={styles.wide}><span>Комментарий</span><input value={adminPaymentDraft.note} onChange={(event) => setAdminPaymentDraft((current) => ({ ...current, note: event.target.value }))} placeholder="Этап, ограничения или следующий контроль" /></label>
            </div>
            <footer className={styles.footer} data-trainer-modal-footer="true">
              <button
                type="button"
                onClick={async () => {
                  await saveAdminClientPayment();
                  setAdminProgramControlOpen(false);
                }}
              >
                Сохранить контроль
              </button>
            </footer>
          </section>
        </div>
      )}
    </>
  );

  if (typeof document === "undefined") return modals;
  return createPortal(modals, document.body);
}
