export default function TrainerAdminCalendarTab({
  adminCalendarDays,
  adminCalendarDraft,
  adminCalendarSaving,
  adminCalendarTesting,
  getClientTelegramProfile,
  saveAdminClientCalendar,
  selectedClient,
  sendAdminTestWorkoutReminder,
  setAdminCalendarDraft,
  toggleAdminCalendarDay,
  updateAdminCalendarDaySetting
}) {
  return (
    <div className="adminClientTabContent">
      <div className="adminCalendarPanel">
        <div className="adminCalendarHead">
          <div>
            <span>TRAINING CALENDAR</span>
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
              onClick={() => toggleAdminCalendarDay(day.id)}
            >
              <strong>{day.title}</strong>
              <span>{day.full}</span>
            </button>
          ))}
        </div>

        <p className="adminCalendarDaysHintText">
          Настройте время тренировок и напоминания<br />для выбранных дней
        </p>

        <div className="adminCalendarSettingsGrid adminCalendarPerDaySettings">
          {(adminCalendarDraft.trainingDays || []).length ? (
            (adminCalendarDraft.trainingDays || []).map((dayId) => {
              const day = adminCalendarDays.find((item) => item.id === dayId);
              const daySettings = adminCalendarDraft.daySettings?.[dayId] || {};

              return (
                <div className="adminCalendarDaySettingsRow" key={dayId}>
                  <div className="adminCalendarDaySettingsHeader">
                    <div className="adminCalendarDaySettingsTitle">
                      {day?.title || dayId}
                    </div>
                    <div className="adminCalendarDaySettingsName">
                      {day?.full || dayId}
                    </div>
                  </div>

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

        <div className="adminCalendarToggles adminCalendarEqualButtonsWrap">
          <button
            type="button"
            className={adminCalendarDraft.enabled !== false ? "adminCalendarEqualButton adminCalendarReminderButton active" : "adminCalendarEqualButton adminCalendarReminderButton"}
            onClick={() => setAdminCalendarDraft((prev) => ({ ...prev, enabled: prev.enabled === false }))}
          >
            {adminCalendarDraft.enabled !== false ? "Напоминания вкл" : "Напоминания выкл"}
          </button>

          <button
            type="button"
            className={adminCalendarDraft.reminderEnabled !== false ? "active" : ""}
            onClick={() => setAdminCalendarDraft((prev) => ({ ...prev, reminderEnabled: prev.reminderEnabled === false }))}
          >
            {adminCalendarDraft.reminderEnabled !== false ? "" : ""}
          </button>
        </div>

        <div className="adminCalendarPreview">
          <span></span>
          <p>Завтра тренировка в {adminCalendarDraft.workoutTime || "13:00"} — следующая тренировка клиента.</p>
        </div>

        <button
          className="adminV3OpenEditor adminCalendarEqualButton adminCalendarSaveButton"
          disabled={adminCalendarSaving}
          onClick={() => saveAdminClientCalendar(selectedClient)}
        >
          {adminCalendarSaving ? "Сохраняю..." : "Сохранить расписание"}
        </button>

        <button
          type="button"
          className="adminCalendarTestButton adminCalendarEqualButton"
          disabled={adminCalendarTesting}
          onClick={() => sendAdminTestWorkoutReminder(selectedClient)}
        >
          {adminCalendarTesting ? "Отправляю..." : "Тестовое сообщение"}
        </button>
      </div>
    </div>
  );
}
