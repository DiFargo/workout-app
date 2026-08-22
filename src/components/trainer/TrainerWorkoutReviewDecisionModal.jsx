import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Check, SlidersHorizontal, X } from "lucide-react";
import styles from "./TrainerWorkoutReviewDecisionModal.module.css";

export default function TrainerWorkoutReviewDecisionModal({
  review,
  targetWorkout,
  saving = false,
  status = "",
  onConfirm,
  onEdit,
  onClose
}) {
  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Escape" && !saving) onClose?.();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, saving]);

  const modal = (
    <div className={styles.backdrop} data-trainer-modal-backdrop="true" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !saving && onClose?.()}>
      <section className={styles.modal} role="dialog" aria-modal="true" data-modal-surface="true" data-trainer-modal-surface="true" data-trainer-modal-frame="true" aria-labelledby="trainer-workout-review-decision-title">
        <header className={styles.header} data-trainer-modal-header="true">
          <div>
            <span>РЕШЕНИЕ ТРЕНЕРА</span>
            <h2 id="trainer-workout-review-decision-title">Нужна ли корректировка?</h2>
            <p>Проверьте сигнал после «{review?.workoutName || "последней тренировки"}» и выберите одно действие.</p>
          </div>
          <button className={styles.close} type="button" aria-label="Закрыть решение по тренировке" onClick={onClose} disabled={saving}>
            <X size={20} />
          </button>
        </header>

        <div className={styles.context} data-trainer-modal-content="true">
          <div>
            <span>Сигнал клиента</span>
            <strong>{review?.feedbackTitle || "Комментарий после тренировки"}</strong>
            <p>{review?.clientComment || "Клиент оставил оценку. Проверьте, требуется ли изменение плана."}</p>
          </div>
          <div>
            <span>Следующая тренировка</span>
            <strong>{targetWorkout?.name || "Нет доступной запланированной тренировки"}</strong>
            <p>{targetWorkout ? "При необходимости редактор откроется сразу на этой тренировке." : "Сначала добавьте или запланируйте следующую тренировку."}</p>
          </div>
        </div>

        <footer className={styles.actions} data-trainer-modal-footer="true">
          {status ? <p className={styles.status} role="status">{status}</p> : null}
          <button type="button" className={styles.accept} onClick={onConfirm} disabled={saving}>
            <Check size={20} />
            <span><strong>Всё в порядке</strong><small>Корректировка не требуется</small></span>
          </button>
          <button type="button" className={styles.edit} onClick={onEdit} disabled={saving || !targetWorkout}>
            <SlidersHorizontal size={20} />
            <span><strong>Редактировать тренировку</strong><small>Изменить нагрузку в следующем плане</small></span>
          </button>
        </footer>
      </section>
    </div>
  );

  return typeof document === "undefined" ? modal : createPortal(modal, document.body);
}
