import { useRef, useState } from "react";
import { GraduationCap, UserRound, X } from "lucide-react";
import { useModalBackNavigation } from "../../shared/hooks/useModalBackNavigation.js";
import { getAdminUserName } from "./AdminUsersWorkspace";
import { isAdminAssignableTrainer } from "../../utils/adminAssignableTrainer.js";
import styles from "./AdminClientAssignmentModal.module.css";

function getId(value) {
  return String(value?.id || value?.uid || "").trim();
}

function getInitialTrainerId(client, trainers) {
  const currentTrainerId = String(
    client?.assignedTrainerId || client?.trainerId || client?.coachId || ""
  ).trim();
  const hasCurrentTrainer = trainers.some((trainer) => getId(trainer) === currentTrainerId);

  return hasCurrentTrainer ? currentTrainerId : "";
}

function formatTrainerOption(trainer) {
  const status = String(trainer?.accountStatus || trainer?.status || "").trim().toLocaleLowerCase("ru");
  const suffix = ["invited", "pending", "created"].includes(status)
    ? " \u2014 \u043e\u0436\u0438\u0434\u0430\u0435\u0442 \u0430\u043a\u0442\u0438\u0432\u0430\u0446\u0438\u0438"
    : "";
  return `${getAdminUserName(trainer)}${suffix}`;
}

function AdminClientAssignmentSheet({
  client,
  isSubmitting,
  onClose,
  onSubmit,
  status,
  trainers
}) {
  const validTrainers = (Array.isArray(trainers) ? trainers : []).filter(isAdminAssignableTrainer);
  const [trainerId, setTrainerId] = useState(() => getInitialTrainerId(client, validTrainers));
  const [confirmUnassign, setConfirmUnassign] = useState(false);
  const pending = useRef(false);
  const selectedTrainerId = validTrainers.some((trainer) => getId(trainer) === trainerId)
    ? trainerId
    : getInitialTrainerId(client, validTrainers);
  const clientName = getAdminUserName(client);
  const hasCurrentTrainer = Boolean(client?.assignedTrainerId || client?.trainerId || client?.coachId);
  const canSubmit = Boolean(selectedTrainerId) && typeof onSubmit === "function" && !isSubmitting;

  const close = () => {
    if (isSubmitting || pending.current) return;
    if (confirmUnassign) setConfirmUnassign(false);
    else onClose?.();
  };
  useModalBackNavigation({ open: true, onBack: close });
  const submit = async (nextTrainerId) => {
    if (isSubmitting || pending.current || typeof onSubmit !== "function") return;
    pending.current = true;
    try { await onSubmit(nextTrainerId); }
    finally { pending.current = false; }
  };

  return (
    <div className={styles.overlay} data-modal-backdrop="true" role="presentation" onMouseDown={close}>
      <section
        aria-describedby="admin-client-assignment-description"
        aria-labelledby="admin-client-assignment-title"
        aria-modal="true"
        className={styles.sheet}
        role={confirmUnassign ? "alertdialog" : "dialog"}
        onKeyDown={(event) => { if (event.key === "Escape") close(); }}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className={styles.header}>
          <span className={styles.icon} aria-hidden="true"><GraduationCap /></span>
          <div>
            <p>НАЗНАЧЕНИЕ КЛИЕНТА</p>
            <h2 id="admin-client-assignment-title">{confirmUnassign ? "Снять назначение?" : hasCurrentTrainer ? "Сменить тренера" : "Назначить тренера"}</h2>
          </div>
          <button type="button" onClick={close} aria-label="Закрыть" disabled={isSubmitting}><X /></button>
        </header>

        <p className={styles.description} id="admin-client-assignment-description">
          {confirmUnassign ? <>У клиента <strong>{clientName}</strong> закроется доступ к тренировкам, питанию и прогрессу до нового назначения тренера. История, питание и замеры сохранятся.<br /><code>ID: {getId(client)}</code></>
            : <>Выберите тренера с доступом для клиента <strong>{clientName}</strong>. История, питание и замеры клиента сохранятся. Тренера с приглашением можно назначить до активации.</>}
        </p>

        {!confirmUnassign && (validTrainers.length ? (
          <label className={styles.selectLabel}>
            <span>Тренер</span>
            <select value={selectedTrainerId} onChange={(event) => setTrainerId(event.target.value)} disabled={isSubmitting}>
              <option value="">{"\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u0442\u0440\u0435\u043d\u0435\u0440\u0430"}</option>
              {validTrainers.map((trainer) => (
                <option key={getId(trainer)} value={getId(trainer)}>{formatTrainerOption(trainer)}</option>
              ))}
            </select>
          </label>
        ) : (
          <p className={styles.emptyState}><UserRound aria-hidden="true" />Нет активных тренеров. Сначала создайте или восстановите доступ тренеру.</p>
        ))}

        {status ? <p className={styles.status} role="alert">{status}</p> : null}

        <footer className={styles.footer}>
          {hasCurrentTrainer && !confirmUnassign && typeof onSubmit === "function" ? (
            <button className={styles.unassignButton} type="button" onClick={() => setConfirmUnassign(true)} disabled={isSubmitting}>
              Снять назначение
            </button>
          ) : null}
          <button className={styles.cancelButton} type="button" onClick={close} disabled={isSubmitting}>Отмена</button>
          <button className={confirmUnassign ? styles.unassignButton : styles.submitButton} type="button" onClick={() => submit(confirmUnassign ? "" : selectedTrainerId)} disabled={confirmUnassign ? isSubmitting : !canSubmit}>
            {isSubmitting ? "Сохраняем…" : confirmUnassign ? "Подтвердить снятие назначения" : hasCurrentTrainer ? "Сменить тренера" : "Назначить"}
          </button>
        </footer>
      </section>
    </div>
  );
}

/** A small admin-only sheet for assigning or reassigning a client. */
export default function AdminClientAssignmentModal({
  client,
  isSubmitting = false,
  onClose,
  onSubmit,
  open = false,
  status = "",
  trainers = []
}) {
  if (!open) return null;

  return (
    <AdminClientAssignmentSheet
      key={getId(client) || "new-client"}
      client={client}
      isSubmitting={isSubmitting}
      onClose={onClose}
      onSubmit={onSubmit}
      status={status}
      trainers={trainers}
    />
  );
}
