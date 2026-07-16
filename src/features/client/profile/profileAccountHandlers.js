import {
  EmailAuthProvider,
  GoogleAuthProvider,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  sendPasswordResetEmail,
  updatePassword,
  updateProfile
} from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import {
  getDownloadURL,
  ref,
  uploadBytes
} from "firebase/storage";
import { fetchAuthorizedWithTimeout } from "../../../utils/apiClient";
import { getDefaultLoginAlias } from "../../../utils/clientUx";

const googleReauthProvider = new GoogleAuthProvider();
const PROFILE_UPDATE_EMAIL_FUNCTION_URL = "https://europe-west1-tren-85720.cloudfunctions.net/profileUpdateEmail";
const PROFILE_UPDATE_LOGIN_FUNCTION_URL = "https://europe-west1-tren-85720.cloudfunctions.net/profileUpdateLogin";

function getProfileUpdateEmailEndpoint() {
  const hostname = typeof window !== "undefined" ? window.location.hostname : "";
  return hostname === "127.0.0.1" || hostname === "localhost"
    ? PROFILE_UPDATE_EMAIL_FUNCTION_URL
    : "/api/profile/update-email";
}

function getProfileUpdateLoginEndpoint() {
  const hostname = typeof window !== "undefined" ? window.location.hostname : "";
  return hostname === "127.0.0.1" || hostname === "localhost"
    ? PROFILE_UPDATE_LOGIN_FUNCTION_URL
    : "/api/profile/update-login";
}
export function createProfileAccountHandlers({
  APP_THEMES,
  auth,
  appTheme,
  db,
  storage,
  profileAccount,
  profileAccountDraft,
  profileAccountAvatarFile,
  profileAccountSaving,
  profileAvatarCropSource,
  profileAvatarCropZoom,
  profileAvatarCropOffset,
  profileAvatarCropSize,
  profileAvatarCropImageRef,
  profileAvatarCropDragRef,
  profileSettingsModalBodyRef,
  setAppTheme,
  setProfileAccount,
  setProfileAccountDraft,
  setProfileAccountAvatarFile,
  setProfileAccountAvatarPreview,
  setProfileAccountStatus,
  setProfileAccountSaving,
  setProfileSettingsModalSection,
  setProfileSettingsModalOpen,
  setProfileAvatarCropSource,
  setProfileAvatarCropZoom,
  setProfileAvatarCropOffset,
  setProfileAvatarCropSize,
  setProfileAvatarCropOpen
}) {
  function refreshPage() {
    window.location.reload();
  }

  function toggleAppTheme() {
    const nextTheme = appTheme === APP_THEMES.WARM_LIGHT ? APP_THEMES.DARK_GREEN : APP_THEMES.WARM_LIGHT;
    setAppTheme(nextTheme);

    const uid = auth.currentUser?.uid;
    if (!uid) return;

    setDoc(doc(db, "users", uid), {
      appTheme: nextTheme,
      appThemePreference: "manual",
      appThemeUpdatedAt: new Date().toISOString()
    }, { merge: true }).catch((error) => console.warn("Theme preference sync error", error));
  }

  function openProfileAccount() {
    const currentUser = auth.currentUser;
    const currentEmail = profileAccount.email || currentUser?.email || "";
    setProfileAccountDraft({
      displayName: profileAccount.displayName || currentUser?.displayName || "",
      email: currentEmail,
      login: profileAccount.login || getDefaultLoginAlias(currentEmail)
    });
    setProfileAccountAvatarFile(null);
    setProfileAccountAvatarPreview("");
    setProfileAccountStatus("");
    setProfileSettingsModalSection("account");
    setProfileSettingsModalOpen(true);
  }

  function openProfileAvatarCrop(file) {
    if (!file) return;
    if (profileAvatarCropSource) URL.revokeObjectURL(profileAvatarCropSource);
    setProfileAvatarCropSource(URL.createObjectURL(file));
    setProfileAvatarCropZoom(1);
    setProfileAvatarCropOffset({ x: 0, y: 0 });
    setProfileAvatarCropSize({ width: 0, height: 0 });
    setProfileAvatarCropOpen(true);
  }

  function closeProfileAvatarCrop() {
    setProfileAvatarCropOpen(false);
    profileAvatarCropDragRef.current = null;
  }

  function clampProfileAvatarCropOffset(offset, zoom = profileAvatarCropZoom) {
    const viewportSize = 240;
    const { width, height } = profileAvatarCropSize;
    if (!width || !height) return { x: 0, y: 0 };

    const baseScale = Math.max(viewportSize / width, viewportSize / height);
    const displayWidth = width * baseScale * zoom;
    const displayHeight = height * baseScale * zoom;
    const maxX = Math.max(0, (displayWidth - viewportSize) / 2);
    const maxY = Math.max(0, (displayHeight - viewportSize) / 2);
    return {
      x: Math.max(-maxX, Math.min(maxX, offset.x)),
      y: Math.max(-maxY, Math.min(maxY, offset.y))
    };
  }

  function changeProfileAvatarCropZoom(value) {
    const zoom = Math.max(1, Math.min(3, Number(value) || 1));
    setProfileAvatarCropZoom(zoom);
    setProfileAvatarCropOffset((current) => clampProfileAvatarCropOffset(current, zoom));
  }

  function startProfileAvatarCropDrag(event) {
    event.currentTarget.setPointerCapture?.(event.pointerId);
    profileAvatarCropDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      offsetX: profileAvatarCropOffset.x,
      offsetY: profileAvatarCropOffset.y
    };
  }

  function moveProfileAvatarCrop(event) {
    const drag = profileAvatarCropDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    setProfileAvatarCropOffset(clampProfileAvatarCropOffset({
      x: drag.offsetX + event.clientX - drag.startX,
      y: drag.offsetY + event.clientY - drag.startY
    }));
  }

  function endProfileAvatarCropDrag(event) {
    if (profileAvatarCropDragRef.current?.pointerId === event.pointerId) {
      profileAvatarCropDragRef.current = null;
    }
  }

  async function applyProfileAvatarCrop() {
    const image = profileAvatarCropImageRef.current;
    if (!image || !profileAvatarCropSize.width || !profileAvatarCropSize.height) return;

    const viewportSize = 240;
    const outputSize = 512;
    const baseScale = Math.max(
      viewportSize / profileAvatarCropSize.width,
      viewportSize / profileAvatarCropSize.height
    );
    const displayScale = baseScale * profileAvatarCropZoom;
    const displayWidth = profileAvatarCropSize.width * displayScale;
    const displayHeight = profileAvatarCropSize.height * displayScale;
    const drawX = viewportSize / 2 + profileAvatarCropOffset.x - displayWidth / 2;
    const drawY = viewportSize / 2 + profileAvatarCropOffset.y - displayHeight / 2;
    const outputRatio = outputSize / viewportSize;
    const canvas = document.createElement("canvas");
    canvas.width = outputSize;
    canvas.height = outputSize;
    const context = canvas.getContext("2d");
    if (!context) return;

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(
      image,
      drawX * outputRatio,
      drawY * outputRatio,
      displayWidth * outputRatio,
      displayHeight * outputRatio
    );

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
    if (!blob) return;

    const croppedFile = new File([blob], "avatar.jpg", { type: "image/jpeg" });
    setProfileAccountAvatarFile(croppedFile);
    setProfileAccountAvatarPreview(canvas.toDataURL("image/jpeg", 0.9));
    setProfileAccountStatus("");
    closeProfileAvatarCrop();
    await saveProfileAccount(profileAccountDraft, {
      avatarFileOverride: croppedFile,
      closeOnSuccess: false,
      successMessage: "Аватар сохранён."
    });
  }

  async function saveProfileAccount(nextDraft = profileAccountDraft, options = {}) {
    const currentUser = auth.currentUser;
    if (!currentUser || profileAccountSaving) return;

    const {
      avatarFileOverride = null,
      closeOnSuccess = false,
      blurActiveElement = false,
      successMessage = "Данные аккаунта сохранены."
    } = options;

    const displayName = String(nextDraft.displayName || "").trim();
    const currentEmail = String(currentUser.email || profileAccount.email || "").trim().toLowerCase();
    if (!displayName) {
      setProfileAccountStatus("Укажи имя.");
      return;
    }

    setProfileAccountSaving(true);
    setProfileAccountStatus("");

    try {
      let avatarUrl = profileAccount.avatarUrl || currentUser.photoURL || "";
      const avatarFile = avatarFileOverride || profileAccountAvatarFile;
      if (avatarFile) {
        const extension = avatarFile.name.split(".").pop() || "jpg";
        const avatarRef = ref(storage, `users/${currentUser.uid}/profile/avatar.${extension}`);
        await uploadBytes(avatarRef, avatarFile, {
          contentType: avatarFile.type || "image/jpeg"
        });
        avatarUrl = await getDownloadURL(avatarRef);
      }

      await updateProfile(currentUser, { displayName, photoURL: avatarUrl || null });

      const accountProfile = {
        displayName,
        avatarUrl,
        email: currentEmail,
        login: profileAccount.login || profileAccountDraft.login || getDefaultLoginAlias(currentEmail),
        updatedAt: new Date().toISOString()
      };
      await setDoc(doc(db, "users", currentUser.uid), {
        name: displayName,
        email: currentEmail,
        avatarUrl,
        accountProfile,
        updatedAt: accountProfile.updatedAt
      }, { merge: true });

      setProfileAccount(accountProfile);
      setProfileAccountDraft({
        displayName,
        email: currentEmail,
        login: accountProfile.login
      });
      setProfileAccountAvatarFile(null);
      setProfileAccountAvatarPreview("");
      setProfileAccountStatus(successMessage);
      if (closeOnSuccess || blurActiveElement) {
        document.activeElement?.blur?.();
      }
      if (closeOnSuccess) {
        profileSettingsModalBodyRef.current?.scrollTo({ top: 0, behavior: "smooth" });
        window.setTimeout(() => {
          setProfileSettingsModalOpen(false);
          setProfileAccountStatus("");
        }, 650);
      } else {
        window.setTimeout(() => {
          setProfileAccountStatus("");
        }, 1200);
      }
    } catch (error) {
      console.error("Profile account save failed:", error);
      setProfileAccountStatus(
        error?.code === "auth/requires-recent-login"
          ? "Для сохранения нужно выйти и войти в аккаунт заново."
          : error?.code === "auth/email-already-in-use"
            ? "Эта почта уже используется другим аккаунтом."
            : "Не получилось сохранить данные. Проверь соединение."
      );
    } finally {
      setProfileAccountSaving(false);
    }
  }

  async function reauthenticateForEmailChange(currentUser, currentPassword = "") {
    const providerIds = currentUser.providerData.map((provider) => provider.providerId);
    const hasPasswordProvider = providerIds.includes("password");
    const hasGoogleProvider = providerIds.includes("google.com");
    const email = currentUser.email || profileAccount.email || "";

    if (hasPasswordProvider && currentPassword) {
      const credentialResult = await reauthenticateWithCredential(
        currentUser,
        EmailAuthProvider.credential(email, currentPassword)
      );
      await credentialResult.user.reload();
      return auth.currentUser || credentialResult.user || currentUser;
    }

    if (hasGoogleProvider) {
      const credentialResult = await reauthenticateWithPopup(currentUser, googleReauthProvider);
      await credentialResult.user.reload();
      return auth.currentUser || credentialResult.user || currentUser;
    }

    if (hasPasswordProvider) {
      const error = new Error("Current password required");
      error.code = "auth/current-password-required";
      throw error;
    }

    const error = new Error("Unsupported provider");
    error.code = "auth/unsupported-provider";
    throw error;
  }

  async function requestProfileEmailChange(nextEmailValue = "", options = {}) {
    const currentUser = auth.currentUser;
    if (!currentUser || profileAccountSaving) return false;

    const currentEmail = String(currentUser.email || profileAccount.email || "").trim().toLowerCase();
    const nextEmail = String(nextEmailValue || "").trim().toLowerCase();

    if (!nextEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail)) {
      setProfileAccountStatus("Укажи корректную новую почту.");
      return false;
    }
    if (nextEmail === currentEmail) {
      setProfileAccountStatus("Эта почта уже привязана к аккаунту.");
      return false;
    }

    setProfileAccountSaving(true);
    setProfileAccountStatus("");

    try {
      const verifiedUser = await reauthenticateForEmailChange(currentUser, options.currentPassword || "");
      const response = await fetchAuthorizedWithTimeout(getProfileUpdateEmailEndpoint(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ email: nextEmail })
      }, 16000);
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.ok === false) {
        const error = new Error(data?.message || data?.error || "Profile email update failed");
        error.code = data?.error || `http/${response.status}`;
        throw error;
      }

      await verifiedUser.reload();
      await verifiedUser.getIdToken(true).catch(() => {});

      const email = String(data.email || verifiedUser.email || nextEmail).trim().toLowerCase();
      const updatedAt = new Date().toISOString();
      const displayName = data.accountProfile?.displayName || profileAccountDraft.displayName || profileAccount.displayName || verifiedUser.displayName || "";
      const avatarUrl = data.accountProfile?.avatarUrl || profileAccount.avatarUrl || verifiedUser.photoURL || "";
      const accountProfile = data.accountProfile || {
        displayName,
        avatarUrl,
        email,
        updatedAt
      };
      setProfileAccount(accountProfile);
      setProfileAccountDraft({
        displayName,
        email,
        login: accountProfile.login || profileAccount.login || ""
      });
      setProfileAccountStatus(`Почта изменена на ${email}.`);
      return true;
    } catch (error) {
      console.error("Profile email change request failed:", error);
      setProfileAccountStatus(
        error?.code === "auth/current-password-required"
          ? "Укажи текущий пароль, чтобы подтвердить смену почты."
          : error?.code === "auth/wrong-password" || error?.code === "auth/invalid-credential"
            ? "Текущий пароль указан неверно."
            : error?.code === "auth/popup-closed-by-user"
              ? "Подтверждение через Google отменено."
              : error?.code === "auth/popup-blocked"
                ? "Браузер заблокировал окно Google. Разреши всплывающее окно и попробуй ещё раз."
                : error?.code === "auth/requires-recent-login"
                  ? "Не получилось подтвердить вход. Попробуй ещё раз или войди в аккаунт заново."
                  : error?.code === "auth/unauthorized-continue-uri"
                    ? "Firebase не разрешил ссылку подтверждения. Нужно добавить домен приложения в Authorized domains."
                    : error?.code === "auth/operation-not-allowed"
                      ? "В Firebase отключена смена почты для этого способа входа."
                      : error?.code === "auth/too-many-requests"
                        ? "Слишком много попыток. Подожди немного и попробуй ещё раз."
                  : error?.code === "auth/unsupported-provider"
                    ? "Для этого способа входа пока нельзя сменить почту из приложения."
                    : error?.code === "auth/email-already-in-use"
                      || error?.code === "email-already-in-use"
                      ? "Эта почта уже используется другим аккаунтом."
                      : "Не получилось изменить почту. Проверь данные и попробуй ещё раз."
      );
      return false;
    } finally {
      setProfileAccountSaving(false);
    }
  }

  async function syncProfileVerifiedEmail() {
    const currentUser = auth.currentUser;
    if (!currentUser || profileAccountSaving) return false;

    setProfileAccountSaving(true);
    setProfileAccountStatus("");

    try {
      await currentUser.reload();
      const refreshedUser = auth.currentUser;
      const email = String(refreshedUser?.email || currentUser.email || profileAccount.email || "").trim().toLowerCase();
      const displayName = profileAccountDraft.displayName || profileAccount.displayName || refreshedUser?.displayName || "";
      const avatarUrl = profileAccount.avatarUrl || refreshedUser?.photoURL || "";
      const updatedAt = new Date().toISOString();
      const loginAlias = getDefaultLoginAlias(email);

      const accountProfile = {
        displayName,
        avatarUrl,
        email,
        login: profileAccount.login || profileAccountDraft.login || loginAlias,
        updatedAt
      };

      await setDoc(doc(db, "users", currentUser.uid), {
        email,
        loginLower: accountProfile.login || loginAlias,
        accountProfile,
        pendingEmail: "",
        pendingEmailRequestedAt: "",
        updatedAt
      }, { merge: true });

      if (accountProfile.login || loginAlias) {
        await setDoc(doc(db, "loginAliases", accountProfile.login || loginAlias), {
          email,
          uid: currentUser.uid,
          updatedAt
        }, { merge: true });
      }

      setProfileAccount(accountProfile);
      setProfileAccountDraft({
        displayName,
        email,
        login: accountProfile.login || loginAlias
      });
      setProfileAccountStatus("Почта аккаунта синхронизирована.");
      window.setTimeout(() => {
        setProfileAccountStatus("");
      }, 1400);
      return true;
    } catch (error) {
      console.error("Profile verified email sync failed:", error);
      setProfileAccountStatus("Пока не вижу подтверждённую новую почту. Проверь письмо и попробуй ещё раз.");
      return false;
    } finally {
      setProfileAccountSaving(false);
    }
  }

  async function sendProfilePasswordReset() {
    const email = profileAccountDraft.email.trim() || auth.currentUser?.email || "";
    if (!email) {
      setProfileAccountStatus("Сначала укажи почту аккаунта.");
      return;
    }

    try {
      await sendPasswordResetEmail(auth, email);
      setProfileAccountStatus(`Ссылка для смены пароля отправлена на ${email}.`);
    } catch (error) {
      console.error("Password reset failed:", error);
      setProfileAccountStatus("Не получилось отправить ссылку для смены пароля.");
    }
  }

  async function changeProfilePassword({ currentPassword = "", nextPassword = "", confirmPassword = "" } = {}) {
    const currentUser = auth.currentUser;
    const email = currentUser?.email || profileAccountDraft.email || "";
    if (!currentUser || profileAccountSaving) return false;
    const providerIds = new Set((currentUser.providerData || []).map((provider) => provider.providerId));
    const hasPasswordProvider = providerIds.has("password");
    const hasGoogleProvider = providerIds.has("google.com");
    if (!email) {
      setProfileAccountStatus("Не удалось определить почту аккаунта.");
      return false;
    }
    if (hasPasswordProvider && !currentPassword) {
      setProfileAccountStatus("Укажи текущий пароль.");
      return false;
    }
    if (nextPassword.length < 6) {
      setProfileAccountStatus("Новый пароль должен быть не короче 6 символов.");
      return false;
    }
    if (nextPassword !== confirmPassword) {
      setProfileAccountStatus("Новые пароли не совпадают.");
      return false;
    }

    setProfileAccountSaving(true);
    setProfileAccountStatus("");

    try {
      if (hasPasswordProvider) {
        const credential = EmailAuthProvider.credential(email, currentPassword);
        await reauthenticateWithCredential(currentUser, credential);
      } else if (hasGoogleProvider) {
        await reauthenticateWithPopup(currentUser, googleReauthProvider);
      } else {
        const error = new Error("Unsupported provider");
        error.code = "auth/unsupported-provider";
        throw error;
      }
      await updatePassword(currentUser, nextPassword);
      await currentUser.reload().catch(() => {});
      setProfileAccountStatus("Пароль изменён.");
      window.setTimeout(() => {
        setProfileAccountStatus("");
      }, 1400);
      return true;
    } catch (error) {
      console.error("Profile password change failed:", error);
      setProfileAccountStatus(
        error?.code === "auth/wrong-password" || error?.code === "auth/invalid-credential"
          ? "Текущий пароль указан неверно."
          : error?.code === "auth/weak-password"
            ? "Новый пароль слишком слабый."
            : error?.code === "auth/popup-closed-by-user"
              ? "Подтверждение через Google отменено."
              : error?.code === "auth/unsupported-provider"
                ? "Для этого способа входа нужно сначала привязать Google или email/password."
                : "Не получилось изменить пароль. Попробуй ещё раз."
      );
      return false;
    } finally {
      setProfileAccountSaving(false);
    }
  }

  async function changeProfileLogin(nextLoginValue = "") {
    const currentUser = auth.currentUser;
    if (!currentUser || profileAccountSaving) return false;

    const nextLogin = String(nextLoginValue || "").trim().toLowerCase();
    const email = String(currentUser.email || profileAccount.email || profileAccountDraft.email || "").trim().toLowerCase();
    const currentLogin = String(profileAccount.login || getDefaultLoginAlias(email)).trim().toLowerCase();
    if (!/^[a-z0-9._-]{3,32}$/.test(nextLogin)) {
      setProfileAccountDraft((current) => ({ ...current, login: currentLogin }));
      setProfileAccountStatus("Логин: 3-32 символа, латиница, цифры, точка, дефис или _.");
      return false;
    }

    if (nextLogin === currentLogin) {
      setProfileAccountDraft((current) => ({ ...current, login: currentLogin }));
      setProfileAccountStatus("Этот логин уже используется для входа.");
      return true;
    }

    setProfileAccountSaving(true);
    setProfileAccountStatus("");

    try {
      const response = await fetchAuthorizedWithTimeout(getProfileUpdateLoginEndpoint(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ login: nextLogin })
      }, 16000);
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.ok === false) {
        const error = new Error(data?.message || data?.error || "Profile login update failed");
        error.code = data?.error || `http/${response.status}`;
        throw error;
      }

      const login = String(data.login || nextLogin).trim().toLowerCase();
      const accountProfile = data.accountProfile || {
        ...profileAccount,
        login,
        updatedAt: new Date().toISOString()
      };

      setProfileAccount(accountProfile);
      setProfileAccountDraft({
        displayName: accountProfile.displayName || profileAccountDraft.displayName || "",
        email: accountProfile.email || profileAccountDraft.email || "",
        login
      });
      setProfileAccountStatus(`Логин изменён на ${login}.`);
      window.setTimeout(() => {
        setProfileAccountStatus("");
      }, 1400);
      return true;
    } catch (error) {
      console.error("Profile login change failed:", error);
      setProfileAccountDraft((current) => ({ ...current, login: currentLogin }));
      setProfileAccountStatus(
        error?.code === "login-already-in-use"
          ? "Этот логин уже занят другим аккаунтом."
          : error?.code === "invalid-login"
            ? "Логин: 3-32 символа, латиница, цифры, точка, дефис или _."
            : "Не получилось изменить логин. Проверь данные и попробуй ещё раз."
      );
      return false;
    } finally {
      setProfileAccountSaving(false);
    }
  }

  return {
    refreshPage,
    toggleAppTheme,
    openProfileAccount,
    openProfileAvatarCrop,
    closeProfileAvatarCrop,
    changeProfileAvatarCropZoom,
    startProfileAvatarCropDrag,
    moveProfileAvatarCrop,
    endProfileAvatarCropDrag,
    applyProfileAvatarCrop,
    saveProfileAccount,
    requestProfileEmailChange,
    syncProfileVerifiedEmail,
    changeProfileLogin,
    changeProfilePassword,
    sendProfilePasswordReset
  };
}
