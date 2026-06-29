import { AI_COACH_FEATURES } from "../../../domain/workoutPresentation";
import { AI_NUTRITION_WEEK_DAYS } from "../../../data/nutritionPlanning";
import { buildAiCoachResult } from "../../../utils/aiCoachResult";
import { buildAiNutritionDayModel } from "../../../utils/aiNutritionAnalysis";
import { getAiNutritionTrainingDayAdvice } from "../../../utils/aiNutritionLabels";
import {
  getAiNutritionCurrentWeek,
  getAiNutritionDayMacros,
  getAiNutritionTrainingDays,
  isAiNutritionTrainingDay
} from "../../../utils/aiNutritionSchedule";
import { buildAiNutritionMonthlyPlan } from "../../../utils/aiNutritionPlanBuilder";

export default function AiCoachPage({
  onGoBack,
  onOpenProfile,
  selectedAiFeatureId,
  setSelectedAiFeatureId,
  setAiNutritionProfileDraft,
  saveAiNutritionPlan,
  resetAiNutritionPlan,
  aiNutritionAdaptedToday,
  setAiNutritionAdaptedToday,
  aiNutritionSavedPlan,
  aiNutritionProfile,
  aiNutritionProfileDraft,
  nutrition,
  nutritionDateKey,
  history,
  plan
}) {
  const activeAiFeature = AI_COACH_FEATURES.find((feature) => feature.id === selectedAiFeatureId) || AI_COACH_FEATURES[0];
  const aiResult = buildAiCoachResult(activeAiFeature.id, { history, nutrition, plan });
  const isNutritionPlanFeature = activeAiFeature.id === "nutritionPlan";
  const aiNutritionDay = buildAiNutritionDayModel(nutrition, nutrition.days?.[nutritionDateKey], history);
  const activeAiNutritionPlan = aiNutritionSavedPlan || (aiNutritionProfile ? buildAiNutritionMonthlyPlan(nutrition, aiNutritionProfile, history) : null);
  const activeAiNutritionWeekNumber = getAiNutritionCurrentWeek(activeAiNutritionPlan);
  const activeAiNutritionWeek = activeAiNutritionPlan?.weeks?.[activeAiNutritionWeekNumber - 1] || activeAiNutritionPlan?.weeks?.[0];
  const activeAiNutritionProfile = activeAiNutritionPlan?.profile || aiNutritionProfile || aiNutritionProfileDraft;
  const isAiTrainingDayToday = isAiNutritionTrainingDay(activeAiNutritionProfile);
  const activeAiNutritionTodayMacros = getAiNutritionDayMacros(activeAiNutritionWeek || nutrition.goals, activeAiNutritionProfile);
  const aiNutritionTrainingAdvice = getAiNutritionTrainingDayAdvice(isAiTrainingDayToday, activeAiNutritionProfile?.goal);

  return (
    <div className="aiCoachPage">
      <button className="backBtn universalFixedBackPointer aiCoachBackBtn" type="button" onClick={onGoBack} aria-label="Назад">←</button>

      <section className="aiCoachHero">
        <div className="aiCoachBadge">AI ASSISTANT CORE</div>
        <h1>AI-помощник</h1>
        <p>Умные подсказки по питанию, тренировкам, восстановлению и прогрессу на основе твоей истории.</p>
      </section>

      {isNutritionPlanFeature ? (
        <section className="aiNutritionPlanShell">
          {!activeAiNutritionPlan ? (
            <div className="aiNutritionOnboardingCard">
              <div className="aiNutritionOnboardingHead">
                <span>AI-план питания v1</span>
                <h2>Создадим месячный план КБЖУ</h2>
                <p>AI возьмёт твой вес, рост, возраст, цель, текущие КБЖУ, питание за всё время, частые продукты и историю тренировок.</p>
              </div>

              <div className="aiNutritionBodyReadOnlyCard">
                <div className="aiNutritionBodyReadOnlyHead">
                  <strong>Данные из личного кабинета</strong>
                  <small>Редактируются только в профиле</small>
                </div>
                <div className="aiNutritionBodyReadOnlyGrid">
                  <span><i>Вес</i><b>{aiNutritionProfileDraft.weight || "—"}</b></span>
                  <span><i>Рост</i><b>{aiNutritionProfileDraft.height || "—"}</b></span>
                  <span><i>Возраст</i><b>{aiNutritionProfileDraft.age || "—"}</b></span>
                  <span><i>Пол</i><b>{aiNutritionProfileDraft.sex === "female" ? "Ж" : "М"}</b></span>
                </div>
                <button
                  type="button"
                  className="aiNutritionProfileLinkBtn"
                  onClick={onOpenProfile}
                >
                  Изменить в личном кабинете
                </button>
              </div>

              <div className="aiNutritionTrainingDaysPicker">
                <div className="aiNutritionTrainingDaysHead">
                  <strong>Дни тренировок</strong>
                  <small>Можно выбрать несколько дней</small>
                </div>
                <div className="aiNutritionTrainingDaysGrid">
                  {AI_NUTRITION_WEEK_DAYS.map((day) => {
                    const selected = getAiNutritionTrainingDays(aiNutritionProfileDraft).includes(day.id);
                    return (
                      <button
                        type="button"
                        key={day.id}
                        className={selected ? "active" : ""}
                        aria-pressed={selected}
                        title={day.label}
                        onClick={() => setAiNutritionProfileDraft((prev) => {
                          const current = getAiNutritionTrainingDays(prev);
                          const next = current.includes(day.id)
                            ? current.filter((item) => item !== day.id)
                            : [...current, day.id];
                          return { ...prev, trainingDays: next };
                        })}
                      >
                        {day.short}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="aiNutritionGoalPicker">
                {[
                  { id: "maintain", title: "Поддержка", text: "ровный вес и стабильная энергия" },
                  { id: "recomp", title: "Рекомпозиция", text: "больше и лёгкий дефицит" },
                  { id: "mass", title: "Набор массы", text: "плавно + калории" },
                  { id: "cut", title: "Похудение", text: "комфортный дефицит" },
                  { id: "dry", title: "Сушка", text: "дефицит + сохранить мышцы" }
                ].map((goal) => (
                  <button
                    type="button"
                    key={goal.id}
                    className={aiNutritionProfileDraft.goal === goal.id ? "active" : ""}
                    aria-pressed={aiNutritionProfileDraft.goal === goal.id}
                    onClick={() => setAiNutritionProfileDraft((prev) => ({ ...prev, goal: goal.id }))}
                  >
                    <strong>{goal.title}</strong>
                    <small>{goal.text}</small>
                  </button>
                ))}
              </div>

              <button
                type="button"
                className="aiNutritionPrimaryBtn"
                onClick={() => saveAiNutritionPlan()}
              >
                Создать AI-план
              </button>
            </div>
          ) : (
            <div className="aiNutritionPlanCardFull">
              <div className="aiNutritionPlanHero">
                <div>
                  <span>Твой AI-план питания</span>
                  <h2>{activeAiNutritionPlan.goalLabel}</h2>
                  <p>{activeAiNutritionPlan.comment}</p>
                </div>
                <strong>{aiNutritionDay.score}/10</strong>
              </div>

              <div className="aiNutritionTodayMacros">
                <div>
                  <span>Сегодня</span>
                  <strong>{activeAiNutritionTodayMacros?.calories || nutrition.goals.calories}</strong>
                  <small>ккал</small>
                </div>
                <div>
                  <span>Белки</span>
                  <strong>{activeAiNutritionTodayMacros?.protein || nutrition.goals.protein}</strong>
                  <small>г</small>
                </div>
                <div>
                  <span>Жиры</span>
                  <strong>{activeAiNutritionTodayMacros?.fat || nutrition.goals.fat}</strong>
                  <small>г</small>
                </div>
                <div>
                  <span>Углеводы</span>
                  <strong>{activeAiNutritionTodayMacros?.carbs || nutrition.goals.carbs}</strong>
                  <small>г</small>
                </div>
              </div>

              <div className="aiNutritionPlanInsight">
                <span>Краткий AI-комментарий</span>
                <p>{aiNutritionDay.summary} {aiNutritionTrainingAdvice}</p>
              </div>

              <div className="aiNutritionBadgesRow">
                {aiNutritionDay.badges.map((badge) => (
                  <span key={badge.text} className={badge.type}>
                    <i>{badge.icon}</i>{badge.text}
                  </span>
                ))}
              </div>

              <div className={`aiNutritionTrainingDayInfo ${isAiTrainingDayToday ? "active" : ""}`}>
                <span>{isAiTrainingDayToday ? "Сегодня тренировка" : "Сегодня без тренировки"}</span>
                <p>{aiNutritionTrainingAdvice}</p>
              </div>

              <button
                type="button"
                className="aiNutritionAdaptBtn"
                onClick={() => setAiNutritionAdaptedToday((value) => !value)}
              >
                Адаптировать под сегодня
              </button>

              {aiNutritionAdaptedToday && (
                <div className="aiNutritionPlanInsight aiNutritionAdaptResult">
                  <span>Совет на остаток дня</span>
                  <p>{aiNutritionDay.adaptiveAdvice}</p>
                </div>
              )}

              <div className="aiNutritionWeeksGrid">
                {activeAiNutritionPlan.weeks.map((week) => (
                  <div key={week.week} className={week.week === activeAiNutritionWeekNumber ? "active" : ""}>
                    <span>{week.label}</span>
                    <strong>{week.calories} ккал</strong>
                    <small>Б {week.protein} · Ж {week.fat} · У {week.carbs}</small>
                    <p>{week.focus}</p>
                  </div>
                ))}
              </div>

              <div className="aiNutritionTwoCol">
                <div>
                  <span>Прогресс недели</span>
                  <p>Сейчас активна {activeAiNutritionWeekNumber} неделя. {activeAiNutritionPlan.weightTrend?.text}</p>
                </div>
                <div>
                  <span>Частые продукты</span>
                  <p>{activeAiNutritionPlan.frequentFoods?.length ? activeAiNutritionPlan.frequentFoods.join(", ") : "AI будет собирать список по истории питания."}</p>
                </div>
              </div>

              <div className="aiNutritionImproveBox">
                <span>Что улучшить сегодня</span>
                <p>{aiNutritionDay.left?.protein > 20 ? "1. Добрать белок простыми продуктами." : "1. Белок держится хорошо."}</p>
                <p>{aiNutritionDay.left?.carbs > 80 ? "2. Добавить углеводы вокруг тренировки." : "2. Углеводы близко к цели."}</p>
                <p>{aiNutritionDay.left?.fat < 0 ? "3. Остаток дня сделать менее жирным." : "3. Не перегружать жиры вечером."}</p>
              </div>

              <div className="aiNutritionPlanActions">
                <button type="button" onClick={() => saveAiNutritionPlan(aiNutritionProfile)}>Обновить план</button>
                <button type="button" className="ghost" onClick={resetAiNutritionPlan}>Пересоздать анкету</button>
              </div>
            </div>
          )}
        </section>
      ) : (
        <section className="aiCoachResultCard">
          <div className="aiCoachResultTop">
            <div>
              <span>{activeAiFeature.icon}</span>
              <h2>{aiResult.title}</h2>
              <p>{aiResult.status}</p>
            </div>
            <strong>{aiResult.score}%</strong>
          </div>

          <div className="aiCoachMeter" aria-hidden="true">
            <i style={{ width: `${Math.min(100, Math.max(4, aiResult.score))}%` }} />
          </div>

          <div className="aiCoachBlocks">
            <div className="aiCoachMiniBlock">
              <h3>Анализ</h3>
              {aiResult.bullets.map((item) => (
                <p key={item}>{item}</p>
              ))}
            </div>

            <div className="aiCoachMiniBlock accent">
              <h3>Что сделать</h3>
              {aiResult.actions.map((item) => (
                <p key={item}>{item}</p>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="aiCoachGrid">
        {AI_COACH_FEATURES.map((feature) => (
          <button
            type="button"
            key={feature.id}
            data-testid={`ai-coach-feature-${feature.id}`}
            className={`aiCoachFeatureCard ${feature.id === activeAiFeature.id ? "active" : ""}`}
            aria-pressed={feature.id === activeAiFeature.id}
            onClick={() => setSelectedAiFeatureId(feature.id)}
          >
            <span>{feature.icon}</span>
            <strong>{feature.title}</strong>
            <small>{feature.subtitle}</small>
          </button>
        ))}
      </section>
    </div>
  );
}
