import { useEffect, useState } from "react";
import { Scale } from "lucide-react";
import ProfileModalCloseButton from "./ProfileModalCloseButton";
import styles from "./ProfileQuickWeightModal.module.css";

function toWeightDraftValue(value) {
  return String(value ?? "").trim();
}

export default function ProfileQuickWeightModal({
  open,
  saving = false,
  onClose,
  onSave
}) {
  const [weight, setWeight] = useState("0");
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (!open) return;

    setWeight("0");
    setStatus("");
  }, [open]);

  if (!open) return null;

  async function handleSubmit(event) {
    event.preventDefault();
    if (saving) return;

    const rawWeight = toWeightDraftValue(weight);
    const numericWeight = Number(rawWeight.replace(",", "."));

    if (!/^\d{1,3}(?:[.,]\d{1,2})?$/u.test(rawWeight) || !Number.isFinite(numericWeight)) {
      setStatus("Введите вес числом, например 82,5.");
      return;
    }

    if (numericWeight < 25 || numericWeight > 350) {
      setStatus("Укажите вес от 25 до 350 кг.");
      return;
    }

    setStatus("");
    const saved = await onSave?.(rawWeight);

    if (!saved) {
      setStatus("Не удалось сохранить вес. Попробуйте ещё раз.");
    }
  }

  return (
    <div
      className={styles.overlay}
      data-testid="profile-quick-weight-overlay"
      data-css-module-scope="profile-quick-weight-modal"
      role="presentation"
      onClick={saving ? undefined : onClose}
    >
      <form
        className={styles.dialog}
        data-testid="profile-quick-weight-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="profileQuickWeightTitle"
        data-modal-surface="true"
        onClick={(event) => event.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <ProfileModalCloseButton
          className={styles.closeButton}
          testId="profile-quick-weight-close"
          ariaLabel="Закрыть добавление веса"
          disabled={saving}
          onClick={onClose}
        />

        <div className={styles.icon} aria-hidden="true">
          <Scale size={26} strokeWidth={2.2} />
        </div>

        <div className={styles.heading}>
          <h2 id="profileQuickWeightTitle">Добавить вес</h2>
          <p>Укажите текущий вес — он появится в динамике.</p>
        </div>

        <label className={styles.field}>
          <span>Вес</span>
          <div className={styles.inputWrap}>
            <input
              data-testid="profile-quick-weight-input"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              autoFocus
              value={weight}
              onChange={(event) => {
                setWeight(event.target.value);
                if (status) setStatus("");
              }}
              onFocus={(event) => event.currentTarget.select()}
              placeholder="0"
              aria-describedby={status ? "profileQuickWeightStatus" : undefined}
            />
            <span>кг</span>
          </div>
        </label>

        {status && (
          <p id="profileQuickWeightStatus" className={styles.status} data-testid="profile-quick-weight-status">
            {status}
          </p>
        )}

        <button
          type="submit"
          className={styles.submit}
          data-testid="profile-quick-weight-submit"
          disabled={saving}
        >
          {saving ? "Сохраняем..." : "Сохранить"}
        </button>
      </form>
    </div>
  );
}
