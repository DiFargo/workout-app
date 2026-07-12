const STATUS_NO_ACCESS = "\u0421\u043e\u0437\u0434\u0430\u0432\u0430\u0442\u044c \u043a\u043b\u0438\u0435\u043d\u0442\u043e\u0432 \u043c\u043e\u0436\u0435\u0442 \u0442\u043e\u043b\u044c\u043a\u043e \u0430\u0434\u043c\u0438\u043d \u0438\u043b\u0438 \u0442\u0440\u0435\u043d\u0435\u0440.";
const STATUS_EMAIL_REQUIRED = "\u0412\u0432\u0435\u0434\u0438 \u043a\u043e\u0440\u0440\u0435\u043a\u0442\u043d\u044b\u0439 email \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044f.";
const STATUS_PASSWORD_SHORT = "\u041f\u0430\u0440\u043e\u043b\u044c \u0434\u043e\u043b\u0436\u0435\u043d \u0431\u044b\u0442\u044c \u043c\u0438\u043d\u0438\u043c\u0443\u043c 6 \u0441\u0438\u043c\u0432\u043e\u043b\u043e\u0432.";
const STATUS_CLIENT_CREATED = "\u041a\u043b\u0438\u0435\u043d\u0442 \u0441\u043e\u0437\u0434\u0430\u043d \u2705";
const STATUS_CLIENT_CREATED_FOR_TRAINER = "\u041a\u043b\u0438\u0435\u043d\u0442 \u0441\u043e\u0437\u0434\u0430\u043d \u0438 \u043f\u0440\u0438\u0432\u044f\u0437\u0430\u043d \u043a \u0442\u0440\u0435\u043d\u0435\u0440\u0443 \u2705";
const STATUS_EMAIL_EXISTS = "\u041f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044c \u0441 \u0442\u0430\u043a\u0438\u043c email \u0443\u0436\u0435 \u0441\u0443\u0449\u0435\u0441\u0442\u0432\u0443\u0435\u0442.";
const STATUS_WEAK_PASSWORD = "\u041f\u0430\u0440\u043e\u043b\u044c \u0441\u043b\u0438\u0448\u043a\u043e\u043c \u0441\u043b\u0430\u0431\u044b\u0439. \u041d\u0443\u0436\u043d\u043e \u043c\u0438\u043d\u0438\u043c\u0443\u043c 6 \u0441\u0438\u043c\u0432\u043e\u043b\u043e\u0432.";
const STATUS_PROFILE_PERMISSION_DENIED = "\u041a\u043b\u0438\u0435\u043d\u0442 \u0441\u043e\u0437\u0434\u0430\u043d \u0432 Auth, \u043d\u043e \u043f\u0440\u043e\u0444\u0438\u043b\u044c \u043d\u0435 \u0437\u0430\u043f\u0438\u0441\u0430\u043b\u0441\u044f \u0432 Firestore. \u041d\u0443\u0436\u043d\u043e \u0440\u0430\u0437\u0440\u0435\u0448\u0438\u0442\u044c \u0442\u0440\u0435\u043d\u0435\u0440\u0443 \u0437\u0430\u043f\u0438\u0441\u044c users/{clientId}.";
const STATUS_CREATE_FAILED = "\u041d\u0435 \u043f\u043e\u043b\u0443\u0447\u0438\u043b\u043e\u0441\u044c \u0441\u043e\u0437\u0434\u0430\u0442\u044c \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044f. \u041f\u0440\u043e\u0432\u0435\u0440\u044c email/\u043f\u0430\u0440\u043e\u043b\u044c \u0438 Firebase Auth.";

function getInviteIdForEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function getInviteUrl(email) {
  const origin = typeof window !== "undefined" && window.location?.origin
    ? window.location.origin
    : "https://tren-85720.web.app";
  return `${origin}/?invite=${encodeURIComponent(getInviteIdForEmail(email))}`;
}

