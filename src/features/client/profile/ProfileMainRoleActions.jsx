export default function ProfileMainRoleActions({
  showTrainer,
  showAdmin,
  onOpenTrainer,
  onOpenAdmin
}) {
  if (!showTrainer && !showAdmin) {
    return null;
  }

  return (
    <div className="mainDashboardRoleActions">
      {showTrainer && (
        <button type="button" onClick={onOpenTrainer}>
          ⚙️ Тренерская
        </button>
      )}
      {showAdmin && (
        <button type="button" onClick={onOpenAdmin}>
          🛠️ Админ-панель
        </button>
      )}
    </div>
  );
}
