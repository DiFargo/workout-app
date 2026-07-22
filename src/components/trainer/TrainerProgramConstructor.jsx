import { useMemo, useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Clock3,
  Copy,
  Dumbbell,
  EllipsisVertical,
  GripVertical,
  Layers3,
  MoreVertical,
  Plus,
  Save,
  Settings2,
  StickyNote,
  Trash2,
  X
} from "lucide-react";
import {
  createWorkoutTaskBlock,
  WORKOUT_BLOCK_TYPES
} from "../../utils/universalWorkoutBlocks";

const DAY_COLORS = Object.freeze(["violet", "blue", "green", "orange", "rose"]);
const DEFAULT_SET_FIELDS = Object.freeze(["reps", "weight", "rpe", "rir", "rest", "tempo"]);
const EXTRA_SET_FIELDS = Object.freeze([
  ["setType", "Тип подхода"],
  ["percent1RM", "% от 1ПМ"],
  ["duration", "Время"],
  ["distance", "Дистанция"],
  ["speed", "Скорость"],
  ["side", "Сторона"],
  ["toFailure", "До отказа"],
  ["amrap", "AMRAP"],
  ["note", "Заметка"]
]);

function getExerciseVideo(exercise = {}) {
  return exercise.video || exercise.videoUrl || exercise.videoURL || "";
}

function getCompactWorkoutName(workout = {}, index = 0) {
  return String(workout.name || "")
    .replace(/^Неделя\s*\d+\s*[-–—]\s*/i, "")
    .replace(/^Тренировка\s*\d+\s*[-–—:]?\s*/i, "")
    .trim() || `Тренировка ${index + 1}`;
}

function getSetValue(sets = [], field, fallback = "—") {
  const values = sets.map((set) => String(set?.[field] ?? "").trim()).filter(Boolean);
  if (!values.length) return fallback;
  const unique = [...new Set(values)];
  return unique.length === 1 ? unique[0] : `${unique[0]}–${unique.at(-1)}`;
}

