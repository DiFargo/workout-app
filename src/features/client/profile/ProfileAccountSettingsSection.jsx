import { useEffect, useRef, useState } from "react";
import { AtSign, Camera, LockKeyhole, Pencil } from "lucide-react";

export default function ProfileAccountSettingsSection({
  avatarPreview,
  avatarUrl,
  draft,
  status,
  onAvatarFile,
  onDraftChange,
  onChangeLogin,
  onOpenPassword,
  onSave
}) {
  const [editingField, setEditingField] = useState("");
  const displayNameRef = useRef(null);
  const loginRef = useRef(null);
  const autoSaveTimerRef = useRef(null);
  const draftRef = useRef(draft);
  const editingFieldRef = useRef("");
  const displayName = String(draft.displayName || "").trim() || "Профиль клиента";
  const login = String(draft.login || "").trim();

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  useEffect(() => () => {
    window.clearTimeout(autoSaveTimerRef.current);
  }, []);

  function setActiveEditingField(field) {
    editingFieldRef.current = field;
    setEditingField(field);
  }

  function getFieldRef() {
    return editingFieldRef.current === "login" ? loginRef : displayNameRef;
  }

  function focusField(field) {
    const ref = getFieldRef(field);
    window.setTimeout(() => {
      ref.current?.focus();
      ref.current?.select?.();
    }, 0);
  }

  function saveFieldSnapshot(field, value, { exit = true } = {}) {
    window.clearTimeout(autoSaveTimerRef.current);
    const normalizedValue = field === "login" ? String(value || "").trim().toLowerCase() : value;
    const nextDraft = { ...draftRef.current, [field]: normalizedValue };
    draftRef.current = nextDraft;
    onDraftChange(field, normalizedValue);
    if (field === "login") {
      onChangeLogin?.(normalizedValue);
    } else {
      onSave(nextDraft, { closeOnSuccess: false });
    }
    if (exit) {
      setActiveEditingField("");
      getFieldRef(field).current?.blur?.();
    }
  }

  function finishActiveEdit({ exit = true } = {}) {
    const field = editingFieldRef.current;
    if (!field) return;
    const ref = getFieldRef(field);
    const value = ref.current?.value ?? draftRef.current[field] ?? "";
    saveFieldSnapshot(field, value, { exit });
  }

  function startEdit(field) {
    if (editingFieldRef.current && editingFieldRef.current !== field) {
      finishActiveEdit({ exit: false });
    }
    setActiveEditingField(field);
    focusField(field);
  }

  function scheduleAutoSave(nextDraft) {
    window.clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = window.setTimeout(() => {
      onSave(nextDraft, { closeOnSuccess: false });
    }, 650);
  }

  function commitField(field, value) {
    if (editingFieldRef.current !== field) return;
    saveFieldSnapshot(field, value, { exit: true });
  }

  function changeField(field, value) {
    const nextDraft = { ...draftRef.current, [field]: value };
    draftRef.current = nextDraft;
    onDraftChange(field, value);
    if (field !== "login") {
      scheduleAutoSave(nextDraft);
    }
  }

  function handleFieldKeyDown(event, field) {
    if (event.key === "Enter") {
      event.preventDefault();
      commitField(field, event.currentTarget.value);
    }
    if (event.key === "Escape") {
      event.preventDefault();
      setActiveEditingField("");
      event.currentTarget.blur();
    }
  }

  function openPasswordModal() {
    finishActiveEdit({ exit: true });
    onOpenPassword?.();
  }

  return (
    <section className="profileAccountSection profileAccountSummarySection">
      <div className="profileAccountIdentity profileAccountHeroCard">
        <label className="profileAccountAvatarCenterAction" aria-label="Изменить аватар">
          <span className="profileAccountAvatarPreview profileAccountAvatarPreviewLarge">
            {avatarPreview || avatarUrl ? (
              <img src={avatarPreview || avatarUrl} alt="" />
            ) : (
              <span>👤</span>
            )}
          </span>
          <span className="profileAccountAvatarCamera" aria-hidden="true">
            <Camera size={13} strokeWidth={2.4} />
          </span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) => {
              onAvatarFile(event.target.files?.[0] || null);
              event.target.value = "";
            }}
          />
        </label>
        <div className={editingField === "displayName" ? "profileAccountHeroNameRow editing" : "profileAccountHeroNameRow"}>
          <input
            ref={displayNameRef}
            readOnly={editingField !== "displayName"}
            value={draft.displayName}
            onChange={(event) => changeField("displayName", event.target.value)}
            onBlur={(event) => {
              if (editingFieldRef.current === "displayName") {
                commitField("displayName", event.target.value);
              }
            }}
            onKeyDown={(event) => handleFieldKeyDown(event, "displayName")}
            placeholder={displayName}
          />
          <button type="button" className="profileAccountHeroNameEdit" aria-label="Редактировать ник" onMouseDown={(event) => event.preventDefault()} onClick={() => startEdit("displayName")}>
            <Pencil size={14} strokeWidth={2.2} />
          </button>
        </div>
      </div>

      <section className="profileDashboardCard profileAccountQuickPanel profileAccountDataPanel profileAccountSecurityPanel">
        <div
          className={editingField === "login" ? "profileAccountQuickRow profileAccountLoginRow editing" : "profileAccountQuickRow profileAccountLoginRow"}
          onClick={() => {
            if (editingFieldRef.current !== "login") {
              startEdit("login");
            }
          }}
        >
          <span className="profileAccountQuickIcon" aria-hidden="true">
            <AtSign size={15} strokeWidth={2.2} />
          </span>
          <span className="profileAccountQuickTitle">Логин</span>
          <input
            ref={loginRef}
            readOnly={editingField !== "login"}
            value={login}
            onChange={(event) => changeField("login", event.target.value.toLowerCase())}
            onBlur={(event) => {
              if (editingFieldRef.current === "login") {
                commitField("login", event.target.value);
              }
            }}
            onKeyDown={(event) => handleFieldKeyDown(event, "login")}
            placeholder="login"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck="false"
          />
          <button type="button" className="profileAccountQuickEdit" aria-label="Редактировать логин" onMouseDown={(event) => event.preventDefault()} onClick={() => startEdit("login")}>
            <Pencil size={15} strokeWidth={2.2} />
          </button>
        </div>

        <button type="button" className="profileAccountQuickRow profileAccountQuickButton" onMouseDown={(event) => event.preventDefault()} onClick={openPasswordModal}>
          <span className="profileAccountQuickIcon" aria-hidden="true">
            <LockKeyhole size={15} strokeWidth={2.2} />
          </span>
          <span className="profileAccountQuickTitle">Пароль</span>
          <span className="profileAccountQuickValue">Изменить</span>
          <span className="profileAccountQuickEdit" aria-hidden="true">
            <Pencil size={15} strokeWidth={2.2} />
          </span>
        </button>
      </section>

      {status && (
        <p className={status.includes("сохранены") || status.includes("отправлена") ? "profileAccountStatus success" : "profileAccountStatus"}>
          {status}
        </p>
      )}
    </section>
  );
}
