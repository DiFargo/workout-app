import { useRef, useState } from "react";
import { Clock3, Paperclip } from "lucide-react";
import {
  getProgramHistoryItems,
  getWorkoutCover,
  getWorkoutPresentation,
  WORKOUT_MENU_ITEMS
} from "../../../domain/workoutPresentation";
import { sortWorkoutDays } from "../../../utils/workoutPlanNormalization";
import {
  buildCompletedWorkoutSet,
  getNextUncompletedWorkoutIndex,
  getWorkoutAssignmentVersion,
  isWorkoutCompletedWithSet
} from "../../../utils/workoutCompletion";
import { safeReadJsonStorage, safeWriteJsonStorage } from "../../../utils/storageSafety";
import { getWorkoutDraftKey } from "../../../utils/workoutDraftStorage";
import { INDIVIDUAL_WORKOUT_SWIPE_HINT_KEY } from "../../../constants/appConfig";
import { WorkoutDraftRestoreDialog } from "../../../components/workout/WorkoutDialogs";
import {
  IndividualWorkoutHistoryDialog,
  WorkoutModePickerDialog
} from "./WorkoutListDialogs";

const versionedLocalAsset = (src, version) => {
  if (typeof src !== "string" || !src.startsWith("/")) return src;
  return `${src}${src.includes("?") ? "&" : "?"}v=${encodeURIComponent(version || "")}`;
};

