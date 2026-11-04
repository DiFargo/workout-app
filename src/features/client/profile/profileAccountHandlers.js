import {
  EmailAuthProvider,
  GoogleAuthProvider,
  getIdTokenResult,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  sendPasswordResetEmail,
  updatePassword,
  updateProfile
} from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { fetchAuthorizedWithTimeout, getAppCheckApiHeaders } from "../../../utils/apiClient";
import { captureAuthSession } from "../../../utils/authSession.js";
import { isRecentCustomEmailSession } from "./profileEmailAuth.js";
import { getAccountRecoveryEmail } from "./profileAccountEmail.js";
import { getDefaultLoginAlias } from "../../../utils/clientUx";
import { uploadStorageFile } from "../../../utils/firebaseStorage";
import { limitUserDisplayName } from "../../../utils/userDisplayName.js";

const googleReauthProvider = new GoogleAuthProvider();
const PROFILE_UPDATE_EMAIL_ENDPOINT = "/api/profile/update-email";
const PROFILE_UPDATE_LOGIN_ENDPOINT = "/api/profile/update-login";

function getProfileUpdateEmailEndpoint() {
  return PROFILE_UPDATE_EMAIL_ENDPOINT;
}

function getProfileUpdateLoginEndpoint() {
  return PROFILE_UPDATE_LOGIN_ENDPOINT;
}
export function createProfileAccountHandlers({
  auth,
  db,
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
  const accountEmailSession = captureAuthSession(auth);
  let confirmedEmailChange = null;
  function refreshPage() {
    window.location.reload();
  }

  function openProfileAccount() {
    const currentUser = auth.currentUser;
    const currentEmail = profileAccount.email || currentUser?.email || "";
    setProfileAccountDraft({
      displayName: limitUserDisplayName(profileAccount.displayName || currentUser?.displayName || ""),
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

    const displayName = limitUserDisplayName(nextDraft.displayName);
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
        const uploadedAvatar = await uploadStorageFile(`users/${currentUser.uid}/profile/avatar.${extension}`, avatarFile, {
          contentType: avatarFile.type || "image/jpeg"
        });
        avatarUrl = uploadedAvatar.url;
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
        avatarUrl,
        accountProfile: { displayName, avatarUrl, updatedAt: accountProfile.updatedAt },
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

  async function reauthenticateForEmailChange(currentUser, currentPassword, awaitCurrent, onCustomSession) {
    const tokenResult = await awaitCurrent(getIdTokenResult(currentUser));
    if (tokenResult.claims?.sub !== currentUser.uid) {
      throw Object.assign(new Error("Auth identity changed"), { code: "auth/session-changed" });
    }
    if (tokenResult.signInProvider === "custom") {
      onCustomSession();
      if (!isRecentCustomEmailSession(tokenResult)) {
        throw Object.assign(new Error("Recent Telegram login required"), { code: "auth/telegram-requires-recent-login" });
      }
      return currentUser;
    }
    const providerIds = (currentUser.providerData || []).map((provider) => provider.providerId);
    const hasPasswordProvider = providerIds.includes("password");
    const hasGoogleProvider = providerIds.includes("google.com");
    const email = currentUser.email || profileAccount.email || "";

    if (hasPasswordProvider && currentPassword) {
      const credentialResult = await awaitCurrent(reauthenticateWithCredential(
        currentUser,
        EmailAuthProvider.credential(email, currentPassword)
      ));
      await awaitCurrent(credentialResult.user.reload());
      return currentUser;
    }

    if (hasGoogleProvider) {
      const credentialResult = await awaitCurrent(reauthenticateWithPopup(currentUser, googleReauthProvider));
      await awaitCurrent(credentialResult.user.reload());
      return currentUser;
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
    if (!accountEmailSession.isCurrent()) return false;
    const currentUser = auth.currentUser;
    if (!currentUser || profileAccountSaving) return false;
    const session = captureAuthSession(auth);
    const update = (setter, value) => {
      if (session.isCurrent()) setter(current => session.isCurrent() ? value : current);
    };

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

    update(setProfileAccountSaving, true);
    update(setProfileAccountStatus, "");
    const controller = new AbortController();
    let rejectDeadline;
    const deadline = new Promise((_, reject) => { rejectDeadline = reject; });
    const timer = setTimeout(() => {
      controller.abort();
      rejectDeadline(new DOMException("Timeout", "AbortError"));
    }, 16000);
    const assertCurrent = () => {
      if (!session.isCurrent()) throw Object.assign(new Error("Auth session changed"), { code: "auth/session-changed" });
      if (controller.signal.aborted) throw new DOMException("Timeout", "AbortError");
    };
    const awaitCurrent = async promise => {
      const value = await Promise.race([promise, deadline]);
      assertCurrent();
      return value;
    };
    let customConfirmation = false;

    try {
      const verifiedUser = await awaitCurrent(reauthenticateForEmailChange(currentUser, options.currentPassword || "", awaitCurrent, () => { customConfirmation = true; }));
      const idToken = await awaitCurrent(verifiedUser.getIdToken(true));
      const headers = await awaitCurrent(getAppCheckApiHeaders({
        "Content-Type": "application/json", Authorization: `Bearer ${idToken}`
      }));
      assertCurrent();
      const response = await awaitCurrent(fetch(getProfileUpdateEmailEndpoint(), {
        method: "POST",
        headers,
        signal: controller.signal,
        body: JSON.stringify({ email: nextEmail })
      }));
      const data = await awaitCurrent(response.json().catch(() => ({})));
      if (!response.ok || data?.ok === false) {
        const error = new Error(data?.message || data?.error || "Profile email update failed");
        error.code = data?.error || `http/${response.status}`;
        throw error;
      }

      // Auth may revoke the old ID token when Admin SDK changes the email.
      // Preserve the successful result without a post-write token refresh;
      // the email sheet explicitly hands the user off to a new login.
      const email = String(data.email || nextEmail).trim().toLowerCase();
      const updatedAt = new Date().toISOString();
      const displayName = limitUserDisplayName(
        data.accountProfile?.displayName || profileAccountDraft.displayName || profileAccount.displayName || verifiedUser.displayName || ""
      );
      const avatarUrl = data.accountProfile?.avatarUrl || profileAccount.avatarUrl || verifiedUser.photoURL || "";
      const accountProfile = data.accountProfile || {
        displayName,
        avatarUrl,
        email,
        updatedAt
      };
      update(setProfileAccount, accountProfile);
      confirmedEmailChange = { session, email };
      update(setProfileAccountDraft, {
        displayName,
        email,
        login: accountProfile.login || profileAccount.login || ""
      });
      update(setProfileAccountStatus, `Почта ${email} сохранена. Для безопасности требуется повторный вход. Адрес ещё не подтверждён; пароль не создаётся автоматически.`);
      return true;
    } catch (error) {
      if (!session.isCurrent()) return false;
      console.error("Profile email change request failed:", error);
      update(setProfileAccountStatus,
        error?.code === "auth/telegram-requires-recent-login" || (customConfirmation && error?.code === "auth/requires-recent-login")
          ? "Для добавления почты нужен недавний вход через Telegram. Выйди из аккаунта, затем открой приложение через бота и войди в тот же аккаунт, затем повтори."
          : error?.code === "auth/current-password-required"
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
      clearTimeout(timer);
      update(setProfileAccountSaving, false);
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
      const displayName = limitUserDisplayName(
        profileAccountDraft.displayName || profileAccount.displayName || refreshedUser?.displayName || ""
      );
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

      const response = await fetchAuthorizedWithTimeout(getProfileUpdateEmailEndpoint(), {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email })
      }, 16000);
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error || "Email sync failed");
      Object.assign(accountProfile, result.accountProfile);

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
    if (!accountEmailSession.isCurrent()) return false;
    const session = captureAuthSession(auth);
    if (!session.uid) return false;
    const email = getAccountRecoveryEmail(confirmedEmailChange?.session.isCurrent()
      ? confirmedEmailChange.email
      : profileAccount.email || profileAccountDraft.email || auth.currentUser?.email || "");
    if (!email) {
      setProfileAccountStatus("Сначала добавь личную почту аккаунта.");
      return false;
    }

    try {
      await sendPasswordResetEmail(auth, email);
      if (!session.isCurrent()) return false;
      setProfileAccountStatus(current => session.isCurrent()
        ? `Ссылка для установки или смены пароля отправлена на ${email}. Заверши действие по ссылке, чтобы использовать пароль.`
        : current);
      return true;
    } catch (error) {
      if (!session.isCurrent()) return false;
      console.error("Password reset failed:", error);
      setProfileAccountStatus(current => session.isCurrent() ? "Не получилось отправить ссылку для установки или смены пароля." : current);
      return false;
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
        displayName: limitUserDisplayName(accountProfile.displayName || profileAccountDraft.displayName || ""),
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
