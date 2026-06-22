export default function TrainerAdminOverviewTab({
  aiWeek,
  getAdminClientGoalLabel,
  getAdminClientTrainingDaysText,
  getAiNutritionActivityLabel,
  maxWeight,
  recommendations,
  selectedProfile,
  weightPoints
}) {
  return (
    <div className="adminV3TabGrid">
      <div className="adminV3ProfileCard">
        <h3>Профиль</h3>
        <div className="adminV3ProfileGrid">
          <div><span>Текущий вес</span><strong>{selectedProfile?.weight || "—"} кг</strong></div>
          <div><span>Рост</span><strong>{selectedProfile?.height || "—"} см</strong></div>
          <div><span>Возраст</span><strong>{selectedProfile?.age || "—"}</strong></div>
          <div><span>Пол</span><strong>{selectedProfile?.sex === "female" ? "Женщина" : selectedProfile?.sex === "male" ? "Мужчина" : "—"}</strong></div>
          <div><span>Твоя цель</span><strong>{getAdminClientGoalLabel(selectedProfile?.goal)}</strong></div>
          <div><span>Активность</span><strong>{getAiNutritionActivityLabel(selectedProfile?.activity || "medium")}</strong></div>
          <div><span>Дни</span><strong>{getAdminClientTrainingDaysText(selectedProfile)}</strong></div>
          <div><span>AI-план</span><strong>{aiWeek ? `${aiWeek.calories} ккал` : "—"}</strong></div>
        </div>
      </div>

      <div className="adminV3ProfileCard">
        <h3>Вес</h3>
        <div className="adminV3MiniChart">
          {weightPoints.length ? weightPoints.map((point, index) => (
            <span key={`${point.date}_${index}`} style={{ height: `${Math.max(12, (point.weight / maxWeight) * 100)}%` }}>
              <em>{point.weight}</em>
            </span>
          )) : <p>нет данных</p>}
        </div>
      </div>

      <div className="adminV3ProfileCard adminV3Wide">
        <h3>AI-рекомендации</h3>
        <div className="adminV3Alerts compact">
          {recommendations.map((item) => (
            <div key={item}><span>✨</span><p>{item}</p></div>
          ))}
        </div>
      </div>
    </div>
  );
}
