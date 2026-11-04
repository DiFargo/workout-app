import ProtectedExerciseVideo from "../media/ProtectedExerciseVideo.jsx";
import TrainerEditorSheet from "./TrainerEditorSheet";
import TrainerExerciseQuickFields from "./TrainerExerciseQuickFields";
import TrainerProgramExerciseAccordion from "./TrainerProgramExerciseAccordion.jsx";
import TrainerExerciseLibraryPicker from "./TrainerExerciseLibraryPicker";
import TrainerExerciseLibrarySearch from "./TrainerExerciseLibrarySearch";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock3,
  Copy,
  Dumbbell,
  EllipsisVertical,
  Layers3,
  MoreVertical,
  Plus,
  Save,
  Settings2,
  StickyNote,
  Trash2,
} from "lucide-react";
import {
  createWorkoutTaskBlock,
  WORKOUT_BLOCK_TYPES
} from "../../utils/universalWorkoutBlocks";
import {
  createTrainerExerciseAlternative,
  getTrainerExerciseAlternatives,
  MAX_TRAINER_EXERCISE_ALTERNATIVES
} from "../../utils/trainerExerciseAlternatives";
import { sanitizeExerciseSetPatch, sanitizeExerciseWeightInput } from "../../utils/exerciseWeightInput";
import { getTrainerExerciseSelectionPatch } from "../../features/trainer/trainerWorkoutEditHelpers";

import { isTrainerV2Path } from "../../app/cssVariant";
import { getTrainerLibraryMuscle, TRAINER_LIBRARY_MUSCLES } from "../../utils/trainerLibraryMuscleGroups";
import { getTrainerProgramExerciseMove } from "../../utils/trainerProgramExerciseOrder.js";

function ConstructorSheet({ styles, title, onClose, children }) {
  return <TrainerEditorSheet title={title} onClose={onClose} className={styles.appleSheet} bodyClassName={styles.appleSheetBody}>{children}</TrainerEditorSheet>;
}

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
    .replace(/^День\s*\d+\s*[-–—:]?\s*/i, "")
    .replace(/^Тренировка\s*\d+\s*[-–—:]?\s*/i, "")
    .trim() || `Тренировка ${index + 1}`;
}

