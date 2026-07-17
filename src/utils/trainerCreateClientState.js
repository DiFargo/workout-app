export function buildTrainerCreateClientState(values = {}, handlers = {}) {
  return {
    open: Boolean(values.open),
    name: values.name || "",
    login: values.login || values.email || "",
    password: values.password || "",
    loading: Boolean(values.loading),
    status: values.status || null,
    credentials: values.credentials || null,
    onClose: handlers.onClose,
    onNameChange: handlers.onNameChange,
    onLoginChange: handlers.onLoginChange || handlers.onEmailChange,
    onOpen: handlers.onOpen,
    onPasswordChange: handlers.onPasswordChange,
    onGeneratePassword: handlers.onGeneratePassword,
    onSubmit: handlers.onSubmit
  };
}
