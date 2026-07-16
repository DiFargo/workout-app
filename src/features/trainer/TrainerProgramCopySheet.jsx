import styles from "./TrainerProgramCopySheet.module.css";

export default function TrainerProgramCopySheet({
  adminProgramCopyTarget,
  copyMonthProgramBlock,
  monthGroups,
  setAdminProgramCopyTarget
}) {
  if (!adminProgramCopyTarget) return null;

  return (
    <div className={styles.backdrop} onClick={() => setAdminProgramCopyTarget(null)}>
      <section
        className={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-labelledby="program-copy-sheet-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles.handle} />
        <h2 id="program-copy-sheet-title">Куда вставить копию микроцикла?</h2>

        <div className={styles.targetList}>
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

        <div className={styles.actions}>
          <button type="button" onClick={() => setAdminProgramCopyTarget(null)}>Отмена</button>
        </div>
      </section>
    </div>
  );
}
