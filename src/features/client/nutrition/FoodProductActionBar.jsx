export default function FoodProductActionBar({
  hidden,
  onBack,
  onAdd
}) {
  if (hidden) {
    return null;
  }

  return (
    <nav className="foodProductActionBar" aria-label="Действия с продуктом">
      <button type="button" onClick={onBack}>
        <span aria-hidden="true">←</span>
        <strong>Назад к поиску</strong>
      </button>

      <button
        type="button"
        className="foodProductAddAction"
        onClick={onAdd}
      >
        <span aria-hidden="true">✓</span>
        <strong>Добавить</strong>
      </button>
    </nav>
  );
}
