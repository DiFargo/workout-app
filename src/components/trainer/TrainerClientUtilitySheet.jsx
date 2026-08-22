import { X } from "lucide-react";
import { createPortal } from "react-dom";
import styles from "./TrainerClientUtilitySheet.module.css";

export default function TrainerClientUtilitySheet({ title, eyebrow, children, headerAction, onRequestClose, variant = "" }) {
  const sheet = (
    <div className={styles.backdrop} data-trainer-modal-backdrop="true" role="presentation" onMouseDown={onRequestClose}>
      <section
        className={`${styles.sheet}${variant ? ` ${styles[variant] || ""}` : ""}`}
        role="dialog"
        aria-modal="true"
        data-modal-surface="true"
        data-trainer-modal-surface="true"
        data-trainer-modal-frame="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className={styles.header} data-trainer-modal-header="true">
          <div>
            {eyebrow ? <p className={styles.eyebrow}>{eyebrow}</p> : null}
            <h2 className={styles.title}>{title}</h2>
          </div>
          <div className={styles.headerActions}>
            {headerAction ? <div className={styles.headerAction}>{headerAction}</div> : null}
            <button className={styles.close} type="button" onClick={onRequestClose} aria-label={`Закрыть: ${title}`}>
              <X size={22} strokeWidth={2.25} />
            </button>
          </div>
        </header>
        <div className={styles.content} data-trainer-modal-content="true">{children}</div>
        <footer className={styles.footer} data-trainer-modal-footer="true">
          <button type="button" onClick={onRequestClose}>Закрыть</button>
        </footer>
      </section>
    </div>
  );

  return typeof document === "undefined" ? sheet : createPortal(sheet, document.body);
}
