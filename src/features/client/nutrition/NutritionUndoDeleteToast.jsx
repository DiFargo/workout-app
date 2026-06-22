export default function NutritionUndoDeleteToast({
  open,
  onRestore
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="nutritionUndoToast" role="status">
      <span>Продукт удалён</span>
      <button type="button" onClick={onRestore}>Вернуть</button>
    </div>
  );
}