export function createTrainerCreateClientHandlers({
  auth,
  db,
  user,
  currentUserRole,
  ADMIN_EMAIL,
  adminNewUserName,
  adminNewUserEmail,
  adminNewUserPassword,
  canUseTrainerFeatures,
  canUseAdminFeatures,
  setAdminNewUserName,
  setAdminNewUserEmail,
  setAdminNewUserPassword,
  setAdminCreateUserStatus,
  setAdminCreateUserLoading,
  setAdminCreatedCredentials,
  setUsersList,
  setAdminAllUsersList,
  setSelectedUserId,
  setAdminSelectedClient,
  loadUsers
}) {
  function generateAdminPassword() {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
    const chars = Array.from({ length: 10 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]);
    const password = `${chars.join("")}!7`;
    setAdminNewUserPassword(password);
    return password;
  }

  async function createUserFromAdminPanel(event) {
    event?.preventDefault?.();

    if (!canUseTrainerFeatures()) {
      setAdminCreateUserStatus(STATUS_NO_ACCESS);
      return;
    }

    const email = adminNewUserEmail.trim().toLowerCase();
    const displayName = adminNewUserName.trim();

    if (!email || !email.includes("@")) {
      setAdminCreateUserStatus(STATUS_EMAIL_REQUIRED);
      return;
    }

    setAdminCreateUserLoading(true);
    setAdminCreateUserStatus("");
    setAdminCreatedCredentials(null);

    try {
      const token = await auth.currentUser?.getIdToken?.();
      if (!token) throw new Error("auth/required");

      const abortController = new AbortController();
      const requestTimeout = setTimeout(() => abortController.abort(), 20000);
      let response;
      try {
        response = await fetch("/api/trainer/create-invite", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ email, name: displayName }),
          signal: abortController.signal
        });
      } finally {
        clearTimeout(requestTimeout);
      }
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        const error = new Error(result.error || "trainer_invite_create_failed");
        error.code = result.error || "trainer_invite_create_failed";
        throw error;
      }

      const createdClientFromApi = result.client;
      setAdminCreatedCredentials({
        email,
        name: displayName || email.split("@")[0],
        inviteUrl: result.inviteUrl || getInviteUrl(email),
        activationUrl: result.activationUrl || ""
      });
      setAdminNewUserName("");
      setAdminNewUserEmail("");
      setAdminNewUserPassword("");
      setAdminCreateUserStatus(currentUserRole === "trainer" ? STATUS_CLIENT_CREATED_FOR_TRAINER : STATUS_CLIENT_CREATED);
      setUsersList((prev) => [createdClientFromApi, ...prev.filter((item) => item.id !== createdClientFromApi.id)]);
      setAdminAllUsersList((prev) => [createdClientFromApi, ...prev.filter((item) => item.id !== createdClientFromApi.id)]);
      setSelectedUserId(createdClientFromApi.id);
      setAdminSelectedClient(createdClientFromApi);
      if (canUseAdminFeatures()) await loadUsers();
    } catch (error) {
      console.error("User creation failed:", error);

      const message = error?.code === "auth/email-already-in-use"
        ? STATUS_EMAIL_EXISTS
        : error?.name === "AbortError"
          ? "Создание приглашения заняло слишком долго. Проверь интернет и повтори."
          : /unauthorized-continue-uri/i.test(error?.message || "")
            ? "Ссылка активации временно недоступна. Повтори попытку через минуту."
        : error?.code === "auth/weak-password"
          ? STATUS_WEAK_PASSWORD
          : error?.code === "permission-denied"
            ? STATUS_PROFILE_PERMISSION_DENIED
            : STATUS_CREATE_FAILED;

      setAdminCreateUserStatus(message);
    } finally {
      if (secondaryApp) {
        try {
          await deleteApp(secondaryApp);
        } catch {
          // ignore secondary app cleanup
        }
      }

      setAdminCreateUserLoading(false);
    }
  }

  return {
    generateAdminPassword,
    createUserFromAdminPanel
  };
}