function createGeneratedExerciseId() {
  return `exercise_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function countLabel(value, one, few, many) {
  const tail = value % 100;
  return `${value} ${tail >= 11 && tail <= 14 ? many : value % 10 === 1 ? one : value % 10 >= 2 && value % 10 <= 4 ? few : many}`;
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
  onAddWorkout,
  onUpdateWorkout,
  onDeleteWorkout,
  onDuplicateWorkout,
  onAddExercise,
  onOpenExerciseLibrary,
  onUpdateExercise,
  onDeleteExercise,
  onDuplicateExercise,
  onMoveExercise,
  onUpdateExerciseSet,
  onAddExerciseSet,
  onRemoveExerciseSet,
  showProgramActions = true,
  embeddedInModal = false
}) {
  const apple = isTrainerV2Path(window.location.pathname);
  const pendingDayIds = useRef(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [orderOpen, setOrderOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("exercises");
  const [selectedExerciseId, setSelectedExerciseId] = useState("");
  const [expandedExerciseId, setExpandedExerciseId] = useState("");
  const [openExerciseCard, setOpenExerciseCard] = useState(null);
  const [libraryReplacementId, setLibraryReplacementId] = useState("");
  const [daySettingsOpen, setDaySettingsOpen] = useState(false);
  const [expandedGroupBlockId, setExpandedGroupBlockId] = useState("");
  const [dayMenuId, setDayMenuId] = useState("");
  const dayMenuRef = useRef(null);
  const [isSpecialBlockMenuOpen, setIsSpecialBlockMenuOpen] = useState(false);
  const [isDayEditorOpen, setIsDayEditorOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const openExerciseLibrary = typeof onOpenExerciseLibrary === "function" ? (query) => {
    setLibraryOpen(false);
    setExpandedExerciseId("");
    setExpandedGroupBlockId("");
    onOpenExerciseLibrary(query);
  } : undefined;

  useEffect(() => {
    if (!dayMenuId) return undefined;

    const closeDayMenu = (event) => {
      if (!dayMenuRef.current?.contains(event.target)) {
        setDayMenuId("");
      }
    };
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setDayMenuId("");
    };

    document.addEventListener("pointerdown", closeDayMenu);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeDayMenu);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [dayMenuId]);

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
  const emptyDayTarget = months.flatMap((month) => (month.microcycles || month.blocks || []).flatMap((cycle) => (cycle.weeks || []).map((week) => ({ cycle, week })) ))[0] || null;
  const activeWorkout = activeContext?.workout || null;
  const activeDayIndex = Math.max(0, workoutContexts.findIndex((context) => context.workout.id === activeWorkout?.id));
  const previousDayContext = workoutContexts[activeDayIndex - 1] || null;
  const nextDayContext = workoutContexts[activeDayIndex + 1] || null;
  const exercises = useMemo(() => activeWorkout?.exercises || [], [activeWorkout?.exercises]);
  const taskBlocks = activeWorkout?.taskBlocks || [];
  const advancedTaskBlocks = taskBlocks.filter((block) => block.type !== WORKOUT_BLOCK_TYPES.EXERCISE);
  const groupedExerciseIds = new Set(taskBlocks
    .filter((block) => block.type === WORKOUT_BLOCK_TYPES.GROUP)
    .flatMap((block) => block.exerciseIds || []));
  const exercisesById = new Map(exercises.map((exercise) => [exercise.id, exercise]));
  const orderedExerciseItems = taskBlocks.flatMap((block) => {
    if (block.type === WORKOUT_BLOCK_TYPES.GROUP) {
      return [{ type: "group", block }];
    }

    if (block.type !== WORKOUT_BLOCK_TYPES.EXERCISE) return [];

    return (block.exerciseIds || [])
      .map((exerciseId) => exercisesById.get(exerciseId))
      .filter(Boolean)
      .map((exercise) => ({ type: "exercise", exercise }));
  });
  const renderedExerciseIds = new Set(orderedExerciseItems
    .filter((item) => item.type === "exercise")
    .map((item) => item.exercise.id));
  exercises.forEach((exercise) => {
    if (!groupedExerciseIds.has(exercise.id) && !renderedExerciseIds.has(exercise.id)) {
      orderedExerciseItems.push({ type: "exercise", exercise });
    }
  });
  const effectiveSelectedExerciseId = selectedExerciseId || exercises[0]?.id || "";
  const openExerciseCardId = openExerciseCard?.workoutId === activeWorkout?.id
    ? openExerciseCard.exerciseId
    : orderedExerciseItems.find(item => item.type === "exercise")?.exercise.id || "";
  const totalSets = exercises.reduce((sum, exercise) => sum + Math.max(1, exercise.sets?.length || 0), 0);
  const estimatedMinutes = Math.max(25, Math.round(totalSets * 2.6));
  const duration = activeWorkout?.duration || (totalSets ? `${estimatedMinutes}–${estimatedMinutes + 10} мин` : "—");
  const muscleFocus = String(activeWorkout?.muscleFocus || activeWorkout?.muscles || "");

  const selectWorkout = useCallback((context) => {
    setSelectedExerciseId("");
    setExpandedExerciseId("");
    setDaySettingsOpen(false);
    setLibraryReplacementId("");
    setExpandedGroupBlockId("");
    setDayMenuId("");
    setIsSpecialBlockMenuOpen(false);
    setActiveTab("exercises");
    onSelectWorkout(context.workout.id);
    setIsDayEditorOpen(!apple);
  }, [apple, onSelectWorkout]);

  useEffect(() => {
    if (!pendingDayIds.current) return;
    const added = workoutContexts.find(({ workout }) => !pendingDayIds.current.includes(workout.id));
    if (added) { pendingDayIds.current = null; selectWorkout(added); }
  }, [selectWorkout, workoutContexts]);
  function addDay() {
    const target = activeContext || workoutContexts.at(-1) || emptyDayTarget;
    if (target) { if (apple) pendingDayIds.current = workoutContexts.map(({ workout }) => workout.id); onAddWorkout(target.cycle.id, target.week.id); }
  }

  function updateActiveWorkout(patch) {
    if (!activeContext) return;
    onUpdateWorkout(activeContext.cycle.id, activeContext.week.id, activeContext.workout.id, patch);
  }

  function updateExercise(exerciseId, patch) {
    if (!activeContext) return;
    onUpdateExercise(activeContext.cycle.id, activeContext.week.id, activeContext.workout.id, exerciseId, patch);
  }

  function moveProgramExercise(exerciseId, direction) {
    if (!activeContext) return;
    if (!apple) return onMoveExercise(activeContext.cycle.id, activeContext.week.id, activeWorkout.id, exerciseId, direction);
    const patch = getTrainerProgramExerciseMove(activeWorkout, exerciseId, direction);
    if (patch) updateActiveWorkout(patch);
  }

  function selectLibraryExercise(exercise, libraryExercise) {
    if (!activeContext || !libraryExercise?.name) return;
    updateExercise(exercise.id, getTrainerExerciseSelectionPatch(libraryExercise, exercise));
  }

  function getAvailableTrainerAlternatives(exercise) {
    const selected = new Set(
      getTrainerExerciseAlternatives(exercise)
        .map((item) => String(item.libraryExerciseId || item.id || ""))
    );
    const primaryName = String(exercise?.name || "").trim().toLocaleLowerCase("ru");

    return exerciseLibrary.filter((item) => {
      const itemId = String(item?.id || "");
      const itemName = String(item?.name || "").trim().toLocaleLowerCase("ru");
      return itemName && !item.libraryDeletedAt && itemName !== primaryName && !selected.has(itemId);
    });
  }

  function addTrainerAlternative(exercise, libraryExerciseId) {
    const libraryExercise = exerciseLibrary.find((item) => String(item?.id || "") === String(libraryExerciseId));
    const alternative = createTrainerExerciseAlternative(libraryExercise);
    const alternatives = getTrainerExerciseAlternatives(exercise);
    if (!alternative || alternatives.length >= MAX_TRAINER_EXERCISE_ALTERNATIVES) return;

    updateExercise(exercise.id, {
      trainerAlternatives: [...alternatives, alternative]
    });
  }

  function removeTrainerAlternative(exercise, alternativeId) {
    updateExercise(exercise.id, {
      trainerAlternatives: getTrainerExerciseAlternatives(exercise).filter((item) => (
        String(item.libraryExerciseId || item.id) !== String(alternativeId)
      ))
    });
  }

  function getGroupExerciseLimit(block) {
    return block?.groupMode === "triset" ? 3 : 2;
  }

  function getGroupLabel(groupMode) {
    return groupMode === "triset" ? "Трисет" : "Суперсет";
  }

  function getGroupExercises(block) {
    return (block?.exerciseIds || [])
      .map((exerciseId) => exercisesById.get(exerciseId))
      .filter(Boolean);
  }

  function createGroupExerciseFromLibrary(libraryExercise, currentExercise = null) {
    return {
      ...(currentExercise || {}),
      id: createGeneratedExerciseId(),
      ...getTrainerExerciseSelectionPatch(libraryExercise, currentExercise),
      sets: currentExercise?.sets?.length
        ? currentExercise.sets.map((set) => ({ ...set }))
        : [{ reps: 8, weight: "" }]
    };
  }

  function selectGroupLibraryExercise(block, slotIndex, libraryExercise) {
    if (!activeContext || !libraryExercise?.name) return;

    const currentIds = [...(block.exerciseIds || [])];
    const previousExerciseId = currentIds[slotIndex] || "";
    const previousExercise = exercisesById.get(previousExerciseId) || null;
    const nextExercise = createGroupExerciseFromLibrary(libraryExercise, previousExercise);
    const nextIds = [...currentIds];
    nextIds[slotIndex] = nextExercise.id;

    updateActiveWorkout({
      exercises: previousExerciseId
        ? exercises.map((exercise) => exercise.id === previousExerciseId ? nextExercise : exercise)
        : [...exercises, nextExercise],
      taskBlocks: taskBlocks.map((item) => item.id === block.id
        ? { ...item, exerciseIds: nextIds.filter(Boolean).slice(0, getGroupExerciseLimit(block)) }
        : item)
    });
  }

  function removeGroupExercise(block, slotIndex) {
    const exerciseId = block.exerciseIds?.[slotIndex];
    if (!exerciseId) return;

    updateActiveWorkout({
      exercises: exercises.filter((exercise) => exercise.id !== exerciseId),
      taskBlocks: taskBlocks.map((item) => item.id === block.id
        ? { ...item, exerciseIds: (item.exerciseIds || []).filter((_, index) => index !== slotIndex) }
        : item)
    });
  }

  function addExerciseGroup(groupMode) {
    if (!activeContext) return;
    setIsSpecialBlockMenuOpen(false);
    const block = createWorkoutTaskBlock(WORKOUT_BLOCK_TYPES.GROUP, { groupMode });
    updateActiveWorkout({
      taskBlocks: [...taskBlocks, block]
    });
    setExpandedGroupBlockId(block.id);
  }

  function updateTaskBlock(blockId, patch) {
    updateActiveWorkout({
      taskBlocks: taskBlocks.map((block) => block.id === blockId ? { ...block, ...patch } : block)
    });
  }

  function duplicateTaskBlock(block) {
    if (!activeContext || block?.type !== WORKOUT_BLOCK_TYPES.GROUP) return;
    const sourceExercises = getGroupExercises(block);
    const clonedExercises = sourceExercises.map((exercise) => ({
      ...exercise,
      id: createGeneratedExerciseId(),
      sets: (exercise.sets || []).map((set) => ({ ...set }))
    }));
    const duplicate = createWorkoutTaskBlock(WORKOUT_BLOCK_TYPES.GROUP, {
      ...block,
      id: "",
      title: block.title || getGroupLabel(block.groupMode),
      exerciseIds: clonedExercises.map((exercise) => exercise.id)
    });
    const blockIndex = taskBlocks.findIndex((item) => item.id === block.id);

    updateActiveWorkout({
      exercises: [...exercises, ...clonedExercises],
      taskBlocks: [
        ...taskBlocks.slice(0, blockIndex + 1),
        duplicate,
        ...taskBlocks.slice(blockIndex + 1)
      ]
    });
  }

  function moveTaskBlock(blockId, direction) {
    const blockIndex = taskBlocks.findIndex((block) => block.id === blockId);
    const targetIndex = blockIndex + direction;
    if (blockIndex < 0 || targetIndex < 0 || targetIndex >= taskBlocks.length) return;

    const nextBlocks = [...taskBlocks];
    [nextBlocks[blockIndex], nextBlocks[targetIndex]] = [nextBlocks[targetIndex], nextBlocks[blockIndex]];
    updateActiveWorkout({ taskBlocks: nextBlocks });
  }

  function removeTaskBlock(blockId) {
    const removedBlock = taskBlocks.find((block) => block.id === blockId);
    const removedExerciseIds = new Set(removedBlock?.type === WORKOUT_BLOCK_TYPES.GROUP
      ? removedBlock.exerciseIds || []
      : []);
    updateActiveWorkout({
      exercises: removedExerciseIds.size
        ? exercises.filter((exercise) => !removedExerciseIds.has(exercise.id))
        : exercises,
      taskBlocks: taskBlocks.filter((block) => block.id !== blockId)
    });
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
      sanitizeExerciseSetPatch(patch)
    ));
  }

  function requestDeleteExercise(exercise) {
    if (apple) setExpandedExerciseId("");
    setConfirmDelete({
      title: "Удалить из тренировки?",
      text: `«${exercise.name || "Упражнение"}» будет удалено только из этой тренировки. В библиотеке упражнение сохранится.`,
      confirmLabel: "Удалить из тренировки",
      action: () => {
        onDeleteExercise(activeContext.cycle.id, activeContext.week.id, activeContext.workout.id, exercise.id);
        setConfirmDelete(null);
      }
    });
  }

  function requestDeleteTaskBlock(block) {
    const label = block?.title || getGroupLabel(block?.groupMode);
    setConfirmDelete({
      title: `Удалить ${label.toLocaleLowerCase("ru")}?`,
      text: "Вместе с блоком будут удалены его упражнения из этого тренировочного дня.",
      action: () => {
        removeTaskBlock(block.id);
        setConfirmDelete(null);
      }
    });
  }

  function renderGroupExerciseCard(block, itemIndex) {
    const blockExercises = getGroupExercises(block);
    const expanded = expandedGroupBlockId === block.id;
    const groupLabel = getGroupLabel(block.groupMode);
    const groupExerciseLimit = getGroupExerciseLimit(block);
    const blockPosition = taskBlocks.findIndex((item) => item.id === block.id);

    return (
      <article
        className={`${styles.exerciseCard} ${styles.groupExerciseCard}${expanded ? ` ${styles.selectedExercise}` : ""}`}
        key={block.id}
      >
        <div className={styles.exerciseRow}>
          <span className={styles.exerciseOrder}><b>{itemIndex + 1}</b></span>
          <span className={`${styles.exerciseMedia} ${styles.groupExerciseMedia}`}><Layers3 size={22} /></span>
          <button
            className={styles.exerciseName}
            type="button"
            onClick={() => setExpandedGroupBlockId(expanded ? "" : block.id)}
            aria-expanded={expanded}
          >
            <strong>{block.title || groupLabel}</strong>
            <small>{blockExercises.length ? blockExercises.map((exercise) => exercise.name).join(" · ") : "Добавьте упражнения из библиотеки"}</small>
          </button>
          <div className={styles.exerciseMetrics}>
            <span className={styles.groupMetric}><small>Раунды</small><b>{Math.max(1, Number(block.rounds) || 1)}</b></span>
            <span className={styles.groupMetric}><small>Упражнения</small><b>{blockExercises.length}/{groupExerciseLimit}</b></span>
            <span className={styles.groupMetric}><small>Отдых</small><b>{block.restAfterRound || "90 сек"}</b></span>
          </div>
          <div className={styles.exerciseActions}>
            <button type="button" onClick={() => duplicateTaskBlock(block)} aria-label={`Дублировать ${groupLabel.toLowerCase()}`}><Copy size={15} /></button>
            <button type="button" onClick={() => setExpandedGroupBlockId(expanded ? "" : block.id)} aria-label={expanded ? "Свернуть блок" : "Развернуть блок"}>{expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</button>
          </div>
        </div>

        {expanded ? (
          <div className={`${styles.expandedEditor} ${styles.groupExpandedEditor}`}>
            <section className={styles.groupExerciseEditor}>
              <header><strong>Упражнения из библиотеки</strong><span>{groupLabel}: один подход каждого упражнения за круг</span></header>
              <div className={styles.groupExerciseSlots}>
                {Array.from({ length: groupExerciseLimit }, (_, slotIndex) => {
                  const selectedExercise = blockExercises[slotIndex] || null;
                  return (
                    <div className={styles.groupExerciseSlot} key={`${block.id}-exercise-slot-${slotIndex}`}>
                      <b>{`A${slotIndex + 1}`}</b>
                      <TrainerExerciseLibrarySearch key={`${block.id}:${slotIndex}:${selectedExercise?.id || "empty"}`}
                        exercise={selectedExercise} items={exerciseLibrary}
                        label={`Упражнение ${slotIndex + 1} в ${groupLabel.toLowerCase()}`}
                        onSelect={(source) => selectGroupLibraryExercise(block, slotIndex, source)}
                        onOpenLibrary={openExerciseLibrary} />
                      {selectedExercise ? <button type="button" onClick={() => removeGroupExercise(block, slotIndex)} aria-label={`Убрать ${selectedExercise.name}`}><Trash2 size={14} /></button> : null}
                    </div>
                  );
                })}
              </div>
            </section>
            <div className={styles.blockFields}>
              <label><span>Раунды</span><input type="number" min="1" value={block.rounds || 3} onChange={(event) => updateTaskBlock(block.id, { rounds: Math.max(1, Number(event.target.value) || 1) })} /></label>
              <label><span>Отдых после круга</span><input value={block.restAfterRound || ""} onChange={(event) => updateTaskBlock(block.id, { restAfterRound: event.target.value })} /></label>
              <label className={styles.wideField}><span>Инструкция</span><input value={block.instruction || ""} onChange={(event) => updateTaskBlock(block.id, { instruction: event.target.value })} placeholder="Например, без отдыха между A1, A2 и A3" /></label>
            </div>
            <span className={styles.moveButtons}>
              <button type="button" disabled={blockPosition <= 0} onClick={() => moveTaskBlock(block.id, -1)}><ChevronUp size={15} />Выше</button>
              <button type="button" disabled={blockPosition >= taskBlocks.length - 1} onClick={() => moveTaskBlock(block.id, 1)}><ChevronDown size={15} />Ниже</button>
            </span>
            <button className={styles.deleteExerciseButton} type="button" onClick={() => requestDeleteTaskBlock(block)}><Trash2 size={16} />Удалить {groupLabel.toLowerCase()}</button>
          </div>
        ) : null}
      </article>
    );
  }

  function renderDay(context, index) {
    const selected = context.workout.id === activeWorkout?.id;
    const exerciseCount = context.workout.exercises?.length || 0;
    const focus = context.workout.muscleFocus || context.workout.muscles || (exerciseCount ? `${exerciseCount} упр.` : "Добавьте упражнения");
    return (
      <article className={`${styles.dayCard}${selected ? ` ${styles.selectedDay}` : ""}`} key={context.workout.id}>
        {apple ? <span className={styles.appleDayNumber}>{index + 1}</span> : <CalendarDays size={22} className={styles[DAY_COLORS[index % DAY_COLORS.length]]} />}
        <button type="button" onClick={() => selectWorkout(context)}>
          <strong>День {index + 1}</strong>
          <span>{getCompactWorkoutName(context.workout, index)}</span>
          <small><i className={styles[DAY_COLORS[index % DAY_COLORS.length]]} />{focus}</small>
        </button>
        <span
          className={styles.dayMenuWrap}
          ref={dayMenuId === context.workout.id ? dayMenuRef : null}
        >
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
    <section data-trainer-constructor="true" data-program-layout={apple ? "cards" : undefined} className={`${styles.constructor}${apple ? ` ${styles.appleConstructor}` : ""}${embeddedInModal ? ` ${styles.embeddedInModal}` : ""}`}>
      <header data-constructor-surface="true" className={styles.programBar}>
        <div data-constructor-primary="true" className={styles.programIcon}><CalendarDays size={25} /></div>
        <label className={styles.programName}>
          <span>Название программы</span>
          <span className={styles.nameInputRow}>
            <input value={program?.name || ""} onChange={(event) => onProgramNameChange(event.target.value)} aria-label="Название программы" maxLength={80} placeholder="Например, Фулл бади" />
          </span>
        </label>
        {showProgramActions ? (
          <div className={styles.programActions} data-trainer-modal-footer="true">
            <button className={styles.deleteButton} type="button" onClick={onDeleteProgram}><Trash2 size={17} />Удалить</button>
            <button data-constructor-primary="true" className={styles.saveButton} type="button" onClick={() => onSaveProgram()}><Save size={17} />Сохранить</button>
          </div>
        ) : null}
      </header>

      <div className={`${styles.editorGrid}${isDayEditorOpen ? "" : ` ${styles.editorGridPicker}`}`}>
        <aside className={styles.daysPanel}>
          <h2>Дни программы {apple ? <small>{workoutContexts.length}</small> : null}</h2>
          <div className={styles.daysList}>
            {workoutContexts.map(renderDay)}
            {!workoutContexts.length ? <p className={styles.emptyDays}>В программе пока нет тренировочных дней.</p> : null}
          </div>
          <button className={styles.addDayButton} type="button" onClick={addDay} disabled={!activeContext && !emptyDayTarget}><Plus size={17} />Добавить день</button>
        </aside>

        <main
          className={`${styles.dayEditor}${isDayEditorOpen ? ` ${styles.dayEditorModal}` : ""}`}
          role={isDayEditorOpen && !embeddedInModal ? "dialog" : undefined}
          aria-modal={isDayEditorOpen && !embeddedInModal ? true : undefined}
          data-trainer-modal-surface={isDayEditorOpen && !embeddedInModal ? "true" : undefined}
          data-trainer-modal-floating={isDayEditorOpen && !embeddedInModal ? "true" : undefined}
          aria-labelledby="trainer-program-day-editor-title"
        >
          {activeContext ? (
            <>
              <section className={styles.dayEditorSurface}>
                {apple ? <div className={styles.appleMobileDays}><select aria-label="День программы" value={activeWorkout.id} onChange={(event) => selectWorkout(workoutContexts.find((item) => item.workout.id === event.target.value))}>{workoutContexts.map((item, index) => <option key={item.workout.id} value={item.workout.id}>День {index + 1} · {getCompactWorkoutName(item.workout, index)}</option>)}</select><button type="button" onClick={addDay} aria-label="Добавить день"><Plus size={20} /></button></div> : null}
                <header className={styles.dayEditorModalHeader}>
                  <button
                    className={styles.dayNavigatorButton}
                    type="button"
                    disabled={!previousDayContext}
                    onClick={() => previousDayContext && selectWorkout(previousDayContext)}
                    aria-label="Предыдущий тренировочный день"
                    title="Предыдущий день"
                  >
                    <ChevronUp size={21} />
                    <span>{previousDayContext ? `День ${activeDayIndex}` : "Предыдущий"}</span>
                  </button>
                  <div className={styles.dayEditorTitle}>
                    <span>Редактор тренировочного дня</span>
                    <strong id="trainer-program-day-editor-title">День {activeDayIndex + 1} из {workoutContexts.length}</strong>
                  </div>
                  <button
                    className={styles.dayNavigatorButton}
                    type="button"
                    disabled={!nextDayContext}
                    onClick={() => nextDayContext && selectWorkout(nextDayContext)}
                    aria-label="Следующий тренировочный день"
                    title="Следующий день"
                  >
                    <span>{nextDayContext ? `День ${activeDayIndex + 2}` : "Следующий"}</span>
                    <ChevronDown size={21} />
                  </button>
                </header>
                <div className={styles.dayEditorContent}>
                  <div className={styles.breadcrumbs}>
                    <button
                      type="button"
                      className={styles.returnToDaysButton}
                      onClick={() => setIsDayEditorOpen(false)}
                      aria-label="Свернуть тренировочный день"
                    >
      <CalendarDays size={16} />Все дни программы
                    </button>
                  </div>
                  <header className={styles.dayHeader}>
                <label>
                  <input value={getCompactWorkoutName(activeWorkout, activeDayIndex)} onChange={(event) => updateActiveWorkout({ name: event.target.value })} aria-label="Название тренировки" />
                  <span>{apple ? `${countLabel(exercises.length, "упражнение", "упражнения", "упражнений")} · ${countLabel(totalSets, "подход", "подхода", "подходов")}${muscleFocus ? ` · ${muscleFocus}` : ""}` : muscleFocus}</span>
                </label>
                {apple ? <button className={styles.appleCopyDay} type="button" onClick={() => setDaySettingsOpen(true)} aria-label="Настройки дня"><Settings2 size={18} aria-hidden="true" /><span>Настройки дня</span></button> : null}
                <div className={styles.dayStats}>
                  <span><Dumbbell size={18} /><b>{exercises.length}</b><small>упражнений</small></span>
                  <span><Layers3 size={18} /><b>{totalSets}</b><small>подходов</small></span>
                  <span><Clock3 size={18} /><b>{duration}</b><small>длительность</small></span>
                </div>
              </header>

                  <nav className={styles.editorTabs} aria-label="Разделы тренировочного дня" hidden={apple}>
                <button className={activeTab === "exercises" ? styles.active : ""} type="button" onClick={() => setActiveTab("exercises")}><Dumbbell size={17} />Упражнения</button>
                <button className={activeTab === "notes" ? styles.active : ""} type="button" onClick={() => setActiveTab("notes")}><StickyNote size={17} />Заметки</button>
                <button className={activeTab === "settings" ? styles.active : ""} type="button" onClick={() => setActiveTab("settings")}><Settings2 size={17} />Параметры дня</button>
              </nav>

              {activeTab === "exercises" ? (
                <>
                  {advancedTaskBlocks.some((block) => block.type !== WORKOUT_BLOCK_TYPES.GROUP) ? <section className={styles.blockBuilder}>
                    <header>
                      <div><strong>Специальные блоки</strong><span>Интервалы и инструкции тренера.</span></div>
                    </header>
                    <div className={styles.taskBlockList}>
                      {advancedTaskBlocks.map((block, blockIndex) => {
                        if (block.type === WORKOUT_BLOCK_TYPES.GROUP) return null;
                        const blockExercises = exercises.filter((exercise) => block.exerciseIds?.includes(exercise.id));
                        const blockTitle = block.type === "interval"
                          ? "Интервальный блок"
                          : block.type === "free"
                            ? "Инструкция тренера"
                            : "Специальный блок";
                        return (
                          <article className={`${styles.taskBlock} ${styles[`taskBlock_${block.type}`] || ""}`} key={block.id}>
                            <header>
                              <span>{blockIndex + 1}</span>
                              <div><strong>{block.title || blockTitle}</strong><small>{blockExercises.map((exercise) => exercise.name).filter(Boolean).join(" · ") || "Настройте параметры блока"}</small></div>
                              <button type="button" disabled={block.type === "exercise"} onClick={() => removeTaskBlock(block.id)} aria-label={`Удалить блок ${blockIndex + 1}`}><Trash2 size={14} /></button>
                            </header>
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
                  {apple ? <div className={styles.appleSectionHead}><h3>Упражнения</h3><button type="button" onClick={() => setOrderOpen(true)}>Изменить порядок</button></div> : null}
                  <div className={styles.exerciseTable}>
                    <div className={styles.exerciseHead}><span>Упражнение</span><span>Подходы</span><span>Повторения</span><span>Вес</span><span>Отдых</span><span /></div>
                    {orderedExerciseItems.map((item, index) => {
                      if (item.type === "group") return renderGroupExerciseCard(item.block, index);
                      const exercise = item.exercise;
                      const exerciseIndex = exercises.findIndex((current) => current.id === exercise.id);
                      const sets = exercise.sets?.length ? exercise.sets : [{ reps: "", weight: "" }];
                      const video = getExerciseVideo(exercise);
                      const selected = !apple && effectiveSelectedExerciseId === exercise.id;
                      const expanded = expandedExerciseId === exercise.id;
                      const usesWeight = exercise.requiresWeight ?? exercise.usesWeight ?? true;
                      const alternativeCount = getTrainerExerciseAlternatives(exercise).length;
                      return (
                        <Fragment key={`${activeWorkout.id}:${exercise.id || index}`}>
                          {apple ? <TrainerProgramExerciseAccordion
                            exercise={exercise} index={index}
                            muscle={TRAINER_LIBRARY_MUSCLES.find(([id]) => id === getTrainerLibraryMuscle(exercise))?.[1] || "Без группы"}
                            expanded={openExerciseCardId === exercise.id}
                            onToggle={() => setOpenExerciseCard({ workoutId: activeWorkout.id, exerciseId: openExerciseCardId === exercise.id ? "" : exercise.id })}
                            onChange={patch => updateExercise(exercise.id, patch)}
                            onOpenDetails={() => setExpandedExerciseId(exercise.id)}
                            onChooseExercise={() => { setLibraryReplacementId(exercise.id); setLibraryOpen(true); }}
                            onDuplicate={() => onDuplicateExercise?.(activeContext.cycle.id, activeContext.week.id, activeWorkout.id, exercise.id)}
                            onDelete={() => requestDeleteExercise(exercise)}
                            onMoveUp={() => moveProgramExercise(exercise.id, -1)}
                            onMoveDown={() => moveProgramExercise(exercise.id, 1)}
                            canMoveUp={Boolean(getTrainerProgramExerciseMove(activeWorkout, exercise.id, -1))} canMoveDown={Boolean(getTrainerProgramExerciseMove(activeWorkout, exercise.id, 1))}
                            availableAlternatives={getAvailableTrainerAlternatives(exercise)}
                            onAddAlternative={id => addTrainerAlternative(exercise, id)}
                            onRemoveAlternative={id => removeTrainerAlternative(exercise, id)}
                          /> : null}
                          {!apple || expanded ? <article className={!apple ? `${styles.exerciseCard}${selected ? ` ${styles.selectedExercise}` : ""}` : undefined} onClick={() => setSelectedExerciseId(exercise.id)}>
                          {!apple ? <div className={styles.exerciseRow}>
                            <span className={styles.exerciseOrder}><b>{index + 1}</b></span>
                            <span className={styles.exerciseMedia}>
                              {exercise.image || exercise.thumbnail ? <img src={exercise.image || exercise.thumbnail} alt="" /> : video ? <ProtectedExerciseVideo src={video} previewTime={exercise.videoPosterTime} muted preload="metadata" /> : <Dumbbell size={22} />}
                            </span>
                            <button className={styles.exerciseName} type="button" onClick={(event) => { event.stopPropagation(); setExpandedExerciseId(expanded ? "" : exercise.id); }}>
                              <strong>{exercise.name || "Упражнение"}</strong>
                              <small className={video ? styles.videoReady : ""}>{apple ? (exercise.muscleGroup || TRAINER_LIBRARY_MUSCLES.find(([id]) => id === getTrainerLibraryMuscle(exercise))?.[1] || (video ? "Видео добавлено" : "")) : video ? "◉ Видео добавлено" : "Без видео"}{alternativeCount ? ` · ${alternativeCount} альт.` : ""}</small>
                            </button>
                            <TrainerExerciseQuickFields className={styles.exerciseMetrics} exercise={exercise} onChange={(patch) => updateExercise(exercise.id, patch)} onDetails={() => setExpandedExerciseId(exercise.id)} />
                            <div className={styles.exerciseActions}>
                              <button className={apple ? styles.appleHidden : undefined} type="button" onClick={(event) => { event.stopPropagation(); onDuplicateExercise?.(activeContext.cycle.id, activeContext.week.id, activeContext.workout.id, exercise.id); }} aria-label="Дублировать упражнение"><Copy size={15} /></button>
                              <button type="button" onClick={(event) => { event.stopPropagation(); setExpandedExerciseId(expanded ? "" : exercise.id); }} aria-label="Дополнительные параметры">{apple ? <ChevronRight size={18} /> : <MoreVertical size={16} />}</button>
                            </div>
                          </div> : null}
                          {expanded ? (
                            <ExerciseEditorContainer apple={apple} styles={styles} onClose={() => setExpandedExerciseId("")}>
                            <div className={styles.expandedEditor}>
                              {apple ? <button type="button" onClick={() => onDuplicateExercise?.(activeContext.cycle.id, activeContext.week.id, activeWorkout.id, exercise.id)}><Copy size={16} /> Создать копию упражнения</button> : null}
                              <TrainerExerciseLibrarySearch key={exercise.id} exercise={exercise} items={exerciseLibrary}
                                onSelect={(source) => selectLibraryExercise(exercise, source)}
                                onOpenLibrary={openExerciseLibrary} />
                              <label><span>Фокус / группа мышц</span><input value={exercise.muscleGroup || ""} onChange={(event) => updateExercise(exercise.id, { muscleGroup: event.target.value })} placeholder="Например, грудные" /></label>
                              {apple ? <section className={styles.appleVideoPreview} aria-label="Видео упражнения">
                                {video ? <><strong>Текущее видео</strong><ProtectedExerciseVideo key={video} src={video} previewTime={exercise.videoPosterTime} poster={exercise.image || exercise.thumbnail || undefined} controls playsInline preload="metadata" aria-label={`Видео: ${exercise.name || "упражнение"}`} data-testid="trainer-program-exercise-video" /></> : null}
                                <small>Видео можно изменить в библиотеке упражнений.</small>
                              </section> : null}
                              <span className={styles.moveButtons}>
                                <button type="button" disabled={apple ? !getTrainerProgramExerciseMove(activeWorkout, exercise.id, -1) : exerciseIndex === 0} onClick={() => moveProgramExercise(exercise.id, -1)}><ChevronUp size={15} />Выше</button>
                                <button type="button" disabled={apple ? !getTrainerProgramExerciseMove(activeWorkout, exercise.id, 1) : exerciseIndex === exercises.length - 1} onClick={() => moveProgramExercise(exercise.id, 1)}><ChevronDown size={15} />Ниже</button>
                              </span>
                              <details open={!apple || undefined} className={styles.appleAlternatives}><summary>Альтернативы для клиента</summary><section className={styles.alternativeEditor}>
                                <header>
                                  <div>
                                    <strong>Альтернативы для клиента</strong>
                                    <small>Клиент сможет выбрать только назначенные вами варианты.</small>
                                  </div>
                                  <span>{getTrainerExerciseAlternatives(exercise).length}/{MAX_TRAINER_EXERCISE_ALTERNATIVES}</span>
                                </header>
                                {getTrainerExerciseAlternatives(exercise).length ? (
                                  <div className={styles.alternativeList}>
                                    {getTrainerExerciseAlternatives(exercise).map((alternative) => (
                                      <span key={alternative.libraryExerciseId || alternative.id}>
                                        {alternative.name}
                                        <button
                                          type="button"
                                          aria-label={`Удалить альтернативу «${alternative.name}»`}
                                          onClick={() => removeTrainerAlternative(exercise, alternative.libraryExerciseId || alternative.id)}
                                        >×</button>
                                      </span>
                                    ))}
                                  </div>
                                ) : null}
                                <label>
                                  <span>Добавить вариант из библиотеки</span>
                                  <select
                                    value=""
                                    disabled={getTrainerExerciseAlternatives(exercise).length >= MAX_TRAINER_EXERCISE_ALTERNATIVES || !getAvailableTrainerAlternatives(exercise).length}
                                    onChange={(event) => addTrainerAlternative(exercise, event.target.value)}
                                    aria-label={`Добавить альтернативу для ${exercise.name || "упражнения"}`}
                                  >
                                    <option value="">{getTrainerExerciseAlternatives(exercise).length >= MAX_TRAINER_EXERCISE_ALTERNATIVES ? "Добавлено максимум вариантов" : "Выберите упражнение"}</option>
                                    {getAvailableTrainerAlternatives(exercise).map((item) => <option key={item.id || item.name} value={item.id}>{item.name}</option>)}
                                  </select>
                                </label>
                              </section>
                              </details><section className={styles.setsEditor}>
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
                                    {getEnabledSetFields(exercise).includes("weight") ? <input inputMode="decimal" disabled={!usesWeight} value={usesWeight ? sanitizeExerciseWeightInput(set.weight) ?? "" : "—"} onChange={(event) => updateSetField(exercise, setIndex, { weight: sanitizeExerciseWeightInput(event.target.value) })} aria-label={`Вес, подход ${setIndex + 1}`} /> : <span />}
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
                              <button className={styles.deleteExerciseButton} type="button" onClick={() => requestDeleteExercise(exercise)}>
                                <Trash2 size={16} />Удалить из тренировки
                              </button>
                            </div>
                            </ExerciseEditorContainer>
                          ) : null}
                          </article> : null}
                        </Fragment>
                      );
                    })}
                    {!orderedExerciseItems.length ? <div className={styles.emptyExercises}><Dumbbell size={28} /><strong>Добавьте первое упражнение</strong><span>Параметры подходов, повторений и отдыха появятся здесь.</span></div> : null}
                  </div>
                  <div className={styles.exerciseAddRow}>
                    <button className={styles.addExerciseButton} type="button" onClick={() => { setLibraryReplacementId(""); setLibraryOpen(true); }}><Plus size={20} />{apple ? "Добавить из библиотеки" : "Добавить упражнение"}</button>
                    <div className={styles.specialBlockMenu}>
                      <button
                        type="button"
                        aria-haspopup="menu"
                        aria-expanded={isSpecialBlockMenuOpen}
                        onClick={() => setIsSpecialBlockMenuOpen((current) => !current)}
                      ><Plus size={17} />Добавить формат</button>
                      {isSpecialBlockMenuOpen ? <div role="menu" aria-label="Тип специального блока">
                        <button type="button" onClick={() => { setIsSpecialBlockMenuOpen(false); setLibraryOpen(true); }}>Обычный сет</button>
                        <button type="button" onClick={() => addExerciseGroup("superset")}>Суперсет · 2 упражнения</button>
                        <button type="button" onClick={() => addExerciseGroup("triset")}>Трисет · 3 упражнения</button>
                      </div> : null}
                    </div>
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
                  {apple ? <button className={styles.deleteExerciseButton} type="button" onClick={() => onDeleteWorkout(activeContext.cycle.id, activeContext.week.id, activeWorkout.id)}><Trash2 size={16} />Удалить день</button> : null}
                  <div className={styles.settingsGrid}>
                    <label><span>Цель тренировки</span><select value={activeWorkout.goal || "hypertrophy"} onChange={(event) => updateActiveWorkout({ goal: event.target.value })}><option value="hypertrophy">Гипертрофия</option><option value="strength">Сила</option><option value="endurance">Выносливость</option><option value="technique">Техника</option></select></label>
                    <label><span>Фокус мышц</span><input value={activeWorkout.muscleFocus || ""} onChange={(event) => updateActiveWorkout({ muscleFocus: event.target.value })} placeholder="Грудные, трицепс" /></label>
                    <label><span>Длительность</span><input value={activeWorkout.duration || ""} onChange={(event) => updateActiveWorkout({ duration: event.target.value })} placeholder="55–65 мин" /></label>
                  </div>
                </section>
              ) : null}
                </div>
              </section>
            </>
          ) : <div className={styles.emptyEditor}><Dumbbell size={34} /><strong>В программе пока нет тренировок</strong><span>Добавьте тренировочный день, чтобы открыть редактор.</span>{apple ? <button type="button" onClick={addDay} disabled={!emptyDayTarget}><Plus size={18} />Добавить день</button> : null}</div>}
        </main>

      </div>

      {isDayEditorOpen && !embeddedInModal ? <div className={styles.dayEditorBackdrop} data-trainer-modal-backdrop="true" role="presentation" onMouseDown={() => setIsDayEditorOpen(false)} /> : null}

      <TrainerExerciseLibraryPicker open={libraryOpen && Boolean(activeContext)} items={exerciseLibrary}
        title={libraryReplacementId ? "Выбрать упражнение" : "Добавить упражнение"}
        onClose={() => { setLibraryOpen(false); setLibraryReplacementId(""); }} onOpenLibrary={openExerciseLibrary}
        onSelect={(item) => {
          if (!activeContext) return false;
          const replacing = libraryReplacementId && exercises.find(exercise => exercise.id === libraryReplacementId);
          if (replacing) {
            selectLibraryExercise(replacing, item);
            setLibraryOpen(false);
            setLibraryReplacementId("");
            return true;
          }
          return onAddExercise(activeContext.cycle.id, activeContext.week.id, activeWorkout.id, item);
        }} />
      {apple && daySettingsOpen && activeContext ? <ConstructorSheet styles={styles} title="Настройки дня" onClose={() => setDaySettingsOpen(false)}>
        <div className={styles.tabPanel}>
          <label><span>Название дня</span><input value={getCompactWorkoutName(activeWorkout, activeDayIndex)} onChange={event => updateActiveWorkout({ name: event.target.value })} /></label>
          <label><span>Заметки к тренировке</span><textarea value={activeWorkout.notes || ""} onChange={event => updateActiveWorkout({ notes: event.target.value })} placeholder="Важные детали для этого дня" /></label>
          <div className={styles.settingsGrid}>
            <label><span>Цель тренировки</span><select value={activeWorkout.goal || "hypertrophy"} onChange={event => updateActiveWorkout({ goal: event.target.value })}><option value="hypertrophy">Гипертрофия</option><option value="strength">Сила</option><option value="endurance">Выносливость</option><option value="technique">Техника</option></select></label>
            <label><span>Фокус мышц</span><input value={activeWorkout.muscleFocus || ""} onChange={event => updateActiveWorkout({ muscleFocus: event.target.value })} /></label>
            <label><span>Длительность</span><input value={activeWorkout.duration || ""} onChange={event => updateActiveWorkout({ duration: event.target.value })} /></label>
          </div>
          <button className={styles.appleCopyDay} type="button" onClick={() => { onDuplicateWorkout(activeContext.cycle.id, activeContext.week.id, activeWorkout.id); setDaySettingsOpen(false); }}><Copy size={18} aria-hidden="true" />Создать копию дня</button>
          <button className={styles.deleteExerciseButton} type="button" onClick={() => { setDaySettingsOpen(false); onDeleteWorkout(activeContext.cycle.id, activeContext.week.id, activeWorkout.id); }}><Trash2 size={16} aria-hidden="true" />Удалить день</button>
        </div>
      </ConstructorSheet> : null}
      {apple && orderOpen && activeContext ? <ConstructorSheet styles={styles} title="Порядок упражнений" onClose={() => setOrderOpen(false)}>
        {exercises.map((exercise, index) => <div className={styles.appleOrderRow} key={exercise.id}><span>{index + 1}. {exercise.name}</span><button type="button" disabled={!index} aria-label={`Выше: ${exercise.name}`} onClick={() => onMoveExercise(activeContext.cycle.id, activeContext.week.id, activeWorkout.id, exercise.id, -1)}><ChevronUp size={18} /></button><button type="button" disabled={index === exercises.length - 1} aria-label={`Ниже: ${exercise.name}`} onClick={() => onMoveExercise(activeContext.cycle.id, activeContext.week.id, activeWorkout.id, exercise.id, 1)}><ChevronDown size={18} /></button></div>)}
      </ConstructorSheet> : null}
      {confirmDelete ? (
        <div className={styles.modalBackdrop} data-trainer-modal-backdrop="true" role="presentation" onMouseDown={() => setConfirmDelete(null)}>
          <section className={styles.confirmModal} role="dialog" aria-modal="true" data-modal-surface="true" data-trainer-modal-surface="true" data-trainer-modal-frame="true" aria-labelledby="trainer-program-confirm-title" onMouseDown={(event) => event.stopPropagation()}>
            <h2 id="trainer-program-confirm-title">{confirmDelete.title}</h2><p>{confirmDelete.text}</p>
            <div><button type="button" onClick={() => setConfirmDelete(null)}>Отмена</button><button className={styles.deleteButton} type="button" onClick={confirmDelete.action}>{confirmDelete.confirmLabel || "Удалить"}</button></div>
          </section>
        </div>
      ) : null}
    </section>
  );
}

function ExerciseEditorContainer({ apple, styles, onClose, children }) {
  return apple ? <ConstructorSheet styles={styles} title="Настройки упражнения" onClose={onClose}>{children}</ConstructorSheet> : children;
}