export default function WorkoutListPage({
  appVersion,
  renderClientMainBottomBar,
  plan,
  history,
  workoutCalendar = {},
  currentUserId,
  workoutModePreference,
  individualWorkoutIndex,
  individualWorkoutIndexInitialized,
  setIndividualWorkoutIndex,
  setIndividualWorkoutIndexInitialized,
  workoutModeModalOpen,
  setWorkoutModeModalOpen,
  workoutHistoryModalOpen,
  setWorkoutHistoryModalOpen,
  workoutDraftRestorePrompt,
  workoutReadinessOpen,
  postWorkoutFeedbackOpen,
  fullscreenVideo,
  showFirstSetupOnboarding,
  historyLoading,
  isTrainerMode,
  onGoMain,
  onOpenTraining,
  onOpenNutrition,
  onOpenCabinet,
  onOpenTrainerClients,
  onOpenTrainerPrograms,
  loadHistory,
  openWorkout,
  onOpenBasicMode,
  onOpenIndividualWorkouts,
  openCabinetWorkoutHistory,
  handleWorkoutDraftChoice
}) {
  const [swipeHintVisible, setSwipeHintVisible] = useState(
    () => safeReadJsonStorage(INDIVIDUAL_WORKOUT_SWIPE_HINT_KEY, true) !== false
  );
  const swipeStartRef = useRef(null);
  const swipeSuppressClickRef = useRef(false);

  const sortedWorkouts = sortWorkoutDays(plan.workouts || []);
  const assignmentVersion = getWorkoutAssignmentVersion(plan);
  const completedWorkoutSet = buildCompletedWorkoutSet(history, assignmentVersion, workoutCalendar);
  const isIndividualWorkoutMode = workoutModePreference.mode === "individual";
  const nextUncompletedWorkoutIndex = isIndividualWorkoutMode
    ? getNextUncompletedWorkoutIndex(sortedWorkouts, completedWorkoutSet, assignmentVersion)
    : 0;
  const activeWorkoutIndex = isIndividualWorkoutMode
    ? Math.min(
        Math.max(
          individualWorkoutIndexInitialized
            ? (Number.isFinite(Number(individualWorkoutIndex)) ? Number(individualWorkoutIndex) : nextUncompletedWorkoutIndex)
            : nextUncompletedWorkoutIndex,
          0
        ),
        Math.max(sortedWorkouts.length - 1, 0)
      )
    : 0;
  const activeIndividualWorkout = sortedWorkouts[activeWorkoutIndex];
  const isWorkoutCompleted = (workoutItem) => (
    isWorkoutCompletedWithSet(workoutItem, completedWorkoutSet, assignmentVersion)
  );
  const completedWorkoutCount = sortedWorkouts.filter(isWorkoutCompleted).length;
  const completedWorkoutProgressPercent = sortedWorkouts.length > 0
    ? Math.min(100, Math.max(0, Math.round((completedWorkoutCount / sortedWorkouts.length) * 100)))
    : 0;
  const activeIndividualWorkoutCompleted = isWorkoutCompleted(activeIndividualWorkout);
  const activeWorkoutDraft = currentUserId && activeIndividualWorkout?.id
    ? safeReadJsonStorage(getWorkoutDraftKey(currentUserId, activeIndividualWorkout.id), null)
    : null;
  const activeDraftAssignmentVersion =
    activeWorkoutDraft?.assignmentVersion ||
    activeWorkoutDraft?.assignedProgramUpdatedAt ||
    activeWorkoutDraft?.plan?.assignedProgramUpdatedAt ||
    "";
  const hasActiveWorkoutDraft = Boolean(
    activeWorkoutDraft?.workoutId === activeIndividualWorkout?.id &&
    (
      !plan.assignedProgramUpdatedAt ||
      activeDraftAssignmentVersion === plan.assignedProgramUpdatedAt
    )
  );
  const individualWorkoutProgramScope = {
    assignedProgramId: plan.assignedProgramId || activeIndividualWorkout?.assignedProgramId || "",
    assignedProgramName: plan.assignedProgramName || activeIndividualWorkout?.assignedProgramName || "История программы",
    assignedProgramUpdatedAt: plan.assignedProgramUpdatedAt || activeIndividualWorkout?.assignedProgramUpdatedAt || "",
    workoutIds: sortedWorkouts.map((workoutItem) => workoutItem.id)
  };
  const individualWorkoutHistoryItems = getProgramHistoryItems(history, individualWorkoutProgramScope).slice(0, 12);
  const activeWorkoutActionLabel = hasActiveWorkoutDraft
    ? "Продолжить тренировку"
    : activeIndividualWorkoutCompleted
      ? "Повторить тренировку"
      : "Начать тренировку";
  const activeWorkoutPendingSync = history.some((item) => (
    item?.pendingSync &&
    item?.workoutId === activeIndividualWorkout?.id &&
    (
      !plan.assignedProgramUpdatedAt ||
      item?.assignedProgramUpdatedAt === plan.assignedProgramUpdatedAt
    )
  ));

  function openWorkoutByIndex(index) {
    const nextWorkout = sortedWorkouts[index];

    if (nextWorkout) {
      openWorkout(nextWorkout.id);
    }
  }

  function moveIndividualWorkout(direction) {
    if (!sortedWorkouts.length) return;

    const currentIndex = Math.max(0, activeWorkoutIndex);
    const nextIndex =
      direction === "previous"
        ? (currentIndex - 1 + sortedWorkouts.length) % sortedWorkouts.length
        : (currentIndex + 1) % sortedWorkouts.length;

    setIndividualWorkoutIndex(nextIndex);
    setIndividualWorkoutIndexInitialized(true);
  }

  function dismissIndividualWorkoutSwipeHint() {
    if (!swipeHintVisible) return;
    setSwipeHintVisible(false);
    safeWriteJsonStorage(INDIVIDUAL_WORKOUT_SWIPE_HINT_KEY, false);
  }

  function handleIndividualWorkoutSwipeStart(event) {
    if (event.pointerType === "mouse" || sortedWorkouts.length < 2) return;

    swipeStartRef.current = {
      x: event.clientX,
      y: event.clientY
    };
  }

  function handleIndividualWorkoutSwipeEnd(event) {
    const start = swipeStartRef.current;
    swipeStartRef.current = null;
    if (!start) return;

    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;
    if (Math.abs(deltaX) < 44 || Math.abs(deltaX) <= Math.abs(deltaY) * 1.2) return;

    swipeSuppressClickRef.current = true;
    dismissIndividualWorkoutSwipeHint();
    moveIndividualWorkout(deltaX < 0 ? "next" : "previous");
    window.setTimeout(() => {
      swipeSuppressClickRef.current = false;
    }, 180);
  }

  return (
    <div className={isIndividualWorkoutMode ? "workoutSelectPage individualWorkoutSelectPage clientCorePage clientCorePageWorkout" : "workoutSelectPage basicWorkoutSelectPage clientCorePage clientCorePageWorkout"}>
      <div className="appVersionBadge clientPageVersionBadge">{appVersion}</div>
      <div className="workoutSelectHero">
        <h1 className="workoutSelectTitle clientCorePageTitle">
          {isIndividualWorkoutMode ? (
            "Мой план"
          ) : (
            <>
              <span>Базовые</span>
              {" "}
              <strong>тренировки</strong>
            </>
          )}
        </h1>

        <div className="workoutHeaderActions">
          {isIndividualWorkoutMode && (
            <button
              type="button"
              className="workoutHistoryHeaderButton"
              aria-label="Открыть историю тренировок"
              onClick={() => {
                loadHistory();
                setWorkoutHistoryModalOpen(true);
              }}
            >
              <Clock3 aria-hidden="true" />
            </button>
          )}
          <button
            type="button"
            className="workoutModeHeaderButton"
            aria-label="Выбрать режим запуска тренировки"
            onClick={() => setWorkoutModeModalOpen(true)}
          >
            <Paperclip aria-hidden="true" />
          </button>
        </div>

        <p>
          {isIndividualWorkoutMode
            ? "Листай тренировки и выбирай нужную"
            : "Выбери тренировку из подобранного плана"}
        </p>
        <div className="workoutSelectLine" />
      </div>

      <div className={isIndividualWorkoutMode ? "workoutSelectList individualWorkoutDeck" : "workoutSelectList"}>
        {sortedWorkouts.length === 0 ? (
          <div className="workoutProgramEmptyState">
            <div className="workoutProgramEmptyIcon">⏳</div>
            <h2>Тренировка ещё не назначена</h2>
            <p>Тренер пока не назначил тебе программу. Как только тренировка появится в твоём профиле, она отобразится здесь.</p>
            <button type="button" onClick={onGoMain}>Вернуться в меню</button>
          </div>
        ) : isIndividualWorkoutMode && activeIndividualWorkout ? (
          (() => {
            const w = activeIndividualWorkout;
            const index = activeWorkoutIndex;
            const completed = activeIndividualWorkoutCompleted;
            const activeNext = index === nextUncompletedWorkoutIndex;
            const item = getWorkoutPresentation(w, index);
            const fallbackImage = versionedLocalAsset(
              item.image ||
                WORKOUT_MENU_ITEMS[index % WORKOUT_MENU_ITEMS.length]?.image ||
                WORKOUT_MENU_ITEMS[0]?.image ||
                "",
              appVersion
            );
            const coverImage = versionedLocalAsset(getWorkoutCover(w), appVersion);
            const adjacentCoverImages = [...new Set(
              [-1, 1]
                .map((offset) => sortedWorkouts[
                  (index + offset + sortedWorkouts.length) % sortedWorkouts.length
                ])
                .map(getWorkoutCover)
                .map((image) => versionedLocalAsset(image, appVersion))
                .filter((image) => image && image !== coverImage)
            )];

            return (
              <>
                <article
                  className={`workoutSelectCard individualWorkoutCardPro ${completed ? "completed" : ""} ${activeNext ? "activeNext" : ""}`}
                  aria-current={activeNext ? "step" : undefined}
                  key={w.id}
                  data-workout-card-id={w.id}
                  onPointerDown={handleIndividualWorkoutSwipeStart}
                  onPointerUp={handleIndividualWorkoutSwipeEnd}
                  onPointerCancel={() => {
                    swipeStartRef.current = null;
                  }}
                >
                  <span className="individualWorkoutProTop">
                    <span className="individualWorkoutBadges">
                      {completed ? (
                        <span className="individualWorkoutCompletedBadge">✓ Выполнена</span>
                      ) : hasActiveWorkoutDraft ? (
                        <span className="individualWorkoutProgressBadge">В процессе</span>
                      ) : activeNext ? (
                        <span className="individualWorkoutNextBadge">Следующая</span>
                      ) : null}
                      {activeWorkoutPendingSync && (
                        <span className="individualWorkoutSyncBadge">Ожидает синхронизации</span>
                      )}
                    </span>
                    <span className="individualWorkoutWeek">{item.day}</span>
                  </span>

                  <span className="individualWorkoutProBody">
                    <span className="individualWorkoutProInfo">
                      <span className="individualWorkoutTitle">{item.title}</span>
                      <span className="individualWorkoutAccentLine" />

                      <span className="individualWorkoutStats">
                        <span><b>🏋️</b>{item.exerciseCount} упражнений</span>
                        <span><b>▰</b>{item.setCount} подходов</span>
                        <span><b>⏱</b>{item.duration}</span>
                      </span>
                    </span>

                    <span className="individualWorkoutProImage">
                      {coverImage || fallbackImage ? (
                        <img
                          src={coverImage || fallbackImage}
                          alt=""
                          width="512"
                          height="910"
                          loading="eager"
                          decoding="async"
                          fetchPriority="high"
                          onError={(event) => {
                            if (!fallbackImage || event.currentTarget.dataset.fallbackApplied === "true") return;
                            event.currentTarget.dataset.fallbackApplied = "true";
                            event.currentTarget.src = fallbackImage;
                          }}
                        />
                      ) : (
                        <span className="individualWorkoutImageFallback">
                          <b>{item.title}</b>
                          <small>{w.exercises?.[0]?.name || "Персональная тренировка"}</small>
                        </span>
                      )}
                    </span>

                    <button
                      type="button"
                      className="individualWorkoutCardStartButton"
                      onClick={(event) => {
                        if (swipeSuppressClickRef.current) {
                          event.preventDefault();
                          return;
                        }
                        openWorkoutByIndex(index);
                      }}
                    >
                      {activeWorkoutActionLabel}
                    </button>
                  </span>
                </article>
                {adjacentCoverImages.map((image) => (
                  <img
                    className="individualWorkoutCoverPreload"
                    src={image}
                    alt=""
                    width="1"
                    height="1"
                    loading="eager"
                    decoding="async"
                    aria-hidden="true"
                    key={image}
                  />
                ))}
              </>
            );
          })()
        ) : (
          sortedWorkouts.map((w, index) => {
            const weekNumber =
              String(w.name || "").match(/неделя\s*(\d+)/i)?.[1] ||
              String(w.weekName || "").match(/неделя\s*(\d+)/i)?.[1] ||
              String(w.id || "").match(/week[_-]?(\d+)/i)?.[1];

            const workoutDayNumber =
              String(w.name || "").match(/день\s*(\d+)/i)?.[1] ||
              String(w.id || "").match(/day[_-]?(\d+)/i)?.[1] ||
              index + 1;

            const fallbackItem = WORKOUT_MENU_ITEMS[index % WORKOUT_MENU_ITEMS.length] || WORKOUT_MENU_ITEMS[0];

            const item = {
              day: weekNumber ? `Неделя ${weekNumber} · День ${workoutDayNumber}` : `День ${workoutDayNumber}`,
              title: String(w.name || `День ${workoutDayNumber}`)
                .replace(/^Неделя\s*\d+\s*[—-]\s*/i, "")
                .replace(/^День\s*\d+\s*[—-]\s*/i, ""),
              image: versionedLocalAsset(fallbackItem?.image || WORKOUT_MENU_ITEMS[0].image, appVersion)
            };

            return (
              <button
                className="workoutSelectCard"
                type="button"
                key={w.id}
                onClick={() => openWorkout(w.id)}
              >
                <span className="workoutSelectImageWrap">
                  <img src={item.image} alt="" className="workoutSelectImage" />
                </span>

                <span className="workoutSelectText">
                  <span className="workoutSelectDay">{item.day}</span>
                  <span className="workoutSelectName">{item.title}</span>
                </span>

                <span className="workoutSelectArrow">›</span>
              </button>
            );
          })
        )}
      </div>

      {isIndividualWorkoutMode && sortedWorkouts.length > 1 && (
        <div className="individualWorkoutNav">
          <button
            type="button"
            aria-label="Предыдущая тренировка"
            onClick={() => {
              dismissIndividualWorkoutSwipeHint();
              moveIndividualWorkout("previous");
            }}
          >
            ←
          </button>

          <div className="individualWorkoutCenterNav">
            {swipeHintVisible && (
              <small className="individualWorkoutSwipeHint">
                Свайпни, чтобы выбрать тренировку
              </small>
            )}
            <span className="individualWorkoutSwipeAffordance" aria-hidden="true">
              ‹&nbsp;&nbsp;&nbsp;›
            </span>
          </div>

          <button
            type="button"
            aria-label="Следующая тренировка"
            onClick={() => {
              dismissIndividualWorkoutSwipeHint();
              moveIndividualWorkout("next");
            }}
          >
            →
          </button>
        </div>
      )}

      <div className="individualWorkoutBottomPanel">
        {isIndividualWorkoutMode && sortedWorkouts.length > 0 && (
          <div
            className="individualWorkoutBottomProgress"
            style={{ "--completed-workouts-progress": `${completedWorkoutProgressPercent}%` }}
          >
            <span>{activeWorkoutIndex + 1} из {sortedWorkouts.length}</span>
            <span>Выполнено {completedWorkoutCount} из {sortedWorkouts.length}</span>
          </div>
        )}
        {(renderClientMainBottomBar || (() => null))({
          activeTab: "workouts",
          className: "individualWorkoutMenuBar",
          isTrainerMode,
          onGoMain,
          onOpenTraining,
          onOpenNutrition,
          onOpenCabinet,
          onOpenTrainerClients,
          onOpenTrainerPrograms,
          onLoadTrainerCabinet: onOpenCabinet
        })}
      </div>

      <WorkoutModePickerDialog
        open={workoutModeModalOpen}
        workoutModePreference={workoutModePreference}
        onClose={() => setWorkoutModeModalOpen(false)}
        onOpenBasic={onOpenBasicMode}
        onOpenIndividual={() => {
          setWorkoutModeModalOpen(false);
          onOpenIndividualWorkouts();
        }}
      />

      <IndividualWorkoutHistoryDialog
        open={Boolean(isIndividualWorkoutMode && workoutHistoryModalOpen)}
        historyLoading={historyLoading}
        historyItems={individualWorkoutHistoryItems}
        onClose={() => setWorkoutHistoryModalOpen(false)}
        onOpenAll={() => openCabinetWorkoutHistory(null, individualWorkoutProgramScope)}
      />

      <WorkoutDraftRestoreDialog
        open={Boolean(workoutDraftRestorePrompt)}
        blocked={Boolean(
          workoutReadinessOpen ||
          postWorkoutFeedbackOpen ||
          fullscreenVideo ||
          showFirstSetupOnboarding
        )}
        onRestart={() => handleWorkoutDraftChoice(false)}
        onRestore={() => handleWorkoutDraftChoice(true)}
      />
    </div>
  );
}
