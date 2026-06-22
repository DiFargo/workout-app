export default function TrainerProgramCopySheet({
  adminProgramCopyTarget,
  copyMonthProgramBlock,
  monthGroups,
  setAdminProgramCopyTarget
}) {
  if (!adminProgramCopyTarget) return null;

  return (
    <div className="programCopySheetBackdrop" onClick={() => setAdminProgramCopyTarget(null)}>
      <section
        className="programCopySheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="program-copy-sheet-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="programCopySheetHandle" />
        <h2 id="program-copy-sheet-title">Куда вставить копию микроцикла?</h2>

        <div className="programCopyTargetList">
          {monthGroups.map((month, monthIndex) => (
            <section className="programCopyTargetMonth" key={month.id}>
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

        <div className="programCopySheetActions">
          <button type="button" onClick={() => setAdminProgramCopyTarget(null)}>Отмена</button>
        </div>
      </section>
    </div>
  );
}
