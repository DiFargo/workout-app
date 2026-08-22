import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  collection,
  doc,
  getDocs,
  serverTimestamp,
  setDoc
} from "firebase/firestore";
import {
  ArrowLeft,
  BookOpen,
  Dumbbell,
  ImageIcon,
  LoaderCircle,
  Pencil,
  Save,
  Search,
  Target,
  Trash2,
  Upload,
  Video,
  X
} from "lucide-react";
import { db } from "../../firebase";
import { uploadStorageFile } from "../../utils/firebaseStorage";
import { getBasicWorkoutMannequinIllustrationSource } from "../../utils/basicWorkoutMannequinIllustration";
import AdminBasicProgramLifecycle from "./AdminBasicProgramLifecycle";
import styles from "./AdminBaseLibrary.module.css";

const EMPTY_LIST = [];
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const VIDEO_TYPES = new Set(["video/mp4", "video/webm", "video/quicktime"]);
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const MAX_VIDEO_SIZE = 250 * 1024 * 1024;
const MODAL_FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])"
].join(",");

function getRecord(item) {
  return item && typeof item === "object" && !Array.isArray(item) ? item : {};
}

function getText(value) {
  if (value === null || value === undefined || typeof value === "boolean") return "";

  if (Array.isArray(value)) {
    return value.map(getText).filter(Boolean).join(", ");
  }

  if (typeof value === "object") {
    return getText(value.name ?? value.title ?? value.label ?? value.value);
  }

  return String(value).trim();
}

function getFirstText(...values) {
  return values.map(getText).find(Boolean) || "";
}

function getFirstList(...values) {
  return values.find(Array.isArray) || EMPTY_LIST;
}

function getUploadedFile(value) {
  return value && typeof value === "object" && typeof value.name === "string" && typeof value.size === "number"
    ? value
    : null;
}

