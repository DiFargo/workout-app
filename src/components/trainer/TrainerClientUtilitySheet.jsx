import { X } from "lucide-react";
import { createPortal } from "react-dom";
import { useMemo, useRef, useState } from "react";
import { useBodyScrollLock } from "../../shared/hooks/useBodyScrollLock";
import { TrainerSheetCloseContext } from "./TrainerSheetCloseContext.js";
import styles from "./TrainerClientUtilitySheet.module.css";

export default function TrainerClientUtilitySheet({ title, eyebrow, children, headerAction, onRequestClose, variant = "" }) {
  useBodyScrollLock(true, { lockHtml: true });
  const closeGuard = useRef(null);
  const [footerHost, setFooterHost] = useState(null);
  const closeContext = useMemo(() => ({ footerHost, register(guard) {
    closeGuard.current = guard;
    return () => { if (closeGuard.current === guard) closeGuard.current = null; };
  } }), [footerHost]);
  function requestClose() {
    if (closeGuard.current?.() === false) return;
    onRequestClose?.();
  }

  const sheet = (
    <TrainerSheetCloseContext.Provider value={closeContext}>
    <div className={styles.backdrop} data-trainer-modal-backdrop="true" role="presentation" onMouseDown={requestClose}>
      <section
        className={`${styles.sheet}${variant ? ` ${styles[variant] || ""}` : ""}`}
        role="dialog"
        aria-modal="true"
        data-modal-surface="true"
        data-trainer-modal-surface="true"
        data-trainer-modal-frame="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (variant === "workoutHistory" && event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            requestClose();
          }
        }}
      >
        <header className={styles.header} data-trainer-modal-header="true">
          <div>
            {eyebrow ? <p className={styles.eyebrow}>{eyebrow}</p> : null}
            <h2 className={styles.title}>{title}</h2>
          </div>
          <div className={styles.headerActions}>
            {headerAction ? <div className={styles.headerAction}>{headerAction}</div> : null}
            <button className={styles.close} type="button" onClick={requestClose} aria-label={`Закрыть: ${title}`}>
              <X size={22} strokeWidth={2.25} />
            </button>
          </div>
        </header>
        <div className={`${styles.content} trainerNextRoot`} data-trainer-modal-content="true">{children}</div>
        <footer ref={setFooterHost} className={styles.footer} data-trainer-modal-footer="true">
          <button className={styles.defaultClose} type="button" onClick={requestClose}>Закрыть</button>
        </footer>
      </section>
    </div>
    </TrainerSheetCloseContext.Provider>
  );

  return typeof document === "undefined" ? sheet : createPortal(sheet, document.body);
}
