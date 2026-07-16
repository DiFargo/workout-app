import { useEffect, useRef } from "react";

import { todayNutritionKey } from "../../../domain/nutritionPresentation.js";

const NEXT_DAY_BUFFER_MS = 1200;
const MIN_NEXT_DAY_DELAY_MS = 1000;

export function getMillisecondsUntilNextNutritionDay(date = new Date()) {
  const nextDay = new Date(date);
  nextDay.setHours(24, 0, 0, NEXT_DAY_BUFFER_MS);
  return Math.max(MIN_NEXT_DAY_DELAY_MS, nextDay.getTime() - date.getTime());
}

export function shouldShiftNutritionDateOnLocalDayChange(selectedDateKey, previousTodayKey) {
  return !selectedDateKey || selectedDateKey === previousTodayKey;
}

export function useNutritionDayRolloverEffect({
  nutritionDateKey,
  setExpandedNutritionMeals,
  setNutritionCalendarMonthKey,
  setSelectedNutritionDateKey
}) {
  const todayKeyRef = useRef(todayNutritionKey());
  const selectedDateKeyRef = useRef(nutritionDateKey);

  useEffect(() => {
    selectedDateKeyRef.current = nutritionDateKey;
  }, [nutritionDateKey]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    let timerId = 0;

    function shiftToTodayIfNeeded() {
      const nextTodayKey = todayNutritionKey();
      const previousTodayKey = todayKeyRef.current;

      if (nextTodayKey !== previousTodayKey) {
        todayKeyRef.current = nextTodayKey;

        if (shouldShiftNutritionDateOnLocalDayChange(selectedDateKeyRef.current, previousTodayKey)) {
          selectedDateKeyRef.current = nextTodayKey;
          setSelectedNutritionDateKey(nextTodayKey);
          setNutritionCalendarMonthKey(nextTodayKey.slice(0, 7));
          setExpandedNutritionMeals({});
        }
      }

      window.clearTimeout(timerId);
      timerId = window.setTimeout(shiftToTodayIfNeeded, getMillisecondsUntilNextNutritionDay());
    }

    function handleVisibilityChange() {
      if (typeof document === "undefined" || !document.hidden) {
        shiftToTodayIfNeeded();
      }
    }

    timerId = window.setTimeout(shiftToTodayIfNeeded, getMillisecondsUntilNextNutritionDay());
    window.addEventListener("focus", shiftToTodayIfNeeded);
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", handleVisibilityChange);
    }

    return () => {
      window.clearTimeout(timerId);
      window.removeEventListener("focus", shiftToTodayIfNeeded);
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", handleVisibilityChange);
      }
    };
  }, [setExpandedNutritionMeals, setNutritionCalendarMonthKey, setSelectedNutritionDateKey]);
}
