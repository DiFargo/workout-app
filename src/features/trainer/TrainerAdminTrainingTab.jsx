export default function TrainerAdminTrainingTab({ workoutProgress }) {
  return (
    <div className="adminV3TabGrid">
      <div className="adminV3ProfileCard adminV3Wide">
        <h3>Прогресс упражнений</h3>
        <div className="adminV3ExerciseProgress">
          {workoutProgress.map((item) => (
            <div key={item.name}>
              <span>{item.name}</span>
              <strong>{item.max} кг</strong>
              <i style={{ width: `${Math.min(100, (item.max / 120) * 100)}%` }} />
            </div>
          ))}
          {!workoutProgress.length && <p className="adminV3Empty">Нет данных</p>}
        </div>
      </div>
    </div>
  );
}
