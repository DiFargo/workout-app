import { useId, useState } from "react";
import { ArrowUpRight, Plus, Search } from "lucide-react";
import TrainerEditorSheet from "./TrainerEditorSheet";
import { getTrainerLibraryMuscle, TRAINER_LIBRARY_MUSCLES } from "../../utils/trainerLibraryMuscleGroups";
import styles from "./TrainerExerciseLibraryPicker.module.css";

export default function TrainerExerciseLibraryPicker({ open, ...props }) {
  return open ? <LibraryPickerSession {...props} /> : null;
}

function LibraryPickerSession({ items = [], onClose, onSelect, onOpenLibrary, title = "Добавить упражнение" }) {
  const queryId = useId();
  const muscleId = useId();
  const [query, setQuery] = useState("");
  const [muscle, setMuscle] = useState("");
  const [limit, setLimit] = useState(30);
  const [added, setAdded] = useState("");
  const normalize = (value) => String(value || "").trim().toLocaleLowerCase("ru").replaceAll("ё", "е");
  const words = normalize(query).split(/\s+/).filter(Boolean);
  const matches = items.filter((item) => item?.name && !item.libraryDeletedAt &&
    (!muscle || getTrainerLibraryMuscle(item) === muscle) && words.every((word) => normalize(item.name).includes(word)));

  return <TrainerEditorSheet title={title} onClose={onClose} className={styles.sheet} bodyClassName={styles.body}
    footer={<><span>Упражнения создаются в библиотеке</span><button type="button" onClick={onClose}>Готово</button></>}>
    <div className={styles.filters}>
      <label className={styles.field} htmlFor={queryId}><span>Поиск по библиотеке</span><span className={styles.query}>
        <Search size={18} aria-hidden="true" /><input id={queryId} value={query} autoComplete="off" placeholder="Название упражнения"
          onChange={(event) => { setQuery(event.target.value); setLimit(30); }} />
      </span></label>
      <label className={styles.field} htmlFor={muscleId}><span>Группа мышц</span><select id={muscleId} value={muscle}
        onChange={(event) => { setMuscle(event.target.value); setLimit(30); }}>
        <option value="">Все группы</option>
        {TRAINER_LIBRARY_MUSCLES.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
      </select></label>
    </div>
    <div className={styles.results} aria-label="Результаты поиска упражнений">
      {matches.slice(0, limit).map((item, index) => <div className={styles.result} key={`${item.exerciseCardOwnerUid || ""}:${item.exerciseCardId || item.id || index}`}>
        <div><strong>{item.name}</strong><small>{TRAINER_LIBRARY_MUSCLES.find(([id]) => id === getTrainerLibraryMuscle(item))?.[1] || "Упражнение"}{item.video || item.videoUrl || item.videoURL ? " · С видео" : " · Без видео"}</small></div>
        <button type="button" aria-label={`Добавить ${item.name}`} onClick={() => {
          const result = onSelect?.(item);
          if (result !== false) setAdded(`Добавлено: ${item.name}`);
        }}><Plus size={20} aria-hidden="true" /></button>
      </div>)}
    </div>
    {!matches.length ? <p className={styles.empty}>Упражнение не найдено. Создай его в разделе «Упражнения», затем выбери здесь.</p> : null}
    {matches.length > limit ? <button className={styles.more} type="button" onClick={() => setLimit((current) => current + 30)}>Показать ещё</button> : null}
    <p className={styles.status} role="status" aria-atomic="true">{added}</p>
    {typeof onOpenLibrary === "function" ? <button className={styles.libraryLink} type="button" onClick={() => onOpenLibrary(query)}>
      <ArrowUpRight size={18} aria-hidden="true" />Перейти в «Упражнения» и создать
    </button> : null}
  </TrainerEditorSheet>;
}
