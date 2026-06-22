export default function TrainerAdminNutritionTab({
  clientNutritionDays,
  getFoodIcon,
  maxCalories,
  maxProtein
}) {
  return (
    <div className="adminV3TabGrid">
      <div className="adminV3ProfileCard">
        <h3>Калории</h3>
        <div className="adminV3MiniChart">
          {clientNutritionDays.slice(0, 7).reverse().map((day) => (
            <span key={day.date} style={{ height: `${Math.max(10, (day.totals.calories / maxCalories) * 100)}%` }}>
              <em>{Math.round(day.totals.calories)}</em>
            </span>
          ))}
        </div>
      </div>

      <div className="adminV3ProfileCard">
        <h3>Белок</h3>
        <div className="adminV3MiniChart">
          {clientNutritionDays.slice(0, 7).reverse().map((day) => (
            <span key={day.date} style={{ height: `${Math.max(10, (day.totals.protein / maxProtein) * 100)}%` }}>
              <em>{Math.round(day.totals.protein)}</em>
            </span>
          ))}
        </div>
      </div>

      <div className="adminV3ProfileCard adminV3Wide">
        <h3>Дни питания</h3>
        <div className="adminV3NutritionList">
          {clientNutritionDays.slice(0, 8).map((day) => (
            <details key={day.date}>
              <summary>
                <strong>{new Date(day.date).toLocaleDateString("ru-RU")}</strong>
                <span>{Math.round(day.totals.calories)} ккал · Б {Math.round(day.totals.protein)} · score {day.score}</span>
              </summary>
              <div>
                {day.foods.map((food, index) => (
                  <p key={`${food.id || food.name}_${index}`}>
                    <span>{food.icon || getFoodIcon(food)} {food.name}</span>
                    <strong>{Math.round(Number(food.calories) || 0)} ккал</strong>
                  </p>
                ))}
                {!day.foods.length && <p>Еды нет</p>}
              </div>
            </details>
          ))}
          {!clientNutritionDays.length && <p className="adminV3Empty">Питания пока нет.</p>}
        </div>
      </div>
    </div>
  );
}
