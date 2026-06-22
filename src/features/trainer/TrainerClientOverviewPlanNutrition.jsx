export default function TrainerClientOverviewPlanNutrition({
  adminPaymentDraft,
  adminTrainerNote,
  dailyCalorieGoal,
  dailyCarbsGoal,
  dailyFatGoal,
  dailyProteinGoal,
  formatTrainerSummaryDate,
  saveAdminTrainerNote,
  selectedAssignedWorkouts,
  selectedClient,
  selectedCompletedWorkouts,
  selectedNutritionAverage,
  selectedNutritionCompliance,
  selectedNutritionDays7Complete,
  selectedPaymentAttention,
  selectedProgramCompletion,
  selectedRecentActivity,
  setAdminProgramControlOpen,
  setAdminTrainerNote,
  setAdminUsersSelectedTab,
  trainerAiRecommendations
}) {
  return (
    <>
      <div className="trainerClientOverviewGrid">
        <section className="trainerClientOverviewSection trainerClientNutritionOverview">
          <div className="trainerClientSectionHead">
            <div>
              <span>ПИТАНИЕ · 7 ДНЕЙ</span>
              <small>{selectedNutritionDays7Complete}/7 завершённых дней с записями</small>
            </div>
            <button type="button" onClick={() => setAdminUsersSelectedTab("calendarNutrition")}>Открыть календарь →</button>
          </div>
          <div className="trainerClientMacroGrid">
            {[
              ["Калории", selectedNutritionAverage.calories, dailyCalorieGoal, "ккал"],
              ["Белки", selectedNutritionAverage.protein, dailyProteinGoal, "г"],
              ["Жиры", selectedNutritionAverage.fat, dailyFatGoal, "г"],
              ["Углеводы", selectedNutritionAverage.carbs, dailyCarbsGoal, "г"]
            ].map(([label, value, goal, unit]) => {
              const percent = value ? Math.min(100, Math.round(value / goal * 100)) : 0;
              return (
                <div key={label}>
                  <span>{label}</span>
                  <strong>{value || "—"}<small>{unit}</small></strong>
                  <em>из {goal}{unit}</em>
                  <i style={{ "--macro-progress": `${percent * 3.6}deg` }}><b>{percent}%</b></i>
                </div>
              );
            })}
          </div>
          <div className="trainerClientCompliance">
            <span>Соблюдение плана</span>
            <i><b style={{ width: `${selectedNutritionCompliance}%` }} /></i>
            <strong>{selectedNutritionCompliance}%</strong>
          </div>
        </section>

        <section className="trainerClientOverviewSection trainerClientAiOverview">
          <div className="trainerClientSectionHead">
            <div>
              <span>РЕКОМЕНДАЦИИ ТРЕНЕРУ</span>
              <small>На основе последних данных</small>
            </div>
          </div>
          <div className="trainerClientAiList">
            {(trainerAiRecommendations.length ? trainerAiRecommendations : ["Критичных сигналов нет. Можно продолжать текущий план."]).slice(0, 3).map((item, index) => (
              <div key={item}>
                <i className={index === 0 ? "warning" : "success"}>{index === 0 ? "!" : "✓"}</i>
                <span>
                  <strong>{index === 0 ? "Обрати внимание" : "Стабильная динамика"}</strong>
                  <small>{item}</small>
                </span>
              </div>
            ))}
          </div>
          <details className="trainerClientNoteEditor">
            <summary>Заметка тренера</summary>
            <textarea value={adminTrainerNote} onChange={(event) => setAdminTrainerNote(event.target.value)} placeholder="Травмы, ограничения, предпочтения..." />
            <button type="button" onClick={saveAdminTrainerNote}>Сохранить заметку</button>
          </details>
        </section>
      </div>

      <div className="trainerClientOverviewGrid trainerClientProgramRow">
        <section className="trainerClientOverviewSection trainerClientProgramOverview">
          <div className="trainerClientSectionHead">
            <div>
              <span>ПРОГРАММА</span>
              <small>Текущая программа тренировок</small>
            </div>
            <button type="button" onClick={() => setAdminUsersSelectedTab("training")}>Открыть программу →</button>
          </div>
          <div className="trainerClientProgramSummary">
            <i>▥</i>
            <span>
              <small>Назначено</small>
              <strong>{selectedClient.assignedProgramName || "Программа не назначена"}</strong>
            </span>
            <b>{selectedProgramCompletion === null ? "—" : `${selectedProgramCompletion}%`}</b>
          </div>
          <div className="trainerClientProgramProgress">
            <i><b style={{ width: `${selectedProgramCompletion || 0}%` }} /></i>
            <span>Выполнено тренировок <strong>{selectedCompletedWorkouts} из {selectedAssignedWorkouts || "—"}</strong></span>
            <span>Следующая <strong>{selectedAssignedWorkouts ? "По плану" : "Не назначена"}</strong></span>
          </div>
        </section>

        <section className="trainerClientOverviewSection trainerClientControlOverview">
          <div className="trainerClientSectionHead">
            <div>
              <span>КОНТРОЛЬ ПРОГРАММЫ</span>
              <small>Сроки сопровождения и следующий контроль</small>
            </div>
            <div className="trainerClientSectionActions">
              <strong className={selectedPaymentAttention.id}>{selectedPaymentAttention.label}</strong>
              <button type="button" onClick={() => setAdminProgramControlOpen(true)}>Изменить</button>
            </div>
          </div>
          <div className="trainerClientControlRows">
            <div><span>Формат</span><strong>{adminPaymentDraft.format || "Персональный"}</strong></div>
            <div><span>Назначена от</span><strong>{adminPaymentDraft.assignedFrom ? formatTrainerSummaryDate(adminPaymentDraft.assignedFrom) : formatTrainerSummaryDate(selectedClient.assignedProgramUpdatedAt)}</strong></div>
            <div><span>Контроль до</span><strong>{adminPaymentDraft.controlUntil ? formatTrainerSummaryDate(adminPaymentDraft.controlUntil) : "Не указан"}</strong></div>
          </div>
        </section>
      </div>

      <section className="trainerClientOverviewSection trainerClientActivityOverview">
        <div className="trainerClientSectionHead">
          <div>
            <span>ПОСЛЕДНЯЯ АКТИВНОСТЬ</span>
            <small>Тренировки, задачи, фото и изменения программы</small>
          </div>
        </div>
        <div className="trainerClientActivityList">
          {selectedRecentActivity.map((event) => (
            <div key={event.id}>
              <i>{event.type === "workout" ? "▥" : event.type === "photo" ? "□" : event.type === "task" ? "✓" : "•"}</i>
              <strong>{event.title}</strong>
              <span>{event.details || "Без комментария"}</span>
              <time>{formatTrainerSummaryDate(event.date || event.createdAt)}</time>
            </div>
          ))}
          {!selectedRecentActivity.length && <p className="trainerWorkspaceEmpty">Активность появится после первой тренировки или действия тренера.</p>}
        </div>
      </section>
    </>
  );
}
