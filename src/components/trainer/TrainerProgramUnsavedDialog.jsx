import TrainerEditorSheet from "./TrainerEditorSheet";
import styles from "./TrainerProgramUnsavedDialog.module.css";

export default function TrainerProgramUnsavedDialog({ onContinue, onDiscard, onSave, saving = false, status = "" }) {
  return <TrainerEditorSheet role="alertdialog" title="Есть несохранённые изменения" onClose={() => { if (!saving) onContinue(); }} className={styles.dialog} bodyClassName={styles.body} footer={
    <div className={styles.actions}>
      <button type="button" onClick={onContinue} disabled={saving}>Продолжить редактирование</button>
      <button type="button" onClick={onDiscard} disabled={saving}>Выйти без сохранения</button>
      <button type="button" onClick={onSave} disabled={saving}>{saving ? "Сохраняю…" : "Сохранить и выйти"}</button>
    </div>
  }><p>Сохраните программу, чтобы применить правки. При выходе без сохранения они будут отменены.</p>{status ? <p role="alert">{status}</p> : null}</TrainerEditorSheet>;
}
