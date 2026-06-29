export default function TrainerClientCalendarNutritionTab({
  adminCalendarDays,
  adminCalendarDraft,
  adminCalendarSaving,
  adminCalendarTesting,
  currentMonthTrainingDays,
  getAdminCalendarDayIdFromDate,
  getClientTelegramProfile,
  nutritionMonthDays,
  nutritionMonthLabel,
  saveAdminClientCalendar,
  selectedClient,
  sendAdminTestWorkoutReminder,
  setAdminCalendarDraft,
  toggleAdminCalendarDay,
  updateAdminCalendarDaySetting
}) {
  return (
    <div className="adminClientTabContent adminClientNutritionCalendarContent">
      <div className="adminTrainingMonthPanel">
        <div className="adminTrainingMonthHead">
          <div>
            <span>TRAINING CALENDAR</span>
            <h3>Календарь тренировок</h3>
            <p>Только тренировочные дни без молний, калорий, белка и питания.</p>
          </div>
        </div>

        <div className="adminTrainingMonthTitle">
          <strong>{nutritionMonthLabel}</strong>
          <span>Тренировочные дни: {currentMonthTrainingDays}</span>
        </div>

        <div className="adminTrainingMonthGrid">
          {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((day) => (
            <div key={day} className="adminTrainingWeekday">{day}</div>
          ))}

          {nutritionMonthDays.map(({ key, date, inMonth, isToday }) => {
            const isTrainingDay = adminCalendarDraft.trainingDays?.includes(getAdminCalendarDayIdFromDate(date));

            return (
              <div
                key={key}
                className={[
                  "adminTrainingDayCell",
                  inMonth ? "" : "muted",
                  isTrainingDay ? "trainingDay" : "",
                  isToday ? "today" : ""
                ].filter(Boolean).join(" ")}
              >
                <span>{date.getDate()}</span>
                {isTrainingDay && <i>тренировка</i>}
              </div>
            );
          })}
        </div>
      </div>

      <div className="adminCalendarPanel adminCalendarPanelMerged">
        <div className="adminCalendarHead">
          <div>
            <span>TRAINING REMINDERS</span>
            <h3>Напоминания</h3>
          </div>
          <div className={getClientTelegramProfile(selectedClient).connected ? "adminCalendarTelegram connected" : "adminCalendarTelegram"}>
            Telegram
          </div>
        </div>

        <div className="adminCalendarDays">
          {adminCalendarDays.map((day) => (
            <button
              key={day.id}
              type="button"
              className={adminCalendarDraft.trainingDays?.includes(day.id) ? "active" : ""}
              aria-pressed={adminCalendarDraft.trainingDays?.includes(day.id)}
              onClick={() => toggleAdminCalendarDay(day.id)}
            >
              <strong>{day.title}</strong>
              <span>{day.full}</span>
            </button>
          ))}
        </div>

        <div className="adminCalendarSettingsGrid adminCalendarPerDaySettings">
          {(adminCalendarDraft.trainingDays || []).length ? (
            (adminCalendarDraft.trainingDays || []).map((dayId) => {
              const day = adminCalendarDays.find((item) => item.id === dayId);
              const daySettings = adminCalendarDraft.daySettings?.[dayId] || {};

              return (
                <div className="adminCalendarDaySettingsRow" key={dayId}>
                  <div className="adminCalendarDaySettingsTitle">{day?.title || dayId}</div>

                  <div className="adminCalendarDayTimeGrid">
                    <label className="adminCalendarWorkoutTimeField">
                      <span>Время тренировки</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="13:00"
                        maxLength={5}
                        className="adminReminderTimeInput adminReminderTimeManualInput"
                        value={daySettings.workoutTime || adminCalendarDraft.workoutTime || "13:00"}
                        onChange={(event) => {
                          let value = event.target.value.replace(/[^0-9:]/g, "");

                          if (value.length === 2 && !value.includes(":")) {
                            value = `${value}:`;
                          }

                          updateAdminCalendarDaySetting(dayId, "workoutTime", value);
                        }}
                      />
                    </label>

                    <label className="adminCalendarReminderBeforeField">
                      <span>Напомнить за</span>
                      <select
                        className="adminReminderBeforeSelect"
                        value={daySettings.reminderBefore || daySettings.reminderTime || "1 день"}
                        onChange={(event) => updateAdminCalendarDaySetting(dayId, "reminderBefore", event.target.value)}
                      >
                        <option value="1 день">1 день</option>
                        <option value="2 дня">2 дня</option>
                      </select>
                    </label>
                  </div>

                  <button
                    type="button"
                    className={daySettings.hourReminderEnabled === true ? "adminCalendarHourReminder active" : "adminCalendarHourReminder"}
                    aria-pressed={daySettings.hourReminderEnabled === true}
                    onClick={() => updateAdminCalendarDaySetting(dayId, "hourReminderEnabled", daySettings.hourReminderEnabled !== true)}
                  >
                    <span>Напомнить за час</span>
                    <i aria-hidden="true"></i>
                  </button>
                </div>
              );
            })
          ) : (
            <div className="adminCalendarNoDaysHint">Выбери дни тренировок выше</div>
          )}
        </div>

        <div className="adminCalendarToggles">
          <button
            type="button"
            className={adminCalendarDraft.enabled !== false ? "active" : ""}
            aria-pressed={adminCalendarDraft.enabled !== false}
            onClick={() => setAdminCalendarDraft((prev) => ({ ...prev, enabled: prev.enabled === false }))}
          >
            {adminCalendarDraft.enabled !== false ? "Напоминания вкл" : "Напоминания выкл"}
          </button>

          <button
            type="button"
            className={adminCalendarDraft.reminderEnabled !== false ? "active" : ""}
            aria-pressed={adminCalendarDraft.reminderEnabled !== false}
            onClick={() => setAdminCalendarDraft((prev) => ({ ...prev, reminderEnabled: prev.reminderEnabled === false }))}
          >
            {adminCalendarDraft.reminderEnabled !== false ? "" : ""}
          </button>
        </div>
        <button
          className="adminV3OpenEditor"
          type="button"
          disabled={adminCalendarSaving}
          onClick={() => saveAdminClientCalendar(selectedClient)}
        >
          {adminCalendarSaving ? "Сохраняю..." : "Сохранить расписание"}
        </button>

        <button
          type="button"
          className="adminCalendarTestButton"
          disabled={adminCalendarTesting}
          onClick={() => sendAdminTestWorkoutReminder(selectedClient)}
        >
          {adminCalendarTesting ? "Отправляю..." : "Тестовое сообщение"}
        </button>
      </div>
    </div>
  );
}
