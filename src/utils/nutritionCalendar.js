import {
  dateToNutritionKey,
  makeEmptyNutritionDay,
  nutritionKeyToDate,
  todayNutritionKey
} from "../domain/nutritionPresentation.js";
import { calculateNutritionFoodStreak } from "./auditSafety.js";
import { sumNutritionFoods } from "./nutritionFoodTotals.js";

const NUTRITION_WEEK_LABELS = ["\u041f\u041d", "\u0412\u0422", "\u0421\u0420", "\u0427\u0422", "\u041f\u0422", "\u0421\u0411", "\u0412\u0421"];

function getCalendarNutritionDayTotals(day = {}) {
  return sumNutritionFoods(day.foods || []);
}

export function buildNutritionWeekDates(centerKey = todayNutritionKey()) {
  const centerDate = nutritionKeyToDate(centerKey);
  const monday = new Date(centerDate);
  const dayIndex = monday.getDay() === 0 ? 6 : monday.getDay() - 1;
  monday.setDate(monday.getDate() - dayIndex);

  return Array.from({ length: 7 }).map((_, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    return {
      key: dateToNutritionKey(date),
      label: NUTRITION_WEEK_LABELS[index],
      date
    };
  });
}

export function buildNutritionCurrentStreak(days = {}, selectedDateKey = todayNutritionKey()) {
  return calculateNutritionFoodStreak(days || {}, selectedDateKey || todayNutritionKey());
}

export function buildNutritionCalendarDays({
  monthKey = todayNutritionKey().slice(0, 7),
  selectedDateKey = todayNutritionKey(),
  nutrition = {},
  todayKey = todayNutritionKey()
} = {}) {
  const [year, month] = String(monthKey || todayNutritionKey().slice(0, 7)).split("-").map(Number);
  const firstDay = new Date(year || new Date().getFullYear(), (month || 1) - 1, 1);
  const start = new Date(firstDay);
  const mondayOffset = (firstDay.getDay() + 6) % 7;
  start.setDate(firstDay.getDate() - mondayOffset);

  return Array.from({ length: 42 }).map((_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const key = dateToNutritionKey(date);
    const day = nutrition.days?.[key] || makeEmptyNutritionDay();
    const totals = getCalendarNutritionDayTotals(day);

    return {
      key,
      date,
      dayNumber: date.getDate(),
      isCurrentMonth: date.getMonth() === firstDay.getMonth(),
      isToday: key === todayKey,
      isSelected: key === selectedDateKey,
      hasFood: Boolean(day.foods?.length),
      foodCount: day.foods?.length || 0,
      calories: Math.round(totals.calories || 0),
      protein: Math.round(totals.protein || 0),
      isOverGoal: totals.calories > (Number(nutrition.goals?.calories) || 0)
    };
  });
}

export function formatNutritionCalendarMonthLabel(monthKey = todayNutritionKey().slice(0, 7), locale = "ru-RU") {
  const [year, month] = String(monthKey || todayNutritionKey().slice(0, 7)).split("-").map(Number);
  return new Date(year || new Date().getFullYear(), (month || 1) - 1, 1).toLocaleDateString(locale, {
    month: "long",
    year: "numeric"
  });
}

export function shiftNutritionCalendarMonthKey(monthKey = todayNutritionKey().slice(0, 7), offset = 0) {
  const [year, month] = String(monthKey || todayNutritionKey().slice(0, 7)).split("-").map(Number);
  const date = new Date(year || new Date().getFullYear(), (month || 1) - 1 + offset, 1);
  return dateToNutritionKey(date).slice(0, 7);
}
