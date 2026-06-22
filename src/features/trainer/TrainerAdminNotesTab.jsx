export default function TrainerAdminNotesTab({
  adminTrainerNote,
  saveAdminTrainerNote,
  setAdminTrainerNote
}) {
  return (
    <div className="adminV3TabGrid">
      <div className="adminV3ProfileCard adminV3Wide">
        <h3>Заметки тренера</h3>
        <textarea className="adminV3Note" value={adminTrainerNote} onChange={(event) => setAdminTrainerNote(event.target.value)} placeholder="Например: следить за белком, не повышать объём ног..." />
        <button className="adminV3OpenEditor" onClick={saveAdminTrainerNote}>Сохранить заметку</button>
      </div>
    </div>
  );
}
