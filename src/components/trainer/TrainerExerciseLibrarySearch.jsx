import { useId, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import styles from "./TrainerExerciseLibraryPicker.module.css";

function normalizeQuery(value) {
  return String(value || "").trim().toLocaleLowerCase("ru").replaceAll("ё", "е").replace(/\s+/g, " ");
}

export default function TrainerExerciseLibrarySearch({ exercise, items = [], onSelect, onOpenLibrary, disabled = false, label = "Название" }) {
  const listId = useId();
  const hintId = useId();
  const [search, setSearch] = useState(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const identity = JSON.stringify([exercise?.id, exercise?.name, exercise?.exerciseCardId, exercise?.video]);
  const query = search?.identity === identity ? search.query : String(exercise?.name || "");
  const words = normalizeQuery(query).split(" ").filter(Boolean);
  const matches = items.filter((item) => item?.name && !item.libraryDeletedAt &&
    words.every((word) => normalizeQuery(item.name).includes(word))).slice(0, 8);
  const expanded = open && !disabled;
  const selectedIndex = Math.min(activeIndex, Math.max(0, matches.length - 1));

  const select = (item) => {
    if (!item || disabled) return;
    onSelect?.(item);
    setSearch(null);
    setOpen(false);
  };

  return (
    <div className={styles.inlineSearch} onBlur={(event) => {
      if (event.currentTarget.contains(event.relatedTarget)) return;
      setOpen(false);
      setSearch(null);
    }}>
      <label className={styles.field}>
        <span>{label}</span>
        <input value={query} disabled={disabled} autoComplete="off" role="combobox"
          aria-autocomplete="list" aria-expanded={expanded} aria-controls={listId} aria-describedby={hintId}
          aria-activedescendant={expanded && matches.length ? `${listId}-${selectedIndex}` : undefined}
          onFocus={() => { setOpen(true); setActiveIndex(0); }}
          onChange={(event) => { setSearch({ identity, query: event.target.value }); setOpen(true); setActiveIndex(0); }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault(); event.stopPropagation(); setOpen(false); setSearch(null);
            } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault(); setOpen(true);
              setActiveIndex((index) => expanded
                ? Math.max(0, Math.min(matches.length - 1, index + (event.key === "ArrowDown" ? 1 : -1)))
                : event.key === "ArrowUp" ? Math.max(0, matches.length - 1) : 0);
            } else if (event.key === "Enter" && expanded) {
              event.preventDefault();
              if (matches.length) select(matches[selectedIndex]);
            }
          }} />
      </label>
      <small className={styles.hint} id={hintId}>Выбери из библиотеки: название и видео изменятся вместе.</small>
      {expanded ? <div className={styles.suggestions}>
        <div id={listId} role="listbox" aria-label="Упражнения из библиотеки" className={styles.options}>
          {matches.map((item, index) => <button type="button" role="option" aria-selected={index === selectedIndex}
            id={`${listId}-${index}`} key={`${item.exerciseCardOwnerUid || ""}:${item.exerciseCardId || item.id || index}`}
            className={`${styles.option} ${index === selectedIndex ? styles.optionActive : ""}`}
            onMouseDown={(event) => event.preventDefault()} onClick={() => select(item)}>
            <strong>{item.name}</strong><small>{item.video || item.videoUrl || item.videoURL ? "С видео" : "Без видео"}</small>
          </button>)}
        </div>
        {!matches.length ? <p className={styles.empty}>Такого упражнения нет в библиотеке.</p> : null}
        {typeof onOpenLibrary === "function" ? <button className={styles.libraryLink} type="button" onClick={() => onOpenLibrary(query)}>
          <ArrowUpRight size={17} aria-hidden="true" />Перейти в «Упражнения» и создать
        </button> : null}
      </div> : null}
    </div>
  );
}
