export default function TrainerAdminDangerZone({
  onDeleteClient,
  selectedClient
}) {
  return (
    <div className="adminClientDangerZoneBottom">
      <div>
        <span>DANGER ZONE</span>
        <strong>Удаление клиента</strong>
        <p>Кнопка перенесена вниз, чтобы не мешать работе с программой и календарём.</p>
      </div>
      <button className="danger" type="button" onClick={() => onDeleteClient(selectedClient)}>Удалить клиента</button>
    </div>
  );
}
