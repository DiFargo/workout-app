import { CalendarDays, Check, ChevronRight, Dumbbell, Heart, Home, Pencil, ShieldCheck, Target, UserRound, ChartNoAxesColumn } from "lucide-react";
import { getAvailableWorkoutEmphases, getWorkoutEmphasisOption } from "../../../../functions/basicWorkoutEmphasis.js";
import BasicWorkoutProfileSummary from "./BasicWorkoutProfileSummary.jsx";
import ui from "./BasicWorkoutQuizControls.module.css";

const SHORT = { goal: ["Форма", "Вес", "Мышцы", "Сила"], level: ["Новичок", "Возвращаюсь", "Есть опыт"], location: ["В зале", "Дома"] };
const ICONS = { goal: Heart, level: ChartNoAxesColumn, location: Home, days: CalendarDays, duration: CalendarDays };
const FOCUS_ICONS = { balanced: Target, lower: Dumbbell, upper: ChartNoAxesColumn, classic: CalendarDays, full_body_331: Dumbbell };

export function QuizSlider({ step, value, onChange }) {
  const selected = step.options.findIndex(option => option.value === value);
  const index = Math.max(0, selected);
  const answer = step.options[index];
  const Icon = ICONS[step.key];
  const numeric = ["days", "duration"].includes(step.key);
  return <>
    <div className={ui.sliderCard}>
      <span className={ui.answerIcon} aria-hidden="true"><Icon /></span>
      <div className={ui.selectedAnswer} aria-live="polite" aria-atomic="true">
        <strong className={numeric ? ui.number : ui.answerTitle}>{numeric ? <>{answer.value}<small>{step.key === "days" ? "в неделю" : "минут"}</small></> : answer.label}</strong>
        <p>{answer.hint}</p>
      </div>
      <div className={ui.slider} style={{ "--thumb-position": `${index / (step.options.length - 1) * 100}%` }}>
        <div className={ui.rail} aria-hidden="true" />
        <div className={ui.ticks} aria-hidden="true">{step.options.map(option => <i key={option.value} />)}</div>
        <input type="range" min="0" max={step.options.length - 1} step="1" value={index}
          aria-label={step.title} aria-valuetext={selected < 0 ? "Ответ ещё не выбран" : answer.label}
          onChange={event => onChange(step.options[Number(event.target.value)].value)}
          onPointerUp={event => onChange(step.options[Number(event.currentTarget.value)].value)}
          onKeyUp={event => { if (["Home", "End", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) onChange(step.options[Number(event.currentTarget.value)].value); }} />
        <div className={ui.thumbMark} aria-hidden="true"><Check /></div>
      </div>
      <div className={ui.stops} style={{ "--stops": step.options.length }}>
        {step.options.map((option, i) => <button type="button" key={option.value} aria-label={option.label} aria-pressed={value === option.value} onClick={() => onChange(option.value)}>{SHORT[step.key]?.[i] || option.value}</button>)}
      </div>
    </div>
    <p className={ui.helper}><Check aria-hidden="true" /> Перетащи бегунок или нажми на отметку.</p>
  </>;
}

export function QuizPreferences({ quiz, updateQuiz, structureOptions }) {
  return <>
    <div className={ui.focusGrid} role="group" aria-label="Акцент программы">
      {getAvailableWorkoutEmphases(quiz).map(option => {
        const Icon = FOCUS_ICONS[option.value];
        return <button type="button" key={option.value} className={option.value === "full_body_331" ? ui.fullBodyOption : undefined} aria-label={option.label} aria-pressed={quiz.trainingEmphasis === option.value} onClick={() => updateQuiz("trainingEmphasis", option.value)}>
          <Icon aria-hidden="true" /><strong>{option.value === "balanced" ? "Всё тело" : option.label}</strong>
          {quiz.trainingEmphasis === option.value ? <Check className={ui.tinyCheck} aria-hidden="true" /> : null}
        </button>;
      })}
    </div>
    <p className={ui.focusHint} id="basic-quiz-emphasis-hint">{getWorkoutEmphasisOption(quiz.trainingEmphasis).hint}</p>
    {quiz.days === "2" && quiz.trainingEmphasis === "classic" ? <label className={ui.field} data-testid="basic-quiz-two-day-structure">
      <span>Формат двух тренировок</span><select aria-label="Формат двух тренировок" value={quiz.twoDayStructure} onChange={event => updateQuiz("twoDayStructure", event.target.value)}>
        <option value="" disabled>Выбери формат</option>{structureOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label> : null}
    <label className={ui.field}><span>Что ещё учесть?<small>Необязательно</small></span>
      <textarea data-testid="basic-quiz-plan-preferences" maxLength={280} value={quiz.planPreferences} onChange={event => updateQuiz("planPreferences", event.target.value)} placeholder="Например, люблю тренажёры и гантели" />
    </label>
    <p className={ui.helper}><ShieldCheck aria-hidden="true" />Не добавляй личные контакты. Об ограничениях расскажи на предыдущем шаге.</p>
  </>;
}

export function QuizReviewAnswers({ quiz, steps, editAnswer, context, loading, onEditProfile, updateQuiz, structureLabel }) {
  const answer = key => steps.find(step => step.key === key)?.options?.find(option => option.value === quiz[key])?.label || "Не выбрано";
  const row = (key, label, text, index) => <button className={ui.reviewRow} data-answer-key={key} key={key} type="button" onClick={() => editAnswer(index)} aria-label={`Изменить: ${label}`}><span>{label}</span><strong>{text}</strong><ChevronRight aria-hidden="true" /></button>;
  return <>
    <div className={ui.stats}>
      <button data-answer-key="days" type="button" onClick={() => editAnswer(3)} aria-label="Изменить: Частота"><Pencil aria-hidden="true" /><strong>{quiz.days} {quiz.days === "1" || quiz.days === "5" ? "раз" : "раза"}</strong><small>в неделю</small></button>
      <button data-answer-key="duration" type="button" onClick={() => editAnswer(4)} aria-label="Изменить: Время"><Pencil aria-hidden="true" /><strong>{quiz.duration} мин</strong><small>на тренировку</small></button>
    </div>
    <div className={ui.reviewList}>
      {row("goal", "Цель", answer("goal"), 0)}{row("level", "Опыт", answer("level"), 1)}{row("location", "Место", answer("location"), 2)}
      {row("trainingEmphasis", "Акцент", getWorkoutEmphasisOption(quiz.trainingEmphasis).label, 6)}
      {row("restrictions", "Ограничения", quiz.restrictions === "other" ? quiz.restrictionDetails : answer("restrictions"), 5)}
      {quiz.planPreferences.trim() ? row("planPreferences", "Пожелание", quiz.planPreferences, 6) : null}
      {quiz.days === "2" && quiz.trainingEmphasis === "classic" ? row("twoDayStructure", "Формат", structureLabel, 6) : null}
    </div>
    <details className={ui.profile}><summary><UserRound aria-hidden="true" /><span><strong>Учтём данные профиля</strong><small>{context.registration.sex === "female" ? "Женщина" : context.registration.sex === "male" ? "Мужчина" : "Пол не указан"} · {context.registration.age ? `${context.registration.age} лет` : "Возраст не указан"} · {context.registration.weight ? `${context.registration.weight} кг` : "Вес не указан"}</small></span><ChevronRight aria-hidden="true" /></summary>
      <BasicWorkoutProfileSummary context={context} loading={loading} onEdit={onEditProfile} specialStatus={quiz.specialStatus} onSpecialStatusChange={value => updateQuiz("specialStatus", value)} />
    </details>
    {context.registration.sex && context.registration.age && context.registration.height && context.registration.weight ? null : <p className={ui.helper}>Для подбора заполни недостающие данные в кабинете.</p>}
    <p className={ui.helper}>Сначала покажем программу. Сохранение — отдельным шагом.</p>
  </>;
}
