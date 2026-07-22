import { X } from "lucide-react";
import { createPortal } from "react-dom";
import styles from "./TrainerClientUtilitySheet.module.css";

export default function TrainerClientUtilitySheet({ title, eyebrow, children, onRequestClose }) {
  const sheet = (
    <div className={styles.backdrop} role="presentation" onMouseDown={onRequestClose}>
      <section
        className={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className={styles.header}>
          <div>
            {eyebrow ? <p className={styles.eyebrow}>{eyebrow}</p> : null}
            <h2 className={styles.title}>{title}</h2>
          </div>
          <button className={styles.close} type="button" onClick={onRequestClose} aria-label={`Закрыть: ${title}`}>
            <X size={22} strokeWidth={2.25} />
          </button>
        </header>
        <div className={styles.content}>{children}</div>
      </section>
    </div>
  );

  return typeof document === "undefined" ? sheet : createPortal(sheet, document.body);
}
