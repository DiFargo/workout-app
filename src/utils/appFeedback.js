function getAppErrorPreset(type = "api") {
  const presets = {
    offline: {
      title: "Нет интернета",
      text: "Проверь подключение. Данные останутся локально."
    },
    firebase: {
      title: "Firebase временно недоступен",
      text: "Изменения сохранены локально и не потеряются."
    },
    api: {
      title: "Сервер временно недоступен",
      text: "Попробуй ещё раз через несколько секунд."
    },
    timeout: {
      title: "Слишком долго",
      text: "Сервер отвечает дольше обычного. Попробуй позже."
    },
    validation: {
      title: "Нужно заполнить подход",
      text: "Проверь введённые данные и попробуй снова."
    },
    savedLocal: {
      title: "Сохранено локально",
      text: "Данные не потеряются и синхронизируются позже."
    },
    load: {
      title: "Не удалось загрузить данные",
      text: "Проверь интернет или попробуй обновить страницу."
    }
  };

  return presets[type] || presets.api;
}

export function showAppError(type = "api", customText = "") {
  if (typeof document === "undefined") return;

  const preset = getAppErrorPreset(type);
  const existing = document.querySelector(".appErrorToast");
  if (existing) existing.remove();

  const toast = document.createElement("div");
  toast.className = `appErrorToast appErrorToast--${type}`;

  const title = document.createElement("div");
  title.className = "appErrorToastTitle";
  title.textContent = preset.title;

  const text = document.createElement("div");
  text.className = "appErrorToastText";
  text.textContent = customText || preset.text;

  toast.append(title, text);

  document.body.appendChild(toast);

  window.clearTimeout(window.__workoutAppErrorToastTimer);
  window.__workoutAppErrorToastTimer = window.setTimeout(() => {
    toast.classList.add("appErrorToastOut");
    window.setTimeout(() => toast.remove(), 220);
  }, 4200);
}

export function showAppConfirm(messageOrOptions = "", maybeOptions = {}) {
  if (typeof document === "undefined") return Promise.resolve(false);

  const options = typeof messageOrOptions === "object" && messageOrOptions !== null
    ? messageOrOptions
    : { ...maybeOptions, text: String(messageOrOptions || "") };
  const titleText = options.title || "Подтвердить действие";
  const bodyText = options.text || options.message || "";
  const confirmText = options.confirmText || "Подтвердить";
  const cancelText = options.cancelText || "Отмена";
  const danger = Boolean(options.danger || /удал|сброс/i.test(bodyText));

  const existing = document.querySelector(".appConfirmOverlay");
  if (existing) existing.remove();

  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "appConfirmOverlay";

    const dialog = document.createElement("div");
    dialog.className = "appConfirmDialog";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-label", titleText);

    const title = document.createElement("div");
    title.className = "appConfirmTitle";
    title.textContent = titleText;

    const text = document.createElement("div");
    text.className = "appConfirmText";
    text.textContent = bodyText;

    const actions = document.createElement("div");
    actions.className = "appConfirmActions";

    const cancelButton = document.createElement("button");
    cancelButton.type = "button";
    cancelButton.className = "appConfirmButton appConfirmButtonGhost";
    cancelButton.textContent = cancelText;

    const confirmButton = document.createElement("button");
    confirmButton.type = "button";
    confirmButton.className = `appConfirmButton appConfirmButtonPrimary${danger ? " danger" : ""}`;
    confirmButton.textContent = confirmText;

    let resolved = false;
    const close = (value) => {
      if (resolved) return;
      resolved = true;
      document.removeEventListener("keydown", handleKeyDown);
      overlay.remove();
      resolve(value);
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") close(false);
    };

    cancelButton.addEventListener("click", () => close(false));
    confirmButton.addEventListener("click", () => close(true));
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) close(false);
    });
    document.addEventListener("keydown", handleKeyDown);

    actions.append(cancelButton, confirmButton);
    dialog.append(title, text, actions);
    overlay.append(dialog);
    document.body.appendChild(overlay);
    cancelButton.focus({ preventScroll: true });
  });
}
