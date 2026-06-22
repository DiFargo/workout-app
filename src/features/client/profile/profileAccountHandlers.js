import {
  sendPasswordResetEmail,
  updateEmail,
  updateProfile
} from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import {
  getDownloadURL,
  ref,
  uploadBytes
} from "firebase/storage";

export function createProfileAccountHandlers({
  APP_THEMES,
  auth,
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
    setAppTheme((currentTheme) => (currentTheme === APP_THEMES.WARM_LIGHT ? APP_THEMES.DARK_GREEN : APP_THEMES.WARM_LIGHT));
  }

  function openProfileAccount() {
    const currentUser = auth.currentUser;
    setProfileAccountDraft({
      displayName: profileAccount.displayName || currentUser?.displayName || "",
      email: profileAccount.email || currentUser?.email || ""
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
  }

  async function saveProfileAccount() {
    const currentUser = auth.currentUser;
    if (!currentUser || profileAccountSaving) return;

    const displayName = profileAccountDraft.displayName.trim();
    const nextEmail = profileAccountDraft.email.trim().toLowerCase();
    if (!displayName) {
      setProfileAccountStatus("Укажи имя.");
      return;
    }
    if (!nextEmail || !nextEmail.includes("@")) {
      setProfileAccountStatus("Укажи корректную почту.");
      return;
    }

    setProfileAccountSaving(true);
    setProfileAccountStatus("");

    try {
      let avatarUrl = profileAccount.avatarUrl || currentUser.photoURL || "";
      if (profileAccountAvatarFile) {
        const extension = profileAccountAvatarFile.name.split(".").pop() || "jpg";
        const avatarRef = ref(storage, `users/${currentUser.uid}/profile/avatar.${extension}`);
        await uploadBytes(avatarRef, profileAccountAvatarFile, {
          contentType: profileAccountAvatarFile.type || "image/jpeg"
        });
        avatarUrl = await getDownloadURL(avatarRef);
      }

      if (nextEmail !== String(currentUser.email || "").toLowerCase()) {
        await updateEmail(currentUser, nextEmail);
      }
      await updateProfile(currentUser, { displayName, photoURL: avatarUrl || null });

      const accountProfile = {
        displayName,
        avatarUrl,
        email: nextEmail,
        updatedAt: new Date().toISOString()
      };
      await setDoc(doc(db, "users", currentUser.uid), {
        name: displayName,
        email: nextEmail,
        avatarUrl,
        accountProfile,
        updatedAt: accountProfile.updatedAt
      }, { merge: true });

      setProfileAccount(accountProfile);
      setProfileAccountAvatarFile(null);
      setProfileAccountAvatarPreview("");
      setProfileAccountStatus("Данные аккаунта сохранены.");
      document.activeElement?.blur?.();
      profileSettingsModalBodyRef.current?.scrollTo({ top: 0, behavior: "smooth" });
      window.setTimeout(() => {
        setProfileSettingsModalOpen(false);
        setProfileAccountStatus("");
      }, 650);
    } catch (error) {
      console.error("Profile account save failed:", error);
      setProfileAccountStatus(
        error?.code === "auth/requires-recent-login"
          ? "Для смены почты нужно выйти и войти в аккаунт заново."
          : error?.code === "auth/email-already-in-use"
            ? "Эта почта уже используется другим аккаунтом."
            : "Не получилось сохранить данные. Проверь соединение."
      );
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
    sendProfilePasswordReset
  };
}
