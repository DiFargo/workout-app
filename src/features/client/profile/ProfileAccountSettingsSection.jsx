import { useEffect, useRef, useState } from "react";
import { AtSign, Camera, LockKeyhole, Pencil, UserRound } from "lucide-react";
import styles from "./ProfileAccountSettingsSection.module.css";
import { MAX_USER_DISPLAY_NAME_LENGTH } from "../../../utils/userDisplayName.js";

const MAX_DISPLAY_NAME_LENGTH = MAX_USER_DISPLAY_NAME_LENGTH;

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
  const statusText = String(status || "");
  const statusIsSuccess = statusText.includes("сохранены") || statusText.includes("отправлена");

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
    const normalizedValue = field === "login"
      ? String(value || "").trim().toLowerCase()
      : String(value || "").slice(0, MAX_DISPLAY_NAME_LENGTH);
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
    const nextValue = field === "displayName"
      ? String(value || "").slice(0, MAX_DISPLAY_NAME_LENGTH)
      : value;
    const nextDraft = { ...draftRef.current, [field]: nextValue };
    draftRef.current = nextDraft;
    onDraftChange(field, nextValue);
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
    <section
      className={styles.section}
      data-testid="profile-account-section"
      data-css-module-scope="profile-account-settings"
    >
      <div className={styles.identity} data-testid="profile-account-identity">
        <label className={styles.avatarAction} data-testid="profile-account-avatar" aria-label="Изменить аватар">
          <span className={styles.avatar}>
            {avatarPreview || avatarUrl ? (
              <img src={avatarPreview || avatarUrl} alt="" />
            ) : (
              <span aria-hidden="true"><UserRound size={34} strokeWidth={1.8} /></span>
            )}
          </span>
          <span className={styles.camera} aria-hidden="true">
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
        <div className={`${styles.nameRow}${editingField === "displayName" ? ` ${styles.editing}` : ""}`}>
          <input
            className={styles.nameInput}
            ref={displayNameRef}
            readOnly={editingField !== "displayName"}
            value={draft.displayName || ""}
            maxLength={MAX_DISPLAY_NAME_LENGTH}
            onChange={(event) => changeField("displayName", event.target.value)}
            onBlur={(event) => {
              if (editingFieldRef.current === "displayName") {
                commitField("displayName", event.target.value);
              }
            }}
            onKeyDown={(event) => handleFieldKeyDown(event, "displayName")}
            placeholder={displayName}
          />
          <button type="button" className={styles.nameEdit} data-testid="profile-account-name-edit" aria-label="Редактировать ник" onMouseDown={(event) => event.preventDefault()} onClick={() => startEdit("displayName")}>
            <Pencil size={14} strokeWidth={2.2} />
          </button>
        </div>
      </div>

      <section className={styles.quickPanel} data-testid="profile-account-quick-panel">
        <div
          className={`${styles.quickRow} ${styles.loginRow}${editingField === "login" ? ` ${styles.editing}` : ""}`}
          data-testid="profile-account-login-row"
          onClick={() => {
            if (editingFieldRef.current !== "login") {
              startEdit("login");
            }
          }}
        >
          <span className={styles.quickIcon} aria-hidden="true">
            <AtSign size={15} strokeWidth={2.2} />
          </span>
          <span className={styles.quickTitle}>Логин</span>
          <input
            className={styles.quickInput}
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
          <button type="button" className={styles.quickEdit} data-testid="profile-account-login-edit" aria-label="Редактировать логин" onMouseDown={(event) => event.preventDefault()} onClick={() => startEdit("login")}>
            <Pencil size={15} strokeWidth={2.2} />
          </button>
        </div>

        <button type="button" className={`${styles.quickRow} ${styles.quickButton}`} data-testid="profile-account-password" onMouseDown={(event) => event.preventDefault()} onClick={openPasswordModal}>
          <span className={styles.quickIcon} aria-hidden="true">
            <LockKeyhole size={15} strokeWidth={2.2} />
          </span>
          <span className={styles.quickTitle}>Пароль</span>
          <span className={styles.quickValue}>Изменить</span>
          <span className={styles.quickEdit} aria-hidden="true">
            <Pencil size={15} strokeWidth={2.2} />
          </span>
        </button>
      </section>

      {statusText && (
        <p className={`${styles.status}${statusIsSuccess ? ` ${styles.success}` : ""}`} data-testid="profile-account-status">
          {statusText}
        </p>
      )}
    </section>
  );
}
