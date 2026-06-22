export default function FoodProductActionBar({
  hidden,
  canDelete,
  onBack,
  onDelete,
  onEdit,
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
        className="foodProductDeleteAction"
        disabled={!canDelete}
        onClick={onDelete}
      >
        <span aria-hidden="true">⌫</span>
        <strong>Удалить</strong>
      </button>

      <button type="button" onClick={onEdit}>
        <span aria-hidden="true">✎</span>
        <strong>Редактировать</strong>
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
