export default function TrainerClientOverviewLegacyDetails({
  adminClientEvents,
  adminClientHistory,
  adminClientMeasurements,
  adminClientProgressPhotos,
  adminClientTasks,
  adminMeasurementPreviewFields,
  adminNewTaskDueDate,
  adminNewTaskTitle,
  adminPaymentDraft,
  adminPhotoCompareIds,
  adminProgressPhotoComment,
  adminProgressPhotoDate,
  adminProgressPhotoFiles,
  adminProgressPhotoUploading,
  aiWeek,
  clientNutritionDays,
  createAdminClientTask,
  currentMonthTrainingDays,
  dailyCalorieGoal,
  dailyCarbsGoal,
  dailyFatGoal,
  dailyProteinGoal,
  deleteAdminClientTask,
  formatProfileMeasurementDate,
  formatTrainerSummaryDate,
  getActiveTrainerTasksCount,
  getAdminClientGoalLabel,
  getAdminClientTrainingDaysText,
  getAdminNutritionDayMetrics,
  getAiNutritionActivityLabel,
  getClientTelegramProfile,
  getProfileMeasurementValue,
  getTrainerSummaryTimestamp,
  getTrainerTaskStatus,
  hasAdminWorkoutOnDate,
  lastWorkout,
  nutritionMonthAverageCalories,
  nutritionMonthAverageProtein,
  nutritionMonthDays,
  nutritionMonthLabel,
  recommendations,
  saveAdminClientPayment,
  selectedClient,
  selectedLatestMeasurement,
  selectedPaymentAttention,
  selectedPhotoCompare,
  selectedPlateau,
  selectedPreviousMeasurement,
  selectedProfile,
  setAdminNewTaskDueDate,
  setAdminNewTaskTitle,
  setAdminPaymentDraft,
  setAdminPhotoCompareIds,
  setAdminProgressPhotoComment,
  setAdminProgressPhotoDate,
  setAdminProgressPhotoFiles,
  trainerAiRecommendations,
  updateAdminClientTask,
  uploadAdminProgressPhotos,
  workoutProgress
}) {
  return (
    <>
      <div className="adminClientMetricGrid adminClientMetricGridRender">
        <div className="adminClientMetricCardRender"><i>▣</i><span>Вес</span><strong>{selectedProfile?.weight || "—"} кг</strong></div>
        <div className="adminClientMetricCardRender"><i>↕</i><span>Рост</span><strong>{selectedProfile?.height || "—"} см</strong></div>
        <div className="adminClientMetricCardRender"><i>♙</i><span>Возраст</span><strong>{selectedProfile?.age || "—"}</strong></div>
        <div className="adminClientMetricCardRender"><i>◎</i><span>Твоя цель</span><strong>{getAdminClientGoalLabel(selectedProfile?.goal)}</strong></div>
        <div className="adminClientMetricCardRender adminClientMetricCardWideRender"><i>🔥</i><span>Активность</span><strong>{String(getAiNutritionActivityLabel(selectedProfile?.activity || "medium")).replace(" активность", "")}</strong></div>
        <div className="adminClientMetricCardRender adminClientMetricCardWideRender"><i>⌁</i><span>Тренировочные дни</span><strong>{getAdminClientTrainingDaysText(selectedProfile)}</strong></div>
        <div className="adminClientMetricCardRender adminClientMetricCardWideRender"><i>▣</i><span>Последняя тренировка</span><strong>{lastWorkout?.date ? new Date(lastWorkout.date).toLocaleDateString("ru-RU") : "—"}</strong></div>
        <div className="adminClientMetricCardRender adminClientMetricCardWideRender"><i>🧠</i><span>AI-план</span><strong>{aiWeek ? `${aiWeek.calories} ккал` : "—"}</strong></div>
        <div className="adminClientMetricCardRender adminClientMetricCardWideRender"><i>✈️</i><span>Telegram</span><strong>{getClientTelegramProfile(selectedClient).connected ? `@${getClientTelegramProfile(selectedClient).username}` : "не привязан"}</strong></div>
      </div>

      <div className="adminClientMeasurementsBlock">
        <div className="adminClientMeasurementsHead">
          <div>
            <span>BODY MEASUREMENTS</span>
            <h3>Данные замеров</h3>
            <p>{selectedLatestMeasurement ? `Последний замер: ${formatProfileMeasurementDate(selectedLatestMeasurement)}` : "Замеров пока нет или доступ к ним закрыт."}</p>
          </div>
          <strong>{selectedLatestMeasurement ? `${adminClientMeasurements.length}` : "—"}</strong>
        </div>

        {selectedLatestMeasurement ? (
          <div className="adminClientMeasurementsGrid">
            {adminMeasurementPreviewFields.map((field) => {
              const value = getProfileMeasurementValue(selectedLatestMeasurement || {}, field);
              const previousValue = getProfileMeasurementValue(selectedPreviousMeasurement || {}, field);
              const numericValue = Number(String(value || "").replace(",", "."));
              const numericPrevious = Number(String(previousValue || "").replace(",", "."));
              const delta = Number.isFinite(numericValue) && Number.isFinite(numericPrevious)
                ? Math.round((numericValue - numericPrevious) * 10) / 10
                : null;

              return (
                <div key={field.id} className="adminClientMeasurementItem">
                  <span>{field.label}</span>
                  <strong>{value}<small>{field.unit}</small></strong>
                  <em className={delta === null ? "" : delta > 0 ? "up" : delta < 0 ? "down" : ""}>
                    {delta === null ? "—" : delta > 0 ? `+${delta}` : String(delta)}
                  </em>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="adminClientMeasurementsEmpty">
            <span>📏</span>
            <p>После первого контрольного замера здесь появятся вес, шея, плечевой пояс, грудь, бицепс, предплечье и остальные объёмы.</p>
          </div>
        )}
      </div>

      <section className="trainerClientManagementGrid">
        <article className="trainerWorkspaceCard trainerTasksCard">
          <div className="trainerWorkspaceHead">
            <div>
              <span>ЗАДАЧИ НА НЕДЕЛЮ</span>
              <h3>Задачи клиенту</h3>
            </div>
            <strong>{getActiveTrainerTasksCount(adminClientTasks)}</strong>
          </div>

          <div className="trainerTaskCreate">
            <input
              value={adminNewTaskTitle}
              onChange={(event) => setAdminNewTaskTitle(event.target.value)}
              placeholder="Например: сделать контрольный замер"
            />
            <input
              type="date"
              value={adminNewTaskDueDate}
              onChange={(event) => setAdminNewTaskDueDate(event.target.value)}
            />
            <button type="button" onClick={createAdminClientTask}>Добавить</button>
          </div>

          <div className="trainerTaskList">
            {adminClientTasks.map((task) => {
              const taskStatus = getTrainerTaskStatus(task);
              return (
                <div className={`trainerTaskRow ${taskStatus.id}`} key={task.id}>
                  <button
                    type="button"
                    className="trainerTaskCheck"
                    onClick={() => updateAdminClientTask(task, taskStatus.id === "completed" ? "progress" : "completed")}
                    aria-label={taskStatus.id === "completed" ? "Вернуть задачу" : "Отметить выполненной"}
                  >
                    {taskStatus.id === "completed" ? "✓" : ""}
                  </button>
                  <span>
                    <strong>{task.title}</strong>
                    <small>{task.dueDate ? `До ${new Date(`${task.dueDate}T12:00:00`).toLocaleDateString("ru-RU")}` : "Без срока"}</small>
                  </span>
                  <em>{taskStatus.label}</em>
                  <button type="button" className="trainerTaskDelete" onClick={() => deleteAdminClientTask(task)}>×</button>
                </div>
              );
            })}
            {!adminClientTasks.length && <p className="trainerWorkspaceEmpty">Задач пока нет.</p>}
          </div>
        </article>

        <article className="trainerWorkspaceCard trainerAiFocusCard">
          <div className="trainerWorkspaceHead">
            <div>
              <span>AI FOCUS</span>
              <h3>Рекомендации тренеру</h3>
            </div>
            <strong>AI</strong>
          </div>
          <div className="trainerAiRecommendationList">
            {(trainerAiRecommendations.length ? trainerAiRecommendations : ["Критичных сигналов нет. Можно продолжать текущий план."]).map((item) => (
              <div key={item}><i>✦</i><p>{item}</p></div>
            ))}
          </div>
          {selectedPlateau.isPlateau && (
            <div className="trainerPlateauBadge">Нет прогресса {selectedPlateau.days} дней</div>
          )}
        </article>

        <article className="trainerWorkspaceCard trainerProgressPhotosCard">
          <div className="trainerWorkspaceHead">
            <div>
              <span>ФОТО ПРОГРЕССА</span>
              <h3>Фронт · бок · спина</h3>
            </div>
            <strong>{adminClientProgressPhotos.length}</strong>
          </div>

          <div className="trainerPhotoUploadGrid">
            {[
              ["front", "Фронт"],
              ["side", "Бок"],
              ["back", "Спина"]
            ].map(([view, label]) => (
              <label key={view}>
                <span>{label}</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) => setAdminProgressPhotoFiles((current) => ({
                    ...current,
                    [view]: event.target.files?.[0] || null
                  }))}
                />
                <em>{adminProgressPhotoFiles[view]?.name || "Выбрать"}</em>
              </label>
            ))}
          </div>
          <div className="trainerPhotoMetaRow">
            <input type="date" value={adminProgressPhotoDate} onChange={(event) => setAdminProgressPhotoDate(event.target.value)} />
            <input value={adminProgressPhotoComment} onChange={(event) => setAdminProgressPhotoComment(event.target.value)} placeholder="Комментарий тренера" />
            <button type="button" disabled={adminProgressPhotoUploading} onClick={uploadAdminProgressPhotos}>
              {adminProgressPhotoUploading ? "Загружаю..." : "Сохранить фото"}
            </button>
          </div>

          {adminClientProgressPhotos.length > 0 && (
            <>
              <div className="trainerPhotoCompareControls">
                {[0, 1].map((slot) => (
                  <select
                    aria-label={slot === 0 ? "Предыдущая фотосессия для сравнения" : "Новая фотосессия для сравнения"}
                    key={slot}
                    value={adminPhotoCompareIds[slot] || ""}
                    onChange={(event) => setAdminPhotoCompareIds((current) => {
                      const next = [...current];
                      next[slot] = event.target.value;
                      return next;
                    })}
                  >
                    <option value="">Дата для сравнения</option>
                    {adminClientProgressPhotos.map((photo) => (
                      <option key={photo.id} value={photo.id}>
                        {new Date(`${photo.date || photo.createdAt?.slice(0, 10)}T12:00:00`).toLocaleDateString("ru-RU")}
                      </option>
                    ))}
                  </select>
                ))}
              </div>
              <div className="trainerPhotoCompare">
                {selectedPhotoCompare.map((photo, slot) => (
                  <div key={slot}>
                    {photo ? (
                      <>
                        <strong>{new Date(`${photo.date}T12:00:00`).toLocaleDateString("ru-RU")}</strong>
                        <div>
                          {[photo.frontUrl, photo.sideUrl, photo.backUrl].filter(Boolean).map((url) => (
                            <img key={url} src={url} alt="" loading="lazy" />
                          ))}
                        </div>
                        {photo.comment && <small>{photo.comment}</small>}
                      </>
                    ) : <span>Выбери дату</span>}
                  </div>
                ))}
              </div>
            </>
          )}
        </article>

        <article className="trainerWorkspaceCard trainerPaymentCard">
          <div className="trainerWorkspaceHead">
            <div>
              <span>ПРОГРАММА</span>
              <h3>Контроль программы</h3>
            </div>
            <strong className={selectedPaymentAttention.id}>{selectedPaymentAttention.label}</strong>
          </div>
          <div className="trainerPaymentGrid">
            <label><span>Назначена от</span><input type="date" value={adminPaymentDraft.assignedFrom} onChange={(event) => setAdminPaymentDraft((current) => ({ ...current, assignedFrom: event.target.value }))} /></label>
            <label><span>Контроль до</span><input type="date" value={adminPaymentDraft.controlUntil} onChange={(event) => setAdminPaymentDraft((current) => ({ ...current, controlUntil: event.target.value }))} /></label>
            <label><span>Формат</span><input value={adminPaymentDraft.format} onChange={(event) => setAdminPaymentDraft((current) => ({ ...current, format: event.target.value }))} placeholder="Например: персональная · 4 недели" /></label>
            <label><span>Состояние</span><select aria-label="Состояние контроля программы" value={adminPaymentDraft.status} onChange={(event) => setAdminPaymentDraft((current) => ({ ...current, status: event.target.value }))}><option value="active">Активна</option><option value="review">Требует проверки</option><option value="paused">Приостановлена</option></select></label>
            <label className="wide"><span>Комментарий</span><input value={adminPaymentDraft.note} onChange={(event) => setAdminPaymentDraft((current) => ({ ...current, note: event.target.value }))} placeholder="Этап, ограничения или следующий контроль" /></label>
            <button type="button" onClick={saveAdminClientPayment}>Сохранить контроль программы</button>
          </div>
        </article>

        <article className="trainerWorkspaceCard trainerEventsCard">
          <div className="trainerWorkspaceHead">
            <div>
              <span>ИСТОРИЯ РАБОТЫ</span>
              <h3>События клиента</h3>
            </div>
            <strong>{adminClientEvents.length + adminClientHistory.filter((item) => item.clientComment).length}</strong>
          </div>
          <div className="trainerEventList">
            {[
              ...adminClientEvents,
              ...adminClientHistory.filter((item) => item.clientComment).map((item) => ({
                id: `comment_${item.id}`,
                date: item.date,
                title: "Комментарий после тренировки",
                details: item.clientComment
              }))
            ]
              .sort((a, b) => getTrainerSummaryTimestamp(b.date || b.createdAt) - getTrainerSummaryTimestamp(a.date || a.createdAt))
              .slice(0, 12)
              .map((event) => (
                <div key={event.id}>
                  <i>•</i>
                  <span><strong>{event.title}</strong><small>{event.details || "Без комментария"}</small></span>
                  <time>{formatTrainerSummaryDate(event.date || event.createdAt)}</time>
                </div>
              ))}
            {!adminClientEvents.length && !adminClientHistory.some((item) => item.clientComment) && (
              <p className="trainerWorkspaceEmpty">События появятся после задач, программ, фото и комментариев.</p>
            )}
          </div>
        </article>
      </section>

      <div className="adminNutritionMonthPanel adminOverviewNutritionMonthPanel">
        <div className="adminNutritionMonthHead">
          <div>
            <span>MONTH OVERVIEW</span>
            <h3>Календарь активности</h3>
            <p>Месяц по питанию и тренировкам: калории, БЖУ и тренировочные дни клиента.</p>
          </div>
        </div>

        <div className="adminNutritionCalendarLegend">
          <span><i className="calorieOk" /> Калории в плане</span>
          <span><i className="calorieHigh" /> Калорий много</span>
          <span><i className="proteinFill" /> Белок</span>
          <span><i className="carbsFill" /> Углеводы</span>
          <span><i className="fatFill" /> Жиры</span>
          <span><i className="trainingFill" /> Тренировка</span>
        </div>

        <div className="adminNutritionCalendarMonthTitle">
          <strong>{nutritionMonthLabel}</strong>
          <span>Тренировочные дни: {currentMonthTrainingDays}</span>
        </div>

        <div className="adminNutritionMonthGrid">
          {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((dayLabel) => (
            <div key={dayLabel} className="adminNutritionWeekday">{dayLabel}</div>
          ))}

          {nutritionMonthDays.map(({ key, date, day, inMonth, isToday }) => {
            const {
              calories,
              protein,
              caloriePercent,
              proteinPercent,
              fatPercent,
              carbsPercent,
              isHighCalories,
              hasFood
            } = getAdminNutritionDayMetrics(day, {
              calories: dailyCalorieGoal,
              protein: dailyProteinGoal,
              fat: dailyFatGoal,
              carbs: dailyCarbsGoal
            });
            const isTrainingDay = hasAdminWorkoutOnDate(adminClientHistory, key);

            return (
              <div
                key={key}
                className={[
                  "adminNutritionDayCell",
                  inMonth ? "" : "muted",
                  hasFood ? "filled" : "",
                  isTrainingDay ? "trainingDay" : "",
                  isHighCalories ? "highCalories" : "",
                  isToday ? "today" : ""
                ].filter(Boolean).join(" ")}
              >
                <div
                  className="adminNutritionDayCalorieFill"
                  style={{ height: `${hasFood ? Math.max(8, caloriePercent) : 0}%` }}
                />
                <div
                  className="adminNutritionDayProteinFill"
                  style={{ height: `${hasFood ? Math.max(5, proteinPercent) : 0}%` }}
                />
                <div
                  className="adminNutritionDayCarbsFill"
                  style={{ height: `${hasFood ? Math.max(5, carbsPercent) : 0}%` }}
                />
                <div
                  className="adminNutritionDayFatFill"
                  style={{ height: `${hasFood ? Math.max(5, fatPercent) : 0}%` }}
                />
                <div className="adminNutritionDayContent">
                  <span>{date.getDate()}</span>
                  {isTrainingDay && <b className="adminNutritionTrainingMark">⚡️</b>}
                  {hasFood ? (
                    <>
                      <strong>{Math.round(calories)}</strong>
                      <small>{Math.round(protein)}г</small>
                    </>
                  ) : (
                    <em>—</em>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="adminNutritionMonthSummary adminNutritionMonthSummaryBelow">
          <div>
            <span>План</span>
            <strong>{dailyCalorieGoal} ккал</strong>
            <small>{dailyProteinGoal} г</small>
          </div>
          <div>
            <span>Ср. за день</span>
            <strong>{Math.round(nutritionMonthAverageCalories)} ккал</strong>
            <small>{Math.round(nutritionMonthAverageProtein)} г</small>
          </div>
        </div>
      </div>

      <div className="adminProgressDiagramsPanel">
        <div className="adminProgressDiagramsHead">
          <div>
            <span>PROGRESS DIAGRAMS</span>
            <h3>Диаграммы прогресса</h3>
            <p>Тренировки, калории и белок за последние дни.</p>
          </div>
        </div>

        <div className="adminProgressDiagramGrid">
          <div className="adminProgressDiagramCard">
            <span>Силовой прогресс</span>
            <div className="adminProgressBarsChart">
              {workoutProgress.slice(0, 5).map((item) => (
                <div key={item.name}>
                  <small>{item.name}</small>
                  <i><b style={{ width: `${Math.min(100, (item.max / 120) * 100)}%` }} /></i>
                  <strong>{item.max} кг</strong>
                </div>
              ))}
              {!workoutProgress.length && <em>Нет данных по упражнениям</em>}
            </div>
          </div>

          <div className="adminProgressDiagramCard">
            <span>Калории</span>
            <div className="adminProgressMiniColumns">
              {clientNutritionDays.slice(0, 7).reverse().map((day) => (
                <div key={day.date}>
                  <i style={{ height: `${Math.min(100, Math.max(8, ((Number(day.totals.calories) || 0) / dailyCalorieGoal) * 100))}%` }} />
                  <small>{new Date(`${day.date}T12:00:00`).toLocaleDateString("ru-RU", { day: "2-digit" })}</small>
                </div>
              ))}
            </div>
          </div>

          <div className="adminProgressDiagramCard">
            <span>Белок</span>
            <div className="adminProgressMiniColumns adminProgressMiniColumnsProtein">
              {clientNutritionDays.slice(0, 7).reverse().map((day) => (
                <div key={day.date}>
                  <i style={{ height: `${Math.min(100, Math.max(8, ((Number(day.totals.protein) || 0) / dailyProteinGoal) * 100))}%` }} />
                  <small>{new Date(`${day.date}T12:00:00`).toLocaleDateString("ru-RU", { day: "2-digit" })}</small>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="adminClientRecommendations adminClientRecommendationsRender">
        {recommendations.slice(0, 1).map((item) => (
          <div key={item}>
            <span>☆</span>
            <p>{item}</p>
            <button type="button" onClick={() => document.querySelector(".adminClientNotesBlock textarea")?.focus()}>Добавить заметку</button>
          </div>
        ))}
      </div>
    </>
  );
}
