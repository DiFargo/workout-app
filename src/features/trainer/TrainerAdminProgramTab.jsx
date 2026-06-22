export default function TrainerAdminProgramTab({
  adminCopyTargetUserId,
  adminSelectedTemplateId,
  adminTemplateName,
  adminTrainingTemplates,
  assignAdminTemplateToClient,
  clearClientProgram,
  copyCurrentProgramToClient,
  createAdminTemplateFromCurrentPlan,
  onOpenDesktopEditor,
  selectedClient,
  setAdminCopyTargetUserId,
  setAdminSelectedTemplateId,
  setAdminTemplateName,
  usersList
}) {
  return (
    <div className="adminV3TabGrid">
      <div className="adminV3ProfileCard adminV3Wide">
        <h3>Шаблоны и программа</h3>
        <div className="adminV3TemplateControls">
          <input value={adminTemplateName} onChange={(event) => setAdminTemplateName(event.target.value)} placeholder="Название шаблона" />
          <button onClick={createAdminTemplateFromCurrentPlan}>Создать из текущей программы</button>
          <select value={adminSelectedTemplateId} onChange={(event) => setAdminSelectedTemplateId(event.target.value)}>
            <option value="">Выбери шаблон</option>
            {adminTrainingTemplates.map((template) => (
              <option key={template.id} value={template.id}>{template.name}</option>
            ))}
          </select>
          <button onClick={() => selectedClient && assignAdminTemplateToClient(selectedClient.id)}>Назначить выбранному</button>
          <button onClick={() => selectedClient && clearClientProgram(selectedClient.id)}>Сбросить программу клиента</button>
          <select value={adminCopyTargetUserId} onChange={(event) => setAdminCopyTargetUserId(event.target.value)}>
            <option value="">Копировать программу клиенту</option>
            {usersList.filter((client) => client.id !== selectedClient?.id).map((client) => (
              <option key={client.id} value={client.id}>{client.name || client.email}</option>
            ))}
          </select>
          <button onClick={copyCurrentProgramToClient}>Копировать</button>
        </div>

        <button className="adminV3OpenEditor" onClick={onOpenDesktopEditor}>
          Открыть desktop-редактор программы
        </button>
      </div>
    </div>
  );
}
