export default function ProfileAccountSettingsSection({
  avatarPreview,
  avatarUrl,
  draft,
  saving,
  status,
  onAvatarFile,
  onDraftChange,
  onSendPasswordReset,
  onSave,
  onLogout
}) {
  return (
    <section className="profileDashboardCard profileAccountSection">
      <div className="profileAccountAvatarEditor">
        <div className="profileAccountAvatarPreview">
          {avatarPreview || avatarUrl ? (
            <img src={avatarPreview || avatarUrl} alt="" />
          ) : (
            <span>👤</span>
          )}
        </div>
        <label>
          <strong>Изменить аватар</strong>
          <small>JPG, PNG или WEBP</small>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) => {
              onAvatarFile(event.target.files?.[0] || null);
              event.target.value = "";
            }}
          />
        </label>
      </div>

      <div className="profileAccountFields">
        <label>
          <span>Имя</span>
          <input
            value={draft.displayName}
            onChange={(event) => onDraftChange("displayName", event.target.value)}
            placeholder="Твоё имя"
          />
        </label>
        <label>
          <span>Почта</span>
          <input
            type="email"
            value={draft.email}
            onChange={(event) => onDraftChange("email", event.target.value)}
            placeholder="name@example.com"
          />
        </label>
      </div>

      <button type="button" className="profileAccountPasswordButton" onClick={onSendPasswordReset}>
        <span>🔐</span>
        <span>
          <strong>Изменить пароль</strong>
          <small>Получить безопасную ссылку на почту</small>
        </span>
        <i>›</i>
      </button>

      {status && (
        <p className={status.includes("сохранены") || status.includes("отправлена") ? "profileAccountStatus success" : "profileAccountStatus"}>
          {status}
        </p>
      )}

      <button type="button" className="profileBodySaveBtn" disabled={saving} onClick={onSave}>
        {saving ? "Сохраняю..." : "Сохранить аккаунт"}
      </button>

      <button type="button" className="profileLogoutBtn profileAccountLogout" onClick={onLogout}>
        Выйти из аккаунта
      </button>
    </section>
  );
}