export default function TrainerProgramConstructor({
  styles,
  program,
  months = [],
  exerciseLibrary = [],
  activeWorkoutId,
  onSelectWorkout,
  onProgramNameChange,
  onSaveProgram,
  onDeleteProgram,
  onBack,
  onAddWorkout,
  onUpdateWorkout,
  onDeleteWorkout,
  onDuplicateWorkout,
  onAddExercise,
  onUpdateExercise,
  onUpdateExerciseName,
  onDeleteExercise,
  onDuplicateExercise,
  onMoveExercise,
  onUpdateExerciseSet,
  onAddExerciseSet,
  onRemoveExerciseSet,
  onUploadExerciseVideo,
  exerciseVideoUploadingId
}) {
  const [activeTab, setActiveTab] = useState("exercises");
  const [selectedExerciseId, setSelectedExerciseId] = useState("");
  const [expandedExerciseId, setExpandedExerciseId] = useState("");
  const [exerciseSearchId, setExerciseSearchId] = useState("");
  const [dayMenuId, setDayMenuId] = useState("");
  const [isDayEditorOpen, setIsDayEditorOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const workoutContexts = useMemo(() => months.flatMap((month, monthIndex) =>
    (month.microcycles || month.blocks || []).flatMap((cycle, cycleIndex) =>
      (cycle.weeks || []).flatMap((week, weekIndex) =>
        (week.workouts || []).map((workout, workoutIndex) => ({
          month,
          monthIndex,
          cycle,
          cycleIndex,
          week,
          weekIndex,
          workout,
          workoutIndex
        }))
      )
    )
  ), [months]);

  const activeContext = workoutContexts.find(({ workout }) => workout.id === activeWorkoutId)
    || workoutContexts[0]
    || null;
  const activeWorkout = activeContext?.workout || null;
  const exercises = activeWorkout?.exercises || [];
  const taskBlocks = activeWorkout?.taskBlocks || [];
  const advancedTaskBlocks = taskBlocks.filter((block) => block.type !== WORKOUT_BLOCK_TYPES.EXERCISE);
  const effectiveSelectedExerciseId = selectedExerciseId || exercises[0]?.id || "";
  const totalSets = exercises.reduce((sum, exercise) => sum + Math.max(1, exercise.sets?.length || 0), 0);
  const estimatedMinutes = Math.max(25, Math.round(totalSets * 2.6));
  const duration = activeWorkout?.duration || (totalSets ? `${estimatedMinutes}–${estimatedMinutes + 10} мин` : "—");
  const muscleFocus = String(activeWorkout?.muscleFocus || activeWorkout?.muscles || "Грудные, трицепс");

  function selectWorkout(context) {
    setSelectedExerciseId("");
    setExpandedExerciseId("");
    setActiveTab("exercises");
    onSelectWorkout(context.workout.id);
    setIsDayEditorOpen(true);
  }

  function addDay() {
    const target = activeContext || workoutContexts.at(-1);
    if (target) onAddWorkout(target.cycle.id, target.week.id);
  }

  function updateActiveWorkout(patch) {
    if (!activeContext) return;
    onUpdateWorkout(activeContext.cycle.id, activeContext.week.id, activeContext.workout.id, patch);
  }

  function updateExercise(exerciseId, patch) {
    if (!activeContext) return;
    onUpdateExercise(activeContext.cycle.id, activeContext.week.id, activeContext.workout.id, exerciseId, patch);
  }

  function getLibraryMatches(exercise) {
    const query = String(exercise?.name || "").trim().toLocaleLowerCase("ru");
    if (!query) return [];

    return exerciseLibrary
      .filter((item) => item?.id !== exercise.id && String(item?.name || "").trim().toLocaleLowerCase("ru").includes(query))
      .slice(0, 6);
  }

  function selectLibraryExercise(exercise, libraryExercise) {
    if (!activeContext || !libraryExercise?.name) return;
    onUpdateExerciseName(activeContext.cycle.id, activeContext.week.id, activeContext.workout.id, exercise, libraryExercise.name);
    setExerciseSearchId("");
  }

  function createNamedExercise(exercise) {
    if (!activeContext) return;
    const name = String(exercise?.name || "").trim();
    if (!name) return;
    onUpdateExerciseName(activeContext.cycle.id, activeContext.week.id, activeContext.workout.id, exercise, name);
    setExerciseSearchId("");
  }

  function addTaskBlock(type) {
    if (!activeContext) return;
    if (type === WORKOUT_BLOCK_TYPES.EXERCISE) {
      onAddExercise(activeContext.cycle.id, activeContext.week.id, activeContext.workout.id);
      return;
    }
    updateActiveWorkout({
      taskBlocks: [...taskBlocks, createWorkoutTaskBlock(type)]
    });
  }

  function updateTaskBlock(blockId, patch) {
    updateActiveWorkout({
      taskBlocks: taskBlocks.map((block) => block.id === blockId ? { ...block, ...patch } : block)
    });
  }

  function removeTaskBlock(blockId) {
    updateActiveWorkout({ taskBlocks: taskBlocks.filter((block) => block.id !== blockId) });
  }

  function updateAllSets(exercise, field, value) {
    if (!activeContext) return;
    const sets = exercise.sets || [];
    if (!sets.length) {
      onAddExerciseSet(activeContext.cycle.id, activeContext.week.id, activeContext.workout.id, exercise.id);
      return;
    }
    sets.forEach((_, setIndex) => onUpdateExerciseSet(
      activeContext.cycle.id,
      activeContext.week.id,
      activeContext.workout.id,
      exercise.id,
      setIndex,
      { [field]: value }
    ));
  }

  function getEnabledSetFields(exercise) {
    return exercise.enabledFields?.length ? exercise.enabledFields : DEFAULT_SET_FIELDS;
  }

  function updateSetField(exercise, setIndex, patch) {
    if (!activeContext) return;
    const targetIndexes = exercise.setMode === "uniform"
      ? (exercise.sets || []).map((_, index) => index)
      : [setIndex];
    targetIndexes.forEach((targetIndex) => onUpdateExerciseSet(
      activeContext.cycle.id,
      activeContext.week.id,
      activeContext.workout.id,
      exercise.id,
      targetIndex,
      patch
    ));
  }

  function changeSetCount(exercise, nextValue) {
    if (!activeContext) return;
    const currentCount = Math.max(1, exercise.sets?.length || 0);
    const nextCount = Math.min(12, Math.max(1, Number(nextValue) || 1));
    if (nextCount > currentCount) {
      onAddExerciseSet(
        activeContext.cycle.id,
        activeContext.week.id,
        activeContext.workout.id,
        exercise.id,
        { count: nextCount - currentCount }
      );
    } else if (nextCount < currentCount) {
      for (let index = currentCount - 1; index >= nextCount; index -= 1) {
        onRemoveExerciseSet(activeContext.cycle.id, activeContext.week.id, activeContext.workout.id, exercise.id, index);
      }
    }
  }

  function requestDeleteExercise(exercise) {
    setConfirmDelete({
      title: "Удалить упражнение?",
      text: `«${exercise.name || "Упражнение"}» будет удалено из этого дня.`,
      action: () => {
        onDeleteExercise(activeContext.cycle.id, activeContext.week.id, activeContext.workout.id, exercise.id);
        setConfirmDelete(null);
      }
    });
  }

  function renderDay(context, index) {
    const selected = context.workout.id === activeWorkout?.id;
    const exerciseCount = context.workout.exercises?.length || 0;
    const focus = context.workout.muscleFocus || context.workout.muscles || (exerciseCount ? "Грудные, трицепс" : "Добавьте упражнения");
    return (
      <article className={`${styles.dayCard}${selected ? ` ${styles.selectedDay}` : ""}`} key={context.workout.id}>
        <GripVertical size={16} className={styles.dayGrip} />
        <CalendarDays size={22} className={styles[DAY_COLORS[index % DAY_COLORS.length]]} />
        <button type="button" onClick={() => selectWorkout(context)}>
          <strong>День {index + 1}</strong>
          <span>{getCompactWorkoutName(context.workout, index)}</span>
          <small><i className={styles[DAY_COLORS[index % DAY_COLORS.length]]} />{focus}</small>
        </button>
        <span className={styles.dayMenuWrap}>
          <button type="button" onClick={() => setDayMenuId(dayMenuId === context.workout.id ? "" : context.workout.id)} aria-label={`Действия дня ${index + 1}`}><EllipsisVertical size={17} /></button>
          {dayMenuId === context.workout.id ? (
            <span className={styles.dayMenu}>
              <button type="button" onClick={() => { onDuplicateWorkout(context.cycle.id, context.week.id, context.workout.id); setDayMenuId(""); }}><Copy size={14} />Дублировать</button>
              <button type="button" onClick={() => { onDeleteWorkout(context.cycle.id, context.week.id, context.workout.id); setDayMenuId(""); }}><Trash2 size={14} />Удалить</button>
            </span>
          ) : null}
        </span>
      </article>
    );
  }

  return (
    <section className={styles.constructor}>
      <header className={styles.programBar}>
        <div className={styles.programIcon}><CalendarDays size={25} /></div>
        <label className={styles.programName}>
          <span>Текущая программа</span>
          <span className={styles.nameInputRow}>
            <input value={program?.name || ""} onChange={(event) => onProgramNameChange(event.target.value)} aria-label="Название программы" />
          </span>
        </label>
        <div className={styles.programActions}>
          <button type="button" onClick={onBack}><ArrowLeft size={17} />Назад</button>
          <button className={styles.deleteButton} type="button" onClick={onDeleteProgram}><Trash2 size={17} />Удалить</button>
          <button className={styles.saveButton} type="button" onClick={() => onSaveProgram()}><Save size={17} />Сохранить</button>
        </div>
      </header>

      <div className={`${styles.editorGrid}${isDayEditorOpen ? "" : ` ${styles.editorGridPicker}`}`}>
        <aside className={styles.daysPanel}>
          <h2>Дни программы</h2>
          <div className={styles.daysList}>
            {workoutContexts.map(renderDay)}
            {!workoutContexts.length ? <p className={styles.emptyDays}>В программе пока нет тренировочных дней.</p> : null}
          </div>
          <button className={styles.addDayButton} type="button" onClick={addDay} disabled={!activeContext}><Plus size={17} />Добавить день</button>
        </aside>

        <main
          className={`${styles.dayEditor}${isDayEditorOpen ? ` ${styles.dayEditorModal}` : ""}`}
          role={isDayEditorOpen ? "dialog" : undefined}
          aria-modal={isDayEditorOpen || undefined}
          aria-labelledby="trainer-program-day-editor-title"
        >
          {activeContext ? (
            <>
              <header className={styles.dayEditorModalHeader}>
                <strong id="trainer-program-day-editor-title">Редактор тренировочного дня</strong>
                <button type="button" onClick={() => setIsDayEditorOpen(false)} aria-label="Закрыть редактор дня"><X size={20} /></button>
              </header>
              <div className={styles.breadcrumbs}><span>Программа</span><b>›</b><strong>День {workoutContexts.indexOf(activeContext) + 1}</strong></div>
              <header className={styles.dayHeader}>
                <label>
                  <input value={getCompactWorkoutName(activeWorkout, workoutContexts.indexOf(activeContext))} onChange={(event) => updateActiveWorkout({ name: event.target.value })} aria-label="Название тренировки" />
                  <span>{muscleFocus}</span>
                </label>
                <div className={styles.dayStats}>
                  <span><Dumbbell size={18} /><b>{exercises.length}</b><small>упражнений</small></span>
                  <span><Layers3 size={18} /><b>{totalSets}</b><small>подходов</small></span>
                  <span><Clock3 size={18} /><b>{duration}</b><small>длительность</small></span>
                </div>
              </header>

              <nav className={styles.editorTabs} aria-label="Разделы тренировочного дня">
                <button className={activeTab === "exercises" ? styles.active : ""} type="button" onClick={() => setActiveTab("exercises")}><Dumbbell size={17} />Упражнения</button>
                <button className={activeTab === "notes" ? styles.active : ""} type="button" onClick={() => setActiveTab("notes")}><StickyNote size={17} />Заметки</button>
                <button className={activeTab === "settings" ? styles.active : ""} type="button" onClick={() => setActiveTab("settings")}><Settings2 size={17} />Параметры дня</button>
              </nav>

              {activeTab === "exercises" ? (
                <>
                  {advancedTaskBlocks.length ? <section className={styles.blockBuilder}>
                    <header>
                      <div><strong>Специальные блоки</strong><span>Группы упражнений, интервалы и авторские задания.</span></div>
                    </header>
                    <div className={styles.taskBlockList}>
                      {advancedTaskBlocks.map((block, blockIndex) => {
                        const blockExercises = exercises.filter((exercise) => block.exerciseIds?.includes(exercise.id));
                        const blockTitle = block.type === "group"
                          ? "Группа упражнений"
                          : block.type === "interval"
                            ? "Интервальный блок"
                            : block.type === "free"
                              ? "Инструкция тренера"
                              : "Обычное упражнение";
                        return (
                          <article className={`${styles.taskBlock} ${styles[`taskBlock_${block.type}`] || ""}`} key={block.id}>
                            <header>
                              <span>{blockIndex + 1}</span>
                              <div><strong>{block.title || blockTitle}</strong><small>{blockExercises.map((exercise) => exercise.name).filter(Boolean).join(" · ") || (block.type === "exercise" ? "Выберите упражнение" : "Настройте параметры блока")}</small></div>
                              <button type="button" disabled={block.type === "exercise"} onClick={() => removeTaskBlock(block.id)} aria-label={`Удалить блок ${blockIndex + 1}`}><Trash2 size={14} /></button>
                            </header>
                            {block.type === "group" ? (
                              <div className={styles.blockFields}>
                                <label><span>Формат</span><select value={block.groupMode || "superset"} onChange={(event) => updateTaskBlock(block.id, { groupMode: event.target.value })}><option value="superset">Суперсет</option><option value="triset">Трисет</option><option value="circuit">Круг</option><option value="sequence">По очереди</option></select></label>
                                <label><span>Раунды</span><input type="number" min="1" value={block.rounds || 3} onChange={(event) => updateTaskBlock(block.id, { rounds: Math.max(1, Number(event.target.value) || 1) })} /></label>
                                <label><span>Отдых после раунда</span><input value={block.restAfterRound || ""} onChange={(event) => updateTaskBlock(block.id, { restAfterRound: event.target.value })} /></label>
                                <label className={styles.wideField}><span>Инструкция</span><input value={block.instruction || ""} onChange={(event) => updateTaskBlock(block.id, { instruction: event.target.value })} placeholder="Например, A1 и A2 без отдыха" /></label>
                              </div>
                            ) : null}
                            {block.type === "interval" ? (
                              <div className={styles.blockFields}>
                                <label><span>Раунды</span><input type="number" min="1" value={block.rounds || 8} onChange={(event) => updateTaskBlock(block.id, { rounds: Math.max(1, Number(event.target.value) || 1) })} /></label>
                                <label><span>Работа</span><input value={block.workTime || ""} onChange={(event) => updateTaskBlock(block.id, { workTime: event.target.value })} /></label>
                                <label><span>Отдых</span><input value={block.restTime || ""} onChange={(event) => updateTaskBlock(block.id, { restTime: event.target.value })} /></label>
                                <label><span>Дистанция</span><input value={block.distance || ""} onChange={(event) => updateTaskBlock(block.id, { distance: event.target.value })} /></label>
                                <label><span>Темп</span><input value={block.pace || ""} onChange={(event) => updateTaskBlock(block.id, { pace: event.target.value })} /></label>
                                <label><span>Пульсовая зона</span><input value={block.heartRateZone || ""} onChange={(event) => updateTaskBlock(block.id, { heartRateZone: event.target.value })} /></label>
                                <label className={styles.wideField}><span>Инструкция</span><input value={block.instruction || ""} onChange={(event) => updateTaskBlock(block.id, { instruction: event.target.value })} /></label>
                              </div>
                            ) : null}
                            {block.type === "free" ? <textarea className={styles.freeBlockText} value={block.instruction || ""} onChange={(event) => updateTaskBlock(block.id, { instruction: event.target.value })} placeholder="Опишите нестандартное задание без потери деталей…" /> : null}
                          </article>
                        );
                      })}
                    </div>
                  </section> : null}
                  <div className={styles.exerciseTable}>
                    <div className={styles.exerciseHead}><span>Упражнение</span><span>Подходы</span><span>Повторения</span><span>Вес</span><span>Отдых</span><span /></div>
                    {exercises.map((exercise, index) => {
                      const sets = exercise.sets?.length ? exercise.sets : [{ reps: "", weight: "" }];
                      const video = getExerciseVideo(exercise);
                      const selected = effectiveSelectedExerciseId === exercise.id;
                      const expanded = expandedExerciseId === exercise.id;
                      const usesWeight = exercise.requiresWeight ?? exercise.usesWeight ?? true;
                      return (
                        <article className={`${styles.exerciseCard}${selected ? ` ${styles.selectedExercise}` : ""}`} key={exercise.id || index} onClick={() => setSelectedExerciseId(exercise.id)}>
                          <div className={styles.exerciseRow}>
                            <span className={styles.exerciseOrder}><GripVertical size={15} /><b>{index + 1}</b></span>
                            <span className={styles.exerciseMedia}>
                              {exercise.image || exercise.thumbnail ? <img src={exercise.image || exercise.thumbnail} alt="" /> : video ? <video src={video} muted preload="metadata" /> : <Dumbbell size={22} />}
                            </span>
                            <button className={styles.exerciseName} type="button" onClick={(event) => { event.stopPropagation(); setExpandedExerciseId(expanded ? "" : exercise.id); }}>
                              <strong>{exercise.name || "Упражнение"}</strong>
                              <small className={video ? styles.videoReady : ""}>{video ? "◉ Видео добавлено" : "Без видео"}</small>
                            </button>
                            <div className={styles.exerciseMetrics}>
                              <label className={styles.metricField}><span className={styles.metricLabel}>Подходы</span><input className={styles.metricInput} type="number" min="1" max="12" value={Math.max(1, exercise.sets?.length || 0)} onChange={(event) => changeSetCount(exercise, event.target.value)} aria-label={`Подходы: ${exercise.name || "упражнение"}`} /></label>
                              <label className={styles.metricField}><span className={styles.metricLabel}>Повторы</span><input className={styles.metricInput} value={getSetValue(sets, "reps", "")} onChange={(event) => updateAllSets(exercise, "reps", event.target.value)} aria-label={`Повторения: ${exercise.name || "упражнение"}`} /></label>
                              <label className={styles.metricField}><span className={styles.metricLabel}>Вес</span><span className={styles.metricWithSuffix}><input className={styles.metricInput} disabled={!usesWeight} value={usesWeight ? getSetValue(sets, "weight", "") : "—"} onChange={(event) => updateAllSets(exercise, "weight", event.target.value)} aria-label={`Вес: ${exercise.name || "упражнение"}`} />{usesWeight ? <small>кг</small> : null}</span></label>
                              <label className={styles.metricField}><span className={styles.metricLabel}>Отдых</span><input className={styles.metricInput} value={exercise.rest || "90 сек"} onChange={(event) => updateExercise(exercise.id, { rest: event.target.value })} aria-label={`Отдых: ${exercise.name || "упражнение"}`} /></label>
                            </div>
                            <div className={styles.exerciseActions}>
                              <button type="button" onClick={(event) => { event.stopPropagation(); onDuplicateExercise?.(activeContext.cycle.id, activeContext.week.id, activeContext.workout.id, exercise.id); }} aria-label="Дублировать упражнение"><Copy size={15} /></button>
                              <button type="button" onClick={(event) => { event.stopPropagation(); setExpandedExerciseId(expanded ? "" : exercise.id); }} aria-label="Дополнительные параметры"><MoreVertical size={16} /></button>
                              <button type="button" onClick={(event) => { event.stopPropagation(); requestDeleteExercise(exercise); }} aria-label="Удалить упражнение"><Trash2 size={15} /></button>
                            </div>
                          </div>
                          {expanded ? (
                            <div className={styles.expandedEditor}>
                              <div className={styles.exerciseNameSearch} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setExerciseSearchId(""); }}>
                                <span>Название</span>
                                <input
                                  value={exercise.name || ""}
                                  onFocus={() => setExerciseSearchId(exercise.id)}
                                  onChange={(event) => {
                                    setExerciseSearchId(exercise.id);
                                    onUpdateExerciseName(activeContext.cycle.id, activeContext.week.id, activeContext.workout.id, exercise, event.target.value);
                                  }}
                                  autoComplete="off"
                                  role="combobox"
                                  aria-autocomplete="list"
                                  aria-expanded={exerciseSearchId === exercise.id && Boolean(String(exercise.name || "").trim())}
                                  aria-controls={`exercise-library-options-${exercise.id}`}
                                />
                                {exerciseSearchId === exercise.id && String(exercise.name || "").trim() ? (() => {
                                  const matches = getLibraryMatches(exercise);
                                  return (
                                    <div className={styles.exerciseSearchDropdown} id={`exercise-library-options-${exercise.id}`} role="listbox">
                                      {matches.map((item) => (
                                        <button type="button" role="option" aria-selected="false" key={`${item.id || item.name}-${item.name}`} onClick={() => selectLibraryExercise(exercise, item)}>
                                          <strong>{item.name}</strong>
                                          <small>{getExerciseVideo(item) ? "С видео" : "Без видео"}</small>
                                        </button>
                                      ))}
                                      {!matches.length ? (
                                        <button className={styles.createExerciseOption} type="button" onClick={() => createNamedExercise(exercise)}>
                                          <Plus size={15} />Создать новое упражнение
                                        </button>
                                      ) : null}
                                    </div>
                                  );
                                })() : null}
                              </div>
                              <label><span>Фокус / группа мышц</span><input value={exercise.muscleGroup || ""} onChange={(event) => updateExercise(exercise.id, { muscleGroup: event.target.value })} placeholder="Например, грудные" /></label>
                              <label className={styles.videoUpload}><span>{exerciseVideoUploadingId === exercise.id ? "Загрузка…" : video ? "Заменить видео" : "Добавить видео"}</span><input type="file" accept="video/*" disabled={exerciseVideoUploadingId === exercise.id} onChange={(event) => onUploadExerciseVideo(activeContext.cycle.id, activeContext.week.id, activeContext.workout.id, exercise.id, event.target.files?.[0])} /></label>
                              <span className={styles.moveButtons}>
                                <button type="button" disabled={index === 0} onClick={() => onMoveExercise(activeContext.cycle.id, activeContext.week.id, activeContext.workout.id, exercise.id, -1)}><ChevronUp size={15} />Выше</button>
                                <button type="button" disabled={index === exercises.length - 1} onClick={() => onMoveExercise(activeContext.cycle.id, activeContext.week.id, activeContext.workout.id, exercise.id, 1)}><ChevronDown size={15} />Ниже</button>
                              </span>
                              <section className={styles.setsEditor}>
                                <header>
                                  <strong>Подходы</strong>
                                  <span>Повторы</span>
                                  <span>Вес</span>
                                  <span />
                                </header>
                                {sets.map((set, setIndex) => (
                                  <div className={styles.setRow} key={`${exercise.id}-set-${setIndex}`}>
                                    <b>{setIndex + 1}</b>
                                    {getEnabledSetFields(exercise).includes("reps") ? <input value={set.reps ?? ""} onChange={(event) => updateSetField(exercise, setIndex, { reps: event.target.value })} aria-label={`Повторения, подход ${setIndex + 1}`} /> : <span />}
                                    {getEnabledSetFields(exercise).includes("weight") ? <input disabled={!usesWeight} value={usesWeight ? set.weight ?? "" : "—"} onChange={(event) => updateSetField(exercise, setIndex, { weight: event.target.value })} aria-label={`Вес, подход ${setIndex + 1}`} /> : <span />}
                                    <button type="button" disabled={sets.length <= 1} onClick={() => onRemoveExerciseSet(activeContext.cycle.id, activeContext.week.id, activeContext.workout.id, exercise.id, setIndex)} aria-label={`Удалить подход ${setIndex + 1}`}><Trash2 size={14} /></button>
                                    {EXTRA_SET_FIELDS.some(([field]) => getEnabledSetFields(exercise).includes(field)) ? (
                                      <div className={styles.setAdvanced}>
                                        {EXTRA_SET_FIELDS.filter(([field]) => getEnabledSetFields(exercise).includes(field)).map(([field, label]) => <label key={field}><span>{label}</span>{field === "setType" ? <select value={set[field] || "work"} onChange={(event) => updateSetField(exercise, setIndex, { [field]: event.target.value })}><option value="warmup">Разминка</option><option value="work">Рабочий</option><option value="top">Топ-сет</option><option value="backoff">Back-off</option><option value="drop">Дроп</option></select> : field === "side" ? <select value={set[field] || ""} onChange={(event) => updateSetField(exercise, setIndex, { [field]: event.target.value })}><option value="">Обе</option><option value="left">Левая</option><option value="right">Правая</option></select> : ["toFailure", "amrap"].includes(field) ? <input type="checkbox" checked={Boolean(set[field])} onChange={(event) => updateSetField(exercise, setIndex, { [field]: event.target.checked })} /> : <input value={set[field] ?? ""} onChange={(event) => updateSetField(exercise, setIndex, { [field]: event.target.value })} />}</label>)}
                                      </div>
                                    ) : null}
                                  </div>
                                ))}
                                <footer>
                                  <button type="button" onClick={() => onAddExerciseSet(activeContext.cycle.id, activeContext.week.id, activeContext.workout.id, exercise.id)}><Plus size={15} />Добавить подход</button>
                                  <button type="button" onClick={() => onAddExerciseSet(activeContext.cycle.id, activeContext.week.id, activeContext.workout.id, exercise.id, { empty: true })}>Добавить пустой</button>
                                  <small>Новый подход копирует актуальные параметры первого.</small>
                                </footer>
                              </section>
                            </div>
                          ) : null}
                        </article>
                      );
                    })}
                    {!exercises.length ? <div className={styles.emptyExercises}><Dumbbell size={28} /><strong>Добавьте первое упражнение</strong><span>Параметры подходов, повторений и отдыха появятся здесь.</span></div> : null}
                  </div>
                  <div className={styles.exerciseAddRow}>
                    <button className={styles.addExerciseButton} type="button" onClick={() => onAddExercise(activeContext.cycle.id, activeContext.week.id, activeContext.workout.id)}><Plus size={20} />Добавить упражнение</button>
                    <details className={styles.specialBlockMenu}>
                      <summary><Plus size={17} />Специальный блок</summary>
                      <div>
                        <button type="button" onClick={() => addTaskBlock(WORKOUT_BLOCK_TYPES.GROUP)}>Группа упражнений</button>
                        <button type="button" onClick={() => addTaskBlock(WORKOUT_BLOCK_TYPES.INTERVAL)}>Интервал</button>
                        <button type="button" onClick={() => addTaskBlock(WORKOUT_BLOCK_TYPES.FREE)}>Свободный блок</button>
                      </div>
                    </details>
                  </div>
                </>
              ) : null}

              {activeTab === "notes" ? (
                <section className={styles.tabPanel}>
                  <label><span>Заметки к тренировке</span><textarea value={activeWorkout.notes || ""} onChange={(event) => updateActiveWorkout({ notes: event.target.value })} placeholder="Подсказки по технике, темпу и выполнению…" /></label>
                </section>
              ) : null}

              {activeTab === "settings" ? (
                <section className={styles.tabPanel}>
                  <div className={styles.settingsGrid}>
                    <label><span>Цель тренировки</span><select value={activeWorkout.goal || "hypertrophy"} onChange={(event) => updateActiveWorkout({ goal: event.target.value })}><option value="hypertrophy">Гипертрофия</option><option value="strength">Сила</option><option value="endurance">Выносливость</option><option value="technique">Техника</option></select></label>
                    <label><span>Фокус мышц</span><input value={activeWorkout.muscleFocus || ""} onChange={(event) => updateActiveWorkout({ muscleFocus: event.target.value })} placeholder="Грудные, трицепс" /></label>
                    <label><span>Длительность</span><input value={activeWorkout.duration || ""} onChange={(event) => updateActiveWorkout({ duration: event.target.value })} placeholder="55–65 мин" /></label>
                  </div>
                </section>
              ) : null}
            </>
          ) : <div className={styles.emptyEditor}><Dumbbell size={34} /><strong>В программе пока нет тренировок</strong><span>Добавьте тренировочный день, чтобы открыть редактор.</span></div>}
        </main>

      </div>

      {isDayEditorOpen ? <div className={styles.dayEditorBackdrop} role="presentation" onMouseDown={() => setIsDayEditorOpen(false)} /> : null}

      {confirmDelete ? (
        <div className={styles.modalBackdrop} role="presentation" onMouseDown={() => setConfirmDelete(null)}>
          <section className={styles.confirmModal} role="dialog" aria-modal="true" data-modal-surface="true" aria-labelledby="trainer-program-confirm-title" onMouseDown={(event) => event.stopPropagation()}>
            <h2 id="trainer-program-confirm-title">{confirmDelete.title}</h2><p>{confirmDelete.text}</p>
            <div><button type="button" onClick={() => setConfirmDelete(null)}>Отмена</button><button className={styles.deleteButton} type="button" onClick={confirmDelete.action}>Удалить</button></div>
          </section>
        </div>
      ) : null}
    </section>
  );
}