function useModalKeyboard({ containerRef, initialFocusRef, onClose, disabled = false }) {
  useEffect(() => {
    initialFocusRef.current?.focus();

    const onKeyDown = (event) => {
      if (event.key === "Escape" && !disabled) {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab") return;

      const focusable = Array.from(containerRef.current?.querySelectorAll(MODAL_FOCUSABLE_SELECTOR) || [])
        .filter((element) => element.getClientRects().length > 0);
      if (!focusable.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [containerRef, disabled, initialFocusRef, onClose]);
}

function createSafeAssetName(value, fallback) {
  const safeName = String(value || "")
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 110);

  return safeName || fallback;
}

function pluralize(count, forms) {
  const value = Math.abs(Number(count) || 0);
  const remainder = value % 100;
  const lastDigit = value % 10;

  if (remainder > 10 && remainder < 20) return forms[2];
  if (lastDigit === 1) return forms[0];
  if (lastDigit > 1 && lastDigit < 5) return forms[1];
  return forms[2];
}

function formatCount(count, forms) {
  return `${count} ${pluralize(count, forms)}`;
}

function createProgramRow(program, index) {
  const record = getRecord(program);
  const workouts = getFirstList(record.workouts, record.days, record.sessions);
  const directExercises = getFirstList(record.exercises);
  const nestedExerciseCount = workouts.reduce((total, workout) => (
    total + getFirstList(getRecord(workout).exercises).length
  ), 0);
  const exerciseCount = directExercises.length || nestedExerciseCount;
  const title = getFirstText(
    typeof program === "string" ? program : "",
    record.name,
    record.title,
    record.programName
  ) || `Программа ${index + 1}`;
  const description = getFirstText(
    record.description,
    record.summary,
    record.goal,
    record.focus,
    record.muscleFocus
  );
  const metadata = [
    workouts.length ? formatCount(workouts.length, ["тренировка", "тренировки", "тренировок"]) : "",
    exerciseCount ? formatCount(exerciseCount, ["упражнение", "упражнения", "упражнений"]) : ""
  ].filter(Boolean);

  const previewWorkouts = workouts.length
    ? workouts.map((workout, workoutIndex) => {
      const workoutRecord = getRecord(workout);
      const workoutExercises = getFirstList(workoutRecord.exercises);
      return {
        id: String(workoutRecord.id ?? workoutRecord.uid ?? `workout-${workoutIndex}`),
        title: getFirstText(workoutRecord.name, workoutRecord.title, workoutRecord.workoutName) || `Тренировка ${workoutIndex + 1}`,
        exercises: workoutExercises.map((exercise, exerciseIndex) => {
          const exerciseRecord = getRecord(exercise);
          return getFirstText(
            typeof exercise === "string" ? exercise : "",
            exerciseRecord.name,
            exerciseRecord.title,
            exerciseRecord.exerciseName
          ) || `Упражнение ${exerciseIndex + 1}`;
        })
      };
    })
    : directExercises.length
      ? [{
        id: "program-exercises",
        title: "Состав программы",
        exercises: directExercises.map((exercise, exerciseIndex) => {
          const exerciseRecord = getRecord(exercise);
          return getFirstText(
            typeof exercise === "string" ? exercise : "",
            exerciseRecord.name,
            exerciseRecord.title,
            exerciseRecord.exerciseName
          ) || `Упражнение ${exerciseIndex + 1}`;
        })
      }]
      : EMPTY_LIST;
  const isSystemProgram = record.ownerRole !== "admin";

  return {
    id: record.id ?? record.uid ?? `program-${index}`,
    title,
    description,
    metadata,
    previewWorkouts,
    statusLabel: isSystemProgram ? "Системный шаблон" : "Общий шаблон",
    statusText: isSystemProgram
      ? "Утверждённая версия для базового генератора"
      : "Общий шаблон, сохранённый в библиотеке администратора",
    searchText: [
      title,
      description,
      getText(record.category),
      getText(record.tags),
      getText(record.workouts),
      getText(record.exercises)
    ].join(" ").toLocaleLowerCase("ru")
  };
}

function createExerciseRow(exercise, index, overridesById) {
  const record = getRecord(exercise);
  const id = String(record.id ?? record.uid ?? `exercise-${index}`);
  const override = getRecord(overridesById?.[id]);
  const imageDisabled = override.imageDisabled === true;
  const videoDisabled = override.videoDisabled === true;
  const title = getFirstText(
    override.name,
    typeof exercise === "string" ? exercise : "",
    record.name,
    record.title,
    record.exerciseName
  ) || `Упражнение ${index + 1}`;
  const muscles = getFirstText(
    record.muscleGroup,
    record.muscles,
    record.muscle,
    record.targetMuscles,
    record.targets,
    record.target,
    record.bodyPart
  );
  const equipment = getFirstText(
    override.equipment,
    record.equipment,
    record.equipmentName,
    record.equipmentType,
    record.gear
  );
  const note = getFirstText(override.note, record.note, record.instructions, record.description);
  const overrideImageUrl = getFirstText(override.imageUrl);
  const overrideVideoUrl = getFirstText(override.videoUrl);
  const imageUrl = imageDisabled ? "" : overrideImageUrl;
  const baseImageSource = getFirstText(
    record.imageUrl,
    record.image,
    getBasicWorkoutMannequinIllustrationSource(record)
  );
  const baseVideoUrl = getFirstText(record.videoUrl, record.video);
  const videoUrl = videoDisabled ? "" : overrideVideoUrl || baseVideoUrl;

  return {
    id,
    title,
    muscles,
    equipment,
    note,
    imageUrl,
    videoUrl,
    overrideImageUrl,
    overrideVideoUrl,
    imageDisabled,
    videoDisabled,
    hasCustomImage: Boolean(overrideImageUrl),
    hasCustomVideo: Boolean(overrideVideoUrl),
    baseImageSource,
    baseVideoUrl,
    imageSource: imageDisabled ? "" : imageUrl || baseImageSource,
    searchText: [
      title,
      muscles,
      equipment,
      note,
      getText(record.category),
      getText(record.tags)
    ].join(" ").toLocaleLowerCase("ru")
  };
}

export default function AdminBaseLibrary({
  embedded = false,
  programTemplates = [],
  exercises = [],
  initialTab = "programs",
  onBack,
  onOpenTrainerWorkspace
}) {
  const normalizedInitialTab = initialTab === "exercises" ? "exercises" : "programs";
  const [activeTab, setActiveTab] = useState(normalizedInitialTab);
  const [search, setSearch] = useState("");
  const [exerciseOverrides, setExerciseOverrides] = useState({});
  const [overridesStatus, setOverridesStatus] = useState("");
  const [editingExercise, setEditingExercise] = useState(null);
  const [previewingProgram, setPreviewingProgram] = useState(null);
  const [savingExercise, setSavingExercise] = useState(false);
  const [saveError, setSaveError] = useState("");
  const panelId = useId();
  const safeProgramTemplates = Array.isArray(programTemplates) ? programTemplates : EMPTY_LIST;
  const safeExercises = Array.isArray(exercises) ? exercises : EMPTY_LIST;
  const searchQuery = search.trim().toLocaleLowerCase("ru");

  useEffect(() => {
    let active = true;

    async function loadOverrides() {
      try {
        const snapshot = await getDocs(collection(db, "basicExerciseOverrides"));
        if (!active) return;

        const nextOverrides = {};
        snapshot.forEach((item) => {
          nextOverrides[item.id] = item.data();
        });
        setExerciseOverrides(nextOverrides);
      } catch {
        if (!active) return;
        setOverridesStatus("Не удалось загрузить сохранённые изменения. Показана базовая версия каталога.");
      }
    }

    loadOverrides();

    return () => {
      active = false;
    };
  }, []);

  const programRows = useMemo(
    () => safeProgramTemplates.map(createProgramRow),
    [safeProgramTemplates]
  );
  const exerciseRows = useMemo(
    () => safeExercises.map((exercise, index) => createExerciseRow(exercise, index, exerciseOverrides)),
    [safeExercises, exerciseOverrides]
  );
  const filteredProgramRows = useMemo(
    () => programRows.filter((program) => !searchQuery || program.searchText.includes(searchQuery)),
    [programRows, searchQuery]
  );
  const filteredExerciseRows = useMemo(
    () => exerciseRows.filter((exercise) => !searchQuery || exercise.searchText.includes(searchQuery)),
    [exerciseRows, searchQuery]
  );

  const isProgramsTab = activeTab === "programs";
  const sourceCount = isProgramsTab ? programRows.length : exerciseRows.length;
  const visibleCount = isProgramsTab ? filteredProgramRows.length : filteredExerciseRows.length;
  const programsTabId = `${panelId}-programs-tab`;
  const exercisesTabId = `${panelId}-exercises-tab`;
  const programsPanelId = `${panelId}-programs-panel`;
  const exercisesPanelId = `${panelId}-exercises-panel`;

  const openExerciseEditor = (exercise) => {
    setSaveError("");
    setEditingExercise(exercise);
  };

  const saveExercise = async (draft) => {
    const nextName = String(draft.name || "").trim();
    const nextEquipment = String(draft.equipment || "").trim();
    const nextNote = String(draft.note || "").trim();
    const imageFile = getUploadedFile(draft.imageFile);
    const videoFile = getUploadedFile(draft.videoFile);

    if (!nextName) {
      setSaveError("Укажите название упражнения.");
      return;
    }

    if (imageFile && (!IMAGE_TYPES.has(imageFile.type) || imageFile.size > MAX_IMAGE_SIZE)) {
      setSaveError("Выберите изображение JPG, PNG или WebP размером до 10 МБ.");
      return;
    }

    if (videoFile && (!VIDEO_TYPES.has(videoFile.type) || videoFile.size > MAX_VIDEO_SIZE)) {
      setSaveError("Выберите видео MP4, WebM или MOV размером до 250 МБ.");
      return;
    }

    setSavingExercise(true);
    setSaveError("");

    try {
      const assetFolder = createSafeAssetName(draft.id, "exercise");
      const timestamp = Date.now();
      let imageUrl = String(draft.imageUrl || "").trim();
      let videoUrl = String(draft.videoUrl || "").trim();

      if (imageFile) {
        const imageUpload = await uploadStorageFile(
          `basic-exercise-assets/${assetFolder}/images/${timestamp}-${createSafeAssetName(imageFile.name, "image")}`,
          imageFile,
          { contentType: imageFile.type }
        );
        imageUrl = imageUpload.url;
      }

      if (videoFile) {
        const videoUpload = await uploadStorageFile(
          `basic-exercise-assets/${assetFolder}/videos/${timestamp}-${createSafeAssetName(videoFile.name, "video")}`,
          videoFile,
          { contentType: videoFile.type }
        );
        videoUrl = videoUpload.url;
      }

      const update = {
        name: nextName,
        equipment: nextEquipment,
        note: nextNote,
        imageUrl,
        videoUrl,
        imageDisabled: draft.imageDisabled === true,
        videoDisabled: draft.videoDisabled === true,
        updatedAt: serverTimestamp()
      };
      await setDoc(doc(db, "basicExerciseOverrides", draft.id), update, { merge: true });
      setExerciseOverrides((current) => ({
        ...current,
        [draft.id]: {
          ...current[draft.id],
          name: nextName,
          equipment: nextEquipment,
          note: nextNote,
          imageUrl,
          videoUrl,
          imageDisabled: draft.imageDisabled === true,
          videoDisabled: draft.videoDisabled === true
        }
      }));
      setEditingExercise(null);
      setOverridesStatus("Изменения сохранены в общем каталоге.");
    } catch {
      setSaveError("Не удалось сохранить изменения. Проверьте подключение и права администратора.");
    } finally {
      setSavingExercise(false);
    }
  };

  return (
    <main className={`${styles.root}${embedded ? ` ${styles.embeddedRoot}` : ""}`} data-testid="admin-base-library">
      {!embedded ? <header className={styles.header}>
        <div className={styles.headerMain}>
          <button
            className={styles.backButton}
            type="button"
            onClick={onBack}
            aria-label="Вернуться в админ-панель"
          >
            <ArrowLeft aria-hidden="true" />
            <span>Админ-панель</span>
          </button>

          <div className={styles.titleBlock}>
            <p className={styles.eyebrow}>Общий каталог</p>
            <h1>Базовые программы и упражнения</h1>
          </div>
        </div>

        {typeof onOpenTrainerWorkspace === "function" ? (
          <button className={styles.workspaceButton} type="button" onClick={onOpenTrainerWorkspace}>
            Рабочее место тренера
          </button>
        ) : null}
      </header> : null}

      <section className={styles.introCard} aria-label="О каталоге">
        <span className={styles.introIcon} aria-hidden="true"><BookOpen /></span>
        <div>
          <p className={styles.introTitle}>Единая база для команды</p>
          <p className={styles.introText}>
            Здесь собраны общие шаблоны программ и базовые упражнения. Изменения карточек отделены от личных библиотек тренеров и не изменяют уже назначенные планы.
          </p>
        </div>
      </section>

      <section className={styles.catalogCard}>
        <div className={styles.tabList} role="tablist" aria-label="Категории общего каталога">
          <button
            id={programsTabId}
            className={`${styles.tabButton}${isProgramsTab ? ` ${styles.activeTab}` : ""}`}
            type="button"
            role="tab"
            aria-selected={isProgramsTab}
            aria-controls={programsPanelId}
            onClick={() => setActiveTab("programs")}
          >
            <BookOpen aria-hidden="true" />
            <span>Базовые программы</span>
            <b>{programRows.length}</b>
          </button>
          <button
            id={exercisesTabId}
            className={`${styles.tabButton}${!isProgramsTab ? ` ${styles.activeTab}` : ""}`}
            type="button"
            role="tab"
            aria-selected={!isProgramsTab}
            aria-controls={exercisesPanelId}
            onClick={() => setActiveTab("exercises")}
          >
            <Dumbbell aria-hidden="true" />
            <span>Базовые упражнения</span>
            <b>{exerciseRows.length}</b>
          </button>
        </div>

        {!isProgramsTab ? (
          <>
            <label className={styles.searchField}>
              <Search aria-hidden="true" />
              <span className={styles.srOnly}>Поиск в каталоге</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Найти упражнение"
                type="search"
              />
            </label>

            <div className={styles.resultsHeading}>
              <div>
                <h2>Базовые упражнения</h2>
                <p>
                  {searchQuery
                    ? `Найдено ${visibleCount} из ${sourceCount}`
                    : `${sourceCount} ${pluralize(sourceCount, ["элемент", "элемента", "элементов"])} в каталоге`}
                </p>
              </div>
              <span className={styles.readOnlyBadge}>Общий каталог</span>
            </div>
          </>
        ) : null}

        <div
          id={isProgramsTab ? programsPanelId : exercisesPanelId}
          className={styles.tabPanel}
          role="tabpanel"
          aria-labelledby={isProgramsTab ? programsTabId : exercisesTabId}
          tabIndex="0"
        >
          {isProgramsTab ? (
            <AdminBasicProgramLifecycle fallbackPrograms={safeProgramTemplates} />
          ) : filteredExerciseRows.length ? (
            <>
              {overridesStatus ? <p className={styles.catalogueStatus} role="status">{overridesStatus}</p> : null}
              <div className={styles.exerciseGrid}>
                {filteredExerciseRows.map((exercise) => (
                  <article className={styles.exerciseCard} key={exercise.id}>
                    <span className={styles.exerciseImage} aria-hidden="true">
                      <Dumbbell className={styles.exerciseImageFallback} />
                      {exercise.imageSource ? <img src={exercise.imageSource} alt="" /> : null}
                    </span>
                    <div className={styles.exerciseCopy}>
                      <h3>{exercise.title}</h3>
                      {exercise.muscles || exercise.equipment ? (
                        <div className={styles.exerciseMetadata}>
                          {exercise.muscles ? (
                            <span><Target aria-hidden="true" />{exercise.muscles}</span>
                          ) : null}
                          {exercise.equipment ? (
                            <span><Dumbbell aria-hidden="true" />{exercise.equipment}</span>
                          ) : null}
                        </div>
                      ) : (
                        <p className={styles.exerciseFallback}>Характеристики упражнения не указаны.</p>
                      )}
                      <button className={styles.editExerciseButton} type="button" onClick={() => openExerciseEditor(exercise)}>
                        <Pencil aria-hidden="true" />
                        Редактировать
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </>
          ) : (
            <EmptyState
              icon={<Dumbbell aria-hidden="true" />}
              title={searchQuery ? "Упражнения не найдены" : "Базовые упражнения пока не добавлены"}
              text={searchQuery
                ? "Проверьте написание или очистите поле поиска."
                : "Когда упражнения появятся в общей библиотеке, они будут показаны здесь."}
            />
          )}
        </div>
      </section>
      {editingExercise ? (
        <ExerciseEditSheet
          exercise={editingExercise}
          key={editingExercise.id}
          saving={savingExercise}
          saveError={saveError}
          onClose={() => !savingExercise && setEditingExercise(null)}
          onSave={saveExercise}
        />
      ) : null}
      {previewingProgram ? (
        <ProgramPreviewSheet
          key={previewingProgram.id}
          program={previewingProgram}
          onClose={() => setPreviewingProgram(null)}
        />
      ) : null}
    </main>
  );
}

function ProgramPreviewSheet({ program, onClose }) {
  const sheetRef = useRef(null);
  const closeButtonRef = useRef(null);
  useModalKeyboard({ containerRef: sheetRef, initialFocusRef: closeButtonRef, onClose });

  return (
    <div className={styles.editOverlay} role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section ref={sheetRef} className={styles.previewSheet} role="dialog" aria-modal="true" aria-labelledby="admin-program-preview-title">
        <header className={styles.editHeader}>
          <div>
            <p>Общий каталог</p>
            <h2 id="admin-program-preview-title">{program.title}</h2>
          </div>
          <button ref={closeButtonRef} type="button" className={styles.closeEditButton} onClick={onClose} aria-label="Закрыть просмотр программы">
            <X aria-hidden="true" />
          </button>
        </header>
        <p className={styles.previewIntro}>{program.description || "Базовый шаблон из общего каталога программ."}</p>
        <p className={styles.editHint}>
          Это утверждённый шаблон для просмотра. Редактирование и архивирование появятся только после перевода базового генератора на версионируемые данные каталога — так уже созданные планы не будут изменены случайно.
        </p>
        {program.previewWorkouts.length ? (
          <ol className={styles.programOutline}>
            {program.previewWorkouts.map((workout, workoutIndex) => (
              <li key={workout.id}>
                <strong>{workoutIndex + 1}. {workout.title}</strong>
                {workout.exercises.length ? (
                  <span>{workout.exercises.join(" · ")}</span>
                ) : <span>Упражнения не указаны.</span>}
              </li>
            ))}
          </ol>
        ) : <p className={styles.previewEmpty}>В этом шаблоне пока нет доступного состава для просмотра.</p>}
        <div className={styles.editActions}>
          <button type="button" className={styles.saveEditButton} onClick={onClose}>Готово</button>
        </div>
      </section>
    </div>
  );
}

function ExerciseEditSheet({ exercise, saving, saveError, onClose, onSave }) {
  const sheetRef = useRef(null);
  const closeButtonRef = useRef(null);
  const [draft, setDraft] = useState({
    id: exercise.id,
    name: exercise.title,
    equipment: exercise.equipment,
    note: exercise.note,
    imageUrl: exercise.imageUrl,
    videoUrl: exercise.videoUrl,
    imageDisabled: exercise.imageDisabled,
    videoDisabled: exercise.videoDisabled,
    imageFile: null,
    videoFile: null
  });
  const [imagePreviewUrl, setImagePreviewUrl] = useState(exercise.imageSource || "");
  const [videoPreviewUrl, setVideoPreviewUrl] = useState(exercise.videoUrl || "");
  const [mediaError, setMediaError] = useState("");

  const updateDraft = (field) => (event) => {
    setDraft((current) => ({ ...current, [field]: event.target.value }));
  };

  useModalKeyboard({ containerRef: sheetRef, initialFocusRef: closeButtonRef, onClose, disabled: saving });

  useEffect(() => () => {
    if (imagePreviewUrl.startsWith("blob:")) URL.revokeObjectURL(imagePreviewUrl);
  }, [imagePreviewUrl]);

  useEffect(() => () => {
    if (videoPreviewUrl.startsWith("blob:")) URL.revokeObjectURL(videoPreviewUrl);
  }, [videoPreviewUrl]);

  const updateMedia = (kind, patch) => {
    const isImage = kind === "image";
    setDraft((current) => ({ ...current, ...patch }));
    setMediaError("");

    if (isImage && patch.imageDisabled === true) setImagePreviewUrl("");
    if (!isImage && patch.videoDisabled === true) setVideoPreviewUrl("");
  };

  const restoreMedia = (kind) => {
    const isImage = kind === "image";
    updateMedia(kind, isImage
      ? { imageFile: null, imageUrl: "", imageDisabled: false }
      : { videoFile: null, videoUrl: "", videoDisabled: false });

    if (isImage) {
      setImagePreviewUrl(exercise.baseImageSource || "");
    } else {
      setVideoPreviewUrl(exercise.baseVideoUrl || "");
    }
  };

  const removeMedia = (kind) => {
    const isImage = kind === "image";
    updateMedia(kind, isImage
      ? { imageFile: null, imageUrl: "", imageDisabled: true }
      : { videoFile: null, videoUrl: "", videoDisabled: true });
  };

  const selectMedia = (kind) => (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    const isImage = kind === "image";
    const allowedTypes = isImage ? IMAGE_TYPES : VIDEO_TYPES;
    const maxSize = isImage ? MAX_IMAGE_SIZE : MAX_VIDEO_SIZE;

    if (!allowedTypes.has(file.type) || file.size > maxSize) {
      setMediaError(
        isImage
          ? "Для изображения подойдёт JPG, PNG или WebP размером до 10 МБ."
          : "Для видео подойдёт MP4, WebM или MOV размером до 250 МБ."
      );
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    setMediaError("");
    setDraft((current) => ({
      ...current,
      [isImage ? "imageFile" : "videoFile"]: file,
      [isImage ? "imageDisabled" : "videoDisabled"]: false
    }));

    if (isImage) {
      setImagePreviewUrl(previewUrl);
    } else {
      setVideoPreviewUrl(previewUrl);
    }
  };

  return (
    <div
      className={styles.editOverlay}
      role="presentation"
      onMouseDown={(event) => {
        if (!saving && event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={sheetRef}
        className={styles.editSheet}
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-exercise-edit-title"
        aria-describedby="admin-exercise-edit-hint"
      >
        <header className={styles.editHeader}>
          <div>
            <p>Общий каталог</p>
            <h2 id="admin-exercise-edit-title">Редактировать упражнение</h2>
          </div>
          <button ref={closeButtonRef} type="button" className={styles.closeEditButton} onClick={onClose} disabled={saving} aria-label="Закрыть">
            <X aria-hidden="true" />
          </button>
        </header>
        <p id="admin-exercise-edit-hint" className={styles.editHint}>Карточка обновится в общем каталоге и материалах базовой тренировки. Уже сохранённые подходы, история и структура назначенных тренировок не изменятся.</p>
        <label className={styles.editField}>
          <span>Название</span>
          <input value={draft.name} onChange={updateDraft("name")} maxLength="120" autoFocus />
        </label>
        <label className={styles.editField}>
          <span>Инвентарь</span>
          <input value={draft.equipment} onChange={updateDraft("equipment")} maxLength="120" />
        </label>
        <label className={styles.editField}>
          <span>Подсказка по технике</span>
          <textarea value={draft.note} onChange={updateDraft("note")} maxLength="600" rows="4" />
        </label>
        <div className={styles.mediaFields}>
          <section className={styles.mediaField} aria-labelledby="admin-exercise-image-label">
            <div className={styles.mediaFieldHeading}>
              <ImageIcon aria-hidden="true" />
              <span id="admin-exercise-image-label">Изображение упражнения</span>
            </div>
            <div className={styles.mediaPreview}>
              {!draft.imageDisabled && imagePreviewUrl ? <img src={imagePreviewUrl} alt="Предпросмотр изображения упражнения" /> : <Dumbbell aria-hidden="true" />}
            </div>
            <label className={styles.mediaUploadButton}>
              <Upload aria-hidden="true" />
              {draft.imageFile ? "Выбрать другое" : "Заменить изображение"}
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={selectMedia("image")} disabled={saving} />
            </label>
            <div className={styles.mediaActions}>
              <button
                type="button"
                onClick={() => restoreMedia("image")}
                disabled={saving || (!draft.imageFile && !exercise.hasCustomImage && !draft.imageDisabled)}
              >
                Вернуть исходное
              </button>
              <button type="button" onClick={() => removeMedia("image")} disabled={saving || draft.imageDisabled}>
                <Trash2 aria-hidden="true" />
                Убрать
              </button>
            </div>
            <p className={styles.mediaState}>
              {draft.imageDisabled
                ? "Изображение будет скрыто в общем каталоге."
                : draft.imageFile
                  ? "Новое изображение выбрано и будет загружено при сохранении."
                  : exercise.hasCustomImage
                    ? "Используется изображение, добавленное администратором."
                    : "Используется исходная иллюстрация упражнения."}
            </p>
            <p>JPG, PNG или WebP · до 10 МБ</p>
          </section>
          <section className={styles.mediaField} aria-labelledby="admin-exercise-video-label">
            <div className={styles.mediaFieldHeading}>
              <Video aria-hidden="true" />
              <span id="admin-exercise-video-label">Видео упражнения</span>
            </div>
            <div className={styles.mediaPreview}>
              {!draft.videoDisabled && videoPreviewUrl ? <video src={videoPreviewUrl} controls preload="metadata" /> : <Video aria-hidden="true" />}
            </div>
            <label className={styles.mediaUploadButton}>
              <Upload aria-hidden="true" />
              {draft.videoFile ? "Выбрать другое" : "Заменить видео"}
              <input type="file" accept="video/mp4,video/webm,video/quicktime" onChange={selectMedia("video")} disabled={saving} />
            </label>
            <div className={styles.mediaActions}>
              <button
                type="button"
                onClick={() => restoreMedia("video")}
                disabled={saving || (!draft.videoFile && !exercise.hasCustomVideo && !draft.videoDisabled)}
              >
                Вернуть исходное
              </button>
              <button type="button" onClick={() => removeMedia("video")} disabled={saving || draft.videoDisabled}>
                <Trash2 aria-hidden="true" />
                Убрать
              </button>
            </div>
            <p className={styles.mediaState}>
              {draft.videoDisabled
                ? "Видео будет скрыто в общем каталоге."
                : draft.videoFile
                  ? "Новое видео выбрано и будет загружено при сохранении."
                  : exercise.hasCustomVideo
                    ? "Используется видео, добавленное администратором."
                    : exercise.baseVideoUrl
                      ? "Используется исходное видео упражнения."
                      : "Видео пока не добавлено."}
            </p>
            <p>MP4, WebM или MOV · до 250 МБ</p>
          </section>
        </div>
        {mediaError ? <p className={styles.editError} role="alert">{mediaError}</p> : null}
        {saveError ? <p className={styles.editError} role="alert">{saveError}</p> : null}
        <div className={styles.editActions}>
          <button type="button" className={styles.cancelEditButton} onClick={onClose} disabled={saving}>Отмена</button>
          <button type="button" className={styles.saveEditButton} onClick={() => onSave(draft)} disabled={saving}>
            {saving ? <LoaderCircle className={styles.saveSpinner} aria-hidden="true" /> : <Save aria-hidden="true" />}
            {saving ? "Сохраняем…" : "Сохранить"}
          </button>
        </div>
      </section>
    </div>
  );
}

function EmptyState({ icon, title, text }) {
  return (
    <div className={styles.emptyState}>
      <span className={styles.emptyIcon}>{icon}</span>
      <strong>{title}</strong>
      <p>{text}</p>
    </div>
  );
}
