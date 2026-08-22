import { Check, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import ClientPageHeader from "../../../shared/ui/ClientPageHeader";
import styles from "./NutritionCalendarModal.module.css";

const SWIPE_DIRECTION_LOCK_PX = 8;
const SWIPE_MONTH_TRIGGER_PX = 48;
const SWIPE_PREVIEW_LIMIT_PX = 72;

export default function NutritionCalendarModal({
  monthLabel,
  days,
  onClose,
  onShiftMonth,
  onSelectDate,
  onSelectToday
}) {
  const swipeGestureRef = useRef(null);
  const suppressDayClickRef = useRef(false);
  const todayConfirmTimerRef = useRef(null);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const [isTodayConfirming, setIsTodayConfirming] = useState(false);

  useEffect(() => () => {
    window.clearTimeout(todayConfirmTimerRef.current);
  }, []);

  const handleSelectToday = () => {
    if (isTodayConfirming) return;

    setIsTodayConfirming(true);
    todayConfirmTimerRef.current = window.setTimeout(() => {
      onSelectToday();
    }, 280);
  };

  const handleSwipePointerDown = (event) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;

    swipeGestureRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      direction: null
    };
    suppressDayClickRef.current = false;
    setSwipeOffset(0);
    setIsSwiping(false);

    try {
      event.currentTarget.setPointerCapture?.(event.pointerId);
    } catch {
      // Synthetic pointer events may not create a capturable active pointer.
    }
  };

  const handleSwipePointerMove = (event) => {
    const gesture = swipeGestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;

    const deltaX = event.clientX - gesture.startX;
    const deltaY = event.clientY - gesture.startY;

    if (!gesture.direction && Math.max(Math.abs(deltaX), Math.abs(deltaY)) >= SWIPE_DIRECTION_LOCK_PX) {
      gesture.direction = Math.abs(deltaX) > Math.abs(deltaY) ? "horizontal" : "vertical";
    }

    if (gesture.direction !== "horizontal") return;

    event.preventDefault();
    setIsSwiping(true);
    setSwipeOffset(Math.max(-SWIPE_PREVIEW_LIMIT_PX, Math.min(SWIPE_PREVIEW_LIMIT_PX, deltaX)));
  };

  const finishSwipe = (event, cancelled = false) => {
    const gesture = swipeGestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;

    const deltaX = event.clientX - gesture.startX;
    const deltaY = event.clientY - gesture.startY;
    const isHorizontal = gesture.direction === "horizontal" ||
      (!gesture.direction && Math.abs(deltaX) > Math.abs(deltaY));
    const shouldShiftMonth = !cancelled &&
      isHorizontal &&
      Math.abs(deltaX) >= SWIPE_MONTH_TRIGGER_PX;

    swipeGestureRef.current = null;
    setIsSwiping(false);

    try {
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    } catch {
      // The pointer can already be released by the browser.
    }

    if (!shouldShiftMonth) {
      setSwipeOffset(0);
      return;
    }

    suppressDayClickRef.current = true;
    setSwipeOffset(deltaX < 0 ? SWIPE_PREVIEW_LIMIT_PX : -SWIPE_PREVIEW_LIMIT_PX);
    onShiftMonth(deltaX < 0 ? 1 : -1);
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => setSwipeOffset(0));
    });
    window.setTimeout(() => {
      suppressDayClickRef.current = false;
    }, 0);
  };

  const handleSwipeClickCapture = (event) => {
    if (!suppressDayClickRef.current) return;
    event.preventDefault();
    event.stopPropagation();
  };

  return (
    <div
      className={styles.overlay}
      data-testid="nutrition-calendar-modal"
      data-css-module-scope="nutrition-calendar-modal"
    >
      <button
        type="button"
        className={styles.backdrop}
        onClick={onClose}
        aria-label="Закрыть календарь по фону"
        data-nutrition-calendar-action="backdrop"
      />

      <div
        className={styles.sheet}
        data-testid="nutrition-calendar-sheet"
        role="dialog"
        aria-modal="true"
        data-modal-surface="true"
        aria-label="Календарь"
      >
        <div className={styles.grabber} aria-hidden="true" data-nutrition-calendar-grabber />
        <ClientPageHeader
          compact
          embedded
          className={styles.pageHeader}
          title="Календарь питания"
          testId="nutrition-calendar-page-header"
          scope="nutrition-calendar-page-header"
          actions={(
            <button
              type="button"
              data-testid="nutrition-calendar-close"
              data-nutrition-calendar-action="close"
              aria-label="Закрыть календарь"
              onClick={onClose}
            >
              <X aria-hidden="true" />
            </button>
          )}
        />

        <div className={styles.header} data-testid="nutrition-calendar-header">
          <button
            type="button"
            className={styles.monthAction}
            onClick={() => onShiftMonth(-1)}
            aria-label="Предыдущий месяц"
            data-nutrition-calendar-action="previous-month"
          >
            ‹
          </button>
          <div className={styles.monthBlock}>
            <span className={styles.eyebrow}>Календарь питания</span>
            <strong className={styles.month}>{monthLabel}</strong>
          </div>
          <button
            type="button"
            className={styles.monthAction}
            onClick={() => onShiftMonth(1)}
            aria-label="Следующий месяц"
            data-nutrition-calendar-action="next-month"
          >
            ›
          </button>
        </div>

        <div
          className={`${styles.swipeRegion} ${isSwiping ? styles.swiping : ""}`}
          style={{ "--nutrition-calendar-swipe-offset": `${swipeOffset}px` }}
          onPointerDown={handleSwipePointerDown}
          onPointerMove={handleSwipePointerMove}
          onPointerUp={finishSwipe}
          onPointerCancel={(event) => finishSwipe(event, true)}
          onClickCapture={handleSwipeClickCapture}
          data-testid="nutrition-calendar-swipe-region"
          data-nutrition-calendar-swipe="months"
          aria-label="Дни месяца. Свайпните влево или вправо для переключения месяца"
        >
          <div className={styles.weekdays} aria-hidden="true" data-testid="nutrition-calendar-weekdays">
            {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((day) => (
              <span className={styles.weekday} key={day}>{day}</span>
            ))}
          </div>

          <div className={styles.grid} data-testid="nutrition-calendar-grid">
            {days.map((day) => (
              <button
                type="button"
                key={day.key}
                className={[
                  styles.day,
                  day.isCurrentMonth ? "" : styles.muted,
                  day.isToday ? styles.today : "",
                  day.isToday && isTodayConfirming ? styles.todayConfirming : "",
                  day.isSelected ? styles.selected : "",
                  day.hasFood ? styles.hasFood : "",
                  day.isOverGoal ? styles.overGoal : ""
                ].filter(Boolean).join(" ")}
                onClick={() => onSelectDate(day.key)}
                aria-pressed={day.isSelected}
                aria-current={day.isToday ? "date" : undefined}
                data-nutrition-calendar-day={day.key}
                data-current-month={day.isCurrentMonth ? "true" : "false"}
                data-has-food={day.hasFood ? "true" : "false"}
                data-over-goal={day.isOverGoal ? "true" : "false"}
              >
                <strong className={styles.dayNumber}>{day.dayNumber}</strong>
                {day.hasFood && (
                  <small className={styles.calories}>{day.calories} ккал</small>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.footer} data-testid="nutrition-calendar-footer">
          <button
            type="button"
            className={`${styles.footerAction}${isTodayConfirming ? ` ${styles.confirmed}` : ""}`}
            onClick={handleSelectToday}
            disabled={isTodayConfirming}
            data-nutrition-calendar-action="today"
            data-nutrition-calendar-today-state={isTodayConfirming ? "confirmed" : "idle"}
          >
            {isTodayConfirming ? <><Check size={18} strokeWidth={2.6} aria-hidden="true" />Готово</> : "Сегодня"}
          </button>
        </div>
      </div>
    </div>
  );
}
