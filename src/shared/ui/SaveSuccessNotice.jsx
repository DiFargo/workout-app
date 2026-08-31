import { useEffect, useRef } from "react";
import { Check } from "lucide-react";

import styles from "./SaveSuccessNotice.module.css";

export default function SaveSuccessNotice({
  title = "Данные сохранены",
  description = "Изменения применены.",
  duration = 2400,
  onComplete
}) {
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      onCompleteRef.current?.();
    }, duration);

    return () => window.clearTimeout(timer);
  }, [duration]);

  return (
    <div
      className={styles.overlay}
      data-testid="save-success-notice"
      role="status"
      aria-live="polite"
    >
      <section className={styles.card} aria-label={title}>
        <span className={styles.icon} aria-hidden="true">
          <Check size={37} strokeWidth={3.2} />
        </span>
        <strong>{title}</strong>
        <p>{description}</p>
      </section>
    </div>
  );
}
