import { X } from "lucide-react";
import { createPortal } from "react-dom";
import styles from "./TrainerProgramCopySheet.module.css";

export default function TrainerProgramCopySheet({
  adminProgramCopyTarget,
  copyMonthProgramBlock,
  monthGroups,
  setAdminProgramCopyTarget
}) {
  if (!adminProgramCopyTarget) return null;

  const sheet = (
    <div
      className={styles.backdrop}
      data-trainer-modal-backdrop="true"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) setAdminProgramCopyTarget(null);
      }}
    >
      <section
        className={styles.sheet}
        role="dialog"
        aria-modal="true"
        data-modal-surface="true"
        data-trainer-modal-surface="true"
        data-trainer-modal-frame="true"
        aria-labelledby="program-copy-sheet-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className={styles.header} data-trainer-modal-header="true">
          <div>
            <div className={styles.handle} />
            <h2 id="program-copy-sheet-title">Куда вставить копию микроцикла?</h2>
          </div>
          <button type="button" onClick={() => setAdminProgramCopyTarget(null)} aria-label="Закрыть копирование микроцикла">
            <X size={20} />
          </button>
        </header>

        <div className={styles.targetList} data-trainer-modal-content="true">
          {monthGroups.map((month, monthIndex) => (
            <section className={styles.targetMonth} key={month.id}>
              <h3>Месяц {monthIndex + 1}</h3>
              <button
                type="button"
                onClick={() => copyMonthProgramBlock(adminProgramCopyTarget.blockId, month.id)}
              >
                В начало месяца
              </button>
              {(month.microcycles || month.blocks || []).map((block, blockIndex) => (
                <button
                  type="button"
                  key={block.id}
                  onClick={() => copyMonthProgramBlock(
                    adminProgramCopyTarget.blockId,
                    month.id,
                    block.id
                  )}
                >
                  После {block.name || `Микроцикла ${blockIndex + 1}`}
                </button>
              ))}
            </section>
          ))}
        </div>

        <footer className={styles.actions} data-trainer-modal-footer="true">
          <button type="button" onClick={() => setAdminProgramCopyTarget(null)}>Отмена</button>
        </footer>
      </section>
    </div>
  );

  return typeof document === "undefined" ? sheet : createPortal(sheet, document.body);
}
