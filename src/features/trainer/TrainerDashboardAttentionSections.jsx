export default function TrainerDashboardAttentionSections({
  formatTrainerSummaryDate,
  loadAdminClientOverview,
  trainerAiFocusItems,
  trainerClientSummariesLoading,
  trainerProblemClients,
  trainerRecentEvents,
  trainerStatusCounts
}) {
  return (
    <>
      <section className="trainerAttentionPanel">
        <div className="trainerAttentionHeader">
          <div>
            <span>Контроль клиентов</span>
            <h2>Центр внимания тренера</h2>
          </div>
          {trainerClientSummariesLoading && <small>Обновляю данные...</small>}
        </div>

        <div className="trainerAttentionGrid">
          <article className="trainerAttentionCard lost">
            <span className="trainerAttentionIcon" aria-hidden="true">●</span>
            <span>Пропали</span>
            <strong>{trainerStatusCounts.lost}</strong>
          </article>
          <article className="trainerAttentionCard attention">
            <span className="trainerAttentionIcon" aria-hidden="true">●</span>
            <span>Требуют внимания</span>
            <strong>{trainerStatusCounts.attention}</strong>
          </article>
          <article className="trainerAttentionCard noProgram">
            <span className="trainerAttentionIcon" aria-hidden="true">●</span>
            <span>Без программы</span>
            <strong>{trainerStatusCounts.noProgram}</strong>
          </article>
          <article className="trainerAttentionCard active">
            <span className="trainerAttentionIcon" aria-hidden="true">●</span>
            <span>Тренировались сегодня</span>
            <strong>{trainerStatusCounts.activeToday}</strong>
          </article>
          <article className="trainerAttentionCard plateau">
            <span className="trainerAttentionIcon" aria-hidden="true">●</span>
            <span>Нет прогресса 14 дней</span>
            <strong>{trainerStatusCounts.plateau}</strong>
          </article>
          <article className="trainerAttentionCard payment">
            <span className="trainerAttentionIcon" aria-hidden="true">●</span>
            <span>Контроль программы</span>
            <strong>{trainerStatusCounts.payment}</strong>
          </article>
        </div>

        <div className="trainerClientReasonList">
          {trainerProblemClients.map(({ client, status, reasons }) => (
            <button type="button" key={client.id} onClick={() => loadAdminClientOverview(client, true)}>
              <span className={`trainerClientStatusBadge ${status.id}`}>{status.label}</span>
              <strong>{client.name || client.email || "Клиент"}</strong>
              <small>{reasons.slice(0, 2).join(" · ")}</small>
            </button>
          ))}
          {!trainerClientSummariesLoading && !trainerProblemClients.length && (
            <div className="trainerClientReasonEmpty">Сейчас все клиенты активны, критичных сигналов нет.</div>
          )}
        </div>
      </section>

      <div className="adminDashboardSection">
        <div className="adminDashboardSectionTitle"><span aria-hidden="true">✦</span>AI Focus</div>

        <div className="adminDashboardAiList">
          {trainerAiFocusItems.map((item) => (
            <button
              className="adminDashboardMiniItem adminDashboardAiCard"
              type="button"
              key={item.id}
              onClick={() => loadAdminClientOverview(item.client, true)}
            >
              <span className="adminDashboardMiniTop">
                <strong className="adminDashboardMiniName">{item.clientName}</strong>
                <span className={`trainerClientStatusBadge ${item.status.id}`}>{item.status.label}</span>
              </span>
              <span className="adminDashboardMiniDesc">{item.text}</span>
            </button>
          ))}
          {!trainerClientSummariesLoading && !trainerAiFocusItems.length && (
            <div className="adminDashboardTimelineItem">Данных для рекомендаций пока нет.</div>
          )}
        </div>
      </div>

      <div className="adminDashboardSection">
        <div className="adminDashboardSectionTitle"><span aria-hidden="true">◷</span>Последние события</div>

        <div className="adminDashboardTimeline">
          {trainerRecentEvents.map((event) => (
            <button
              type="button"
              className="adminDashboardTimelineItem adminDashboardTimelineButton"
              key={`${event.client.id}_${event.id}`}
              onClick={() => loadAdminClientOverview(event.client, true)}
            >
              <span aria-hidden="true">{event.type === "workout" ? "✓" : event.type === "nutrition" ? "🍽" : "📏"}</span>
              <strong>{event.clientName}</strong>
              <span>{event.title}</span>
              <time>{formatTrainerSummaryDate(event.date)}</time>
            </button>
          ))}
          {!trainerClientSummariesLoading && !trainerRecentEvents.length && (
            <div className="adminDashboardTimelineItem">
              Событий по клиентам пока нет.
            </div>
          )}
          {trainerClientSummariesLoading && (
            <div className="adminDashboardTimelineItem">Загружаю события клиентов...</div>
          )}
        </div>
      </div>
    </>
  );
}
