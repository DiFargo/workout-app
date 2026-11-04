import { useId, useState } from "react";
import { ChevronRight, NotebookPen } from "lucide-react";
import { buildFamiliarNutritionPeriod } from "../../utils/trainerFamiliarNutritionAnalytics.js";
import styles from "./TrainerClientFamiliarNutritionAnalytics.module.css";

const EMPTY_DAYS = [];
const EMPTY_TARGET = {};
const MACROS = [["protein", "Белки"], ["fat", "Жиры"], ["carbs", "Углеводы"]];
const formatNumber = value => Number.isFinite(value) ? new Intl.NumberFormat("ru-RU").format(value) : "Нет данных";
const formatDate = key => key ? new Date(`${key}T12:00:00`).toLocaleDateString("ru-RU", { day: "numeric", month: "short" }) : "";
const goalNumber = value => Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : null;

export default function TrainerClientFamiliarNutritionAnalytics({ nutritionDays = EMPTY_DAYS, target = EMPTY_TARGET, onOpenDiary }) {
  const id = useId();
  const [period, setPeriod] = useState("7");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const model = buildFamiliarNutritionPeriod(nutritionDays, { period, customStart, customEnd });
  const { trackedDays, averages, validationError } = model;
  const countLabel = model.dayCount ? `${trackedDays.length} из ${model.dayCount}` : String(trackedDays.length);
  const calorieGoal = goalNumber(target.calories);
  const chartDays = model.chartDays;
  const chartDensity = chartDays.length > 21 ? "dense" : chartDays.length > 7 ? "compact" : "standard";
  const maxCalories = Math.max(calorieGoal || 0, ...chartDays.map(day => day.values.calories || 0), 1);
  const range = model.startKey && model.endKey ? `${formatDate(model.startKey)} — ${formatDate(model.endKey)}` : customEnd ? `До ${formatDate(model.endKey)}` : "Все загруженные завершённые дни";

  return <div className={`trainerNutritionAnalytics ${styles.root}`}>
    <section className={`trainerNutritionPeriod ${styles.period}`} aria-label="Период питания">
      <div className={`trainerNutritionPeriodButtons ${styles.periodButtons}`}>
        {["7", "14", "30", "custom"].map(value => <button type="button" key={value} aria-pressed={period === value} className={period === value ? "active" : ""} onClick={() => setPeriod(value)}>{value === "custom" ? "Период" : `${value} дней`}</button>)}
      </div>
      {period === "custom" ? <div className={`trainerNutritionCustomPeriod ${styles.customPeriod}`}>
        <label><span>С</span><input type="date" max={model.yesterdayKey} value={customStart} aria-invalid={Boolean(validationError)} aria-describedby={validationError ? `${id}-error` : undefined} onChange={event => setCustomStart(event.target.value)} /></label>
        <label><span>По</span><input type="date" max={model.yesterdayKey} value={customEnd} aria-invalid={Boolean(validationError)} aria-describedby={validationError ? `${id}-error` : undefined} onChange={event => setCustomEnd(event.target.value)} /></label>
      </div> : null}
      {validationError ? <p id={`${id}-error`} className={styles.error} role="alert">{validationError}</p> : <p className={styles.periodCaption} role="status">{range} · без сегодняшнего дня</p>}
    </section>

    {!validationError && !trackedDays.length ? <section className={`trainerNutritionCaloriesChart ${styles.empty}`} aria-labelledby={`${id}-empty-title`}>
      <NotebookPen size={25} aria-hidden="true" />
      <h3 id={`${id}-empty-title`}>Дневник пока не заполнен</h3>
      <p>В выбранном периоде нет завершённых дней с записями. Оценить соблюдение питания пока нельзя.</p>
      <small>{countLabel} дней с записями. Калории и белок: нет данных, а не 0.</small>
      {onOpenDiary ? <button type="button" className={styles.diaryButton} onClick={onOpenDiary}>Открыть дневник<ChevronRight size={17} aria-hidden="true" /></button> : null}
    </section> : null}

    {!validationError && trackedDays.length > 0 ? <>
      <section className={`trainerNutritionMetricGrid ${styles.metrics}`} aria-label="Фактическое питание за период">
        <article><span>Дней с записями</span><strong>{countLabel}</strong><small>завершённые дни</small></article>
        <article><span>Средние калории</span><strong>{formatNumber(averages.calories)}</strong><small>{calorieGoal ? `цель ${formatNumber(calorieGoal)} ккал` : "цель не задана"}</small></article>
        <article><span>Средний белок</span><strong>{averages.protein === null ? "Нет данных" : `${formatNumber(averages.protein)} г`}</strong><small>{goalNumber(target.protein) ? `цель ${formatNumber(Number(target.protein))} г` : "цель не задана"}</small></article>
      </section>
      {onOpenDiary ? <div className={styles.filledDiaryAction}><button type="button" className={styles.diaryButton} onClick={onOpenDiary}>Открыть дневник<ChevronRight size={17} aria-hidden="true" /></button></div> : null}
      <div className={`trainerNutritionAnalyticsMain ${styles.analytics}`}>
        <section className={`trainerClientAnalyticsCard trainerNutritionCaloriesChart ${styles.calories}`}>
          <header><div><span>Факт по дням</span><h3>{period === "custom" ? "Питание за выбранный период" : `Питание за ${period} дней`}</h3></div>{calorieGoal ? <small>Цель {formatNumber(calorieGoal)} ккал</small> : null}</header>
          <div className={`trainerClientBarChart ${styles.barChart}`} data-density={chartDensity} style={{ "--nutrition-chart-days": chartDays.length }} aria-label="Калории по завершённым дням">
            {chartDays.map(day => <div key={day.dateKey} aria-label={`${formatDate(day.dateKey)}: ${day.values.calories > 0 ? `${formatNumber(day.values.calories)} ккал` : "нет записей"}`} title={`${formatDate(day.dateKey)}: ${day.values.calories > 0 ? `${formatNumber(day.values.calories)} ккал` : "нет записей"}`}>
              <span>{day.values.calories > 0 ? <i style={{ height: `${Math.max(2, day.values.calories / maxCalories * 100)}%` }} /> : null}</span>
              <b>{day.values.calories > 0 ? Math.round(day.values.calories) : "—"}</b>
              <small>{new Date(`${day.dateKey}T12:00:00`).getDate()}</small>
            </div>)}
          </div>
          <div className={styles.chartRange}><span>{formatDate(chartDays[0]?.dateKey)}</span><span>{chartDays.length > 1 ? formatDate(chartDays.at(-1)?.dateKey) : ""}</span></div>
          <p className={styles.caption}>Средние рассчитаны по {trackedDays.length} дням с записями. Пустой день не считается нулевой калорийностью.</p>
          <details className={styles.exactValues}><summary>Даты и точные значения</summary><table><caption>Фактическая калорийность</caption><thead><tr><th scope="col">Дата</th><th scope="col">Ккал</th></tr></thead><tbody>{chartDays.map(day => <tr key={day.dateKey}><td>{formatDate(day.dateKey)}</td><td>{day.values.calories > 0 ? formatNumber(day.values.calories) : "Нет записей"}</td></tr>)}</tbody></table></details>
        </section>
        <section className={`trainerClientAnalyticsCard trainerNutritionBalance ${styles.balance}`}>
          <header><div><span>Факт, не цели</span><h3>Средние БЖУ</h3></div></header>
          <div className={styles.macros}>{MACROS.map(([key, label]) => <div key={key}><span>{label}</span><strong>{averages[key] === null ? "Нет данных" : `${formatNumber(averages[key])} г`}</strong><small>{goalNumber(target[key]) ? `Цель ${formatNumber(Number(target[key]))} г` : "Цель не задана"}</small>{model.recordedCounts[key] !== trackedDays.length ? <small>Записи: {model.recordedCounts[key]} из {trackedDays.length} дней</small> : null}</div>)}</div>
          <p className={styles.caption}>Сравнивайте записи с планом вместе с клиентом. Неполный дневник не позволяет оценить соблюдение питания.</p>
        </section>
      </div>
    </> : null}
  </div>;
}
