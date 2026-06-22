import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword
} from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";

import {
  mapLoginAuthError,
  validateLoginFields
} from "../../utils/clientUx";

export function createAuthHandlers({
  APP_PAGES,
  auth,
  db,
  login,
  password,
  loginSubmitting,
  passwordResetSending,
  setLoginFieldErrors,
  setLoginError,
  setLoginNotice,
  setLoginSubmitting,
  setPasswordResetSending,
  setPage,
  setSelectedUserId,
  loadHistory,
  loadWorkoutsFromFirebase
}) {
  async function handleLogin(event) {
    event.preventDefault();
    if (loginSubmitting) return;

    const validation = validateLoginFields(login, password);
    setLoginFieldErrors(validation.errors);
    setLoginError("");
    setLoginNotice("");
    if (!validation.valid) return;

    setLoginSubmitting(true);
    try {
      const result = await signInWithEmailAndPassword(
        auth,
        validation.email,
        validation.password
      );

      setPage(APP_PAGES.MAIN);
      setLoginError("");
      setLoginFieldErrors({});
      setSelectedUserId(null);

      loadHistory();
      loadWorkoutsFromFirebase(result.user.uid);
    } catch (error) {
      setLoginError(mapLoginAuthError(error));
    } finally {
      setLoginSubmitting(false);
    }
  }

  async function handleLoginPasswordReset() {
    if (passwordResetSending) return;

    const validation = validateLoginFields(login, "", { passwordRequired: false });
    setLoginFieldErrors(validation.errors);
    setLoginError("");
    setLoginNotice("");
    if (!validation.valid) return;

    setPasswordResetSending(true);
    try {
      await sendPasswordResetEmail(auth, validation.email);
      setLoginNotice("Если аккаунт существует, ссылка для смены пароля отправлена на почту.");
    } catch (error) {
      setLoginError(
        error?.code === "auth/too-many-requests"
          ? "Слишком много запросов. Попробуй немного позже."
          : error?.code === "auth/network-request-failed"
            ? "Нет связи с сервером. Проверь интернет."
            : "Не удалось отправить ссылку. Попробуй ещё раз."
      );
    } finally {
      setPasswordResetSending(false);
    }
  }

  async function handleRegister() {
    try {
      const result = await createUserWithEmailAndPassword(auth, login, password);

      await setDoc(doc(db, "users", result.user.uid), {
        email: login,
        role: false ? "admin" : "client"
      });

      setLoginError("");
      setPage(APP_PAGES.MAIN);
      setSelectedUserId(null);

      loadHistory();
      loadWorkoutsFromFirebase(result.user.uid);
    } catch (err) {
      console.error(err);

      if (err.code === "auth/email-already-in-use") {
        setLoginError("Этот email уже зарегистрирован");
      } else if (err.code === "auth/invalid-email") {
        setLoginError("Неверный формат email");
      } else if (err.code === "auth/weak-password") {
        setLoginError("Пароль должен быть минимум 6 символов");
      } else {
        setLoginError("Ошибка регистрации");
      }
    }
  }

  return {
    handleLogin,
    handleLoginPasswordReset,
    handleRegister
  };
}
