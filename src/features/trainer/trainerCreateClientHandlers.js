const STATUS_NO_ACCESS = "\u0421\u043e\u0437\u0434\u0430\u0432\u0430\u0442\u044c \u043a\u043b\u0438\u0435\u043d\u0442\u043e\u0432 \u043c\u043e\u0436\u0435\u0442 \u0442\u043e\u043b\u044c\u043a\u043e \u0430\u0434\u043c\u0438\u043d \u0438\u043b\u0438 \u0442\u0440\u0435\u043d\u0435\u0440.";
const STATUS_LOGIN_REQUIRED = "\u041b\u043e\u0433\u0438\u043d: 3-32 \u0441\u0438\u043c\u0432\u043e\u043b\u0430, \u043b\u0430\u0442\u0438\u043d\u0438\u0446\u0430, \u0446\u0438\u0444\u0440\u044b, \u0442\u043e\u0447\u043a\u0430, \u0434\u0435\u0444\u0438\u0441 \u0438\u043b\u0438 _.";
const STATUS_CLIENT_CREATED = "\u041a\u043b\u0438\u0435\u043d\u0442 \u0441\u043e\u0437\u0434\u0430\u043d \u2705";
const STATUS_CLIENT_CREATED_FOR_TRAINER = "\u041a\u043b\u0438\u0435\u043d\u0442 \u0441\u043e\u0437\u0434\u0430\u043d \u0438 \u043f\u0440\u0438\u0432\u044f\u0437\u0430\u043d \u043a \u0442\u0440\u0435\u043d\u0435\u0440\u0443 \u2705";
const STATUS_LOGIN_EXISTS = "\u042d\u0442\u043e\u0442 \u043b\u043e\u0433\u0438\u043d \u0443\u0436\u0435 \u0437\u0430\u043d\u044f\u0442.";
const STATUS_WEAK_PASSWORD = "\u041f\u0430\u0440\u043e\u043b\u044c \u0441\u043b\u0438\u0448\u043a\u043e\u043c \u0441\u043b\u0430\u0431\u044b\u0439. \u041d\u0443\u0436\u043d\u043e \u043c\u0438\u043d\u0438\u043c\u0443\u043c 6 \u0441\u0438\u043c\u0432\u043e\u043b\u043e\u0432.";
const STATUS_PROFILE_PERMISSION_DENIED = "\u041a\u043b\u0438\u0435\u043d\u0442 \u0441\u043e\u0437\u0434\u0430\u043d \u0432 Auth, \u043d\u043e \u043f\u0440\u043e\u0444\u0438\u043b\u044c \u043d\u0435 \u0437\u0430\u043f\u0438\u0441\u0430\u043b\u0441\u044f \u0432 Firestore. \u041d\u0443\u0436\u043d\u043e \u0440\u0430\u0437\u0440\u0435\u0448\u0438\u0442\u044c \u0442\u0440\u0435\u043d\u0435\u0440\u0443 \u0437\u0430\u043f\u0438\u0441\u044c users/{clientId}.";
const STATUS_CREATE_FAILED = "\u041d\u0435 \u043f\u043e\u043b\u0443\u0447\u0438\u043b\u043e\u0441\u044c \u0441\u043e\u0437\u0434\u0430\u0442\u044c \u043f\u0440\u0438\u0433\u043b\u0430\u0448\u0435\u043d\u0438\u0435. \u041f\u043e\u043f\u0440\u043e\u0431\u0443\u0439 \u0435\u0449\u0451 \u0440\u0430\u0437.";

function normalizeLogin(value) {
  return String(value || "").trim().toLowerCase();
}

function isValidLogin(value) {
  return /^[a-z0-9._-]{3,32}$/.test(value);
}

export function createTrainerCreateClientHandlers({
  currentUserRole,
  adminNewUserName,
  adminNewUserEmail,
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

    const login = normalizeLogin(adminNewUserEmail);
    const displayName = adminNewUserName.trim();

    if (!isValidLogin(login)) {
      setAdminCreateUserStatus(STATUS_LOGIN_REQUIRED);
      return;
    }

    setAdminCreateUserLoading(true);
    setAdminCreateUserStatus("");
    setAdminCreatedCredentials(null);

    try {
      const response = await fetchAuthorizedWithTimeout("/api/trainer/create-invite", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ login, name: displayName })
      }, 20000);
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        const error = new Error(result.error || "trainer_invite_create_failed");
        error.code = result.error || "trainer_invite_create_failed";
        throw error;
      }

      const createdClientFromApi = result.client;
      setAdminCreatedCredentials({
        login: result.login || login,
        name: displayName || login,
        inviteUrl: result.inviteUrl || "",
        activationUrl: result.activationUrl || "",
        shareUrl: result.shareUrl || ""
      });
      setAdminNewUserName("");
      setAdminNewUserEmail("");
      setAdminNewUserPassword("");
      setAdminCreateUserStatus(currentUserRole === "trainer" ? STATUS_CLIENT_CREATED_FOR_TRAINER : STATUS_CLIENT_CREATED);
      setUsersList((prev) => [createdClientFromApi, ...prev.filter((item) => item.id !== createdClientFromApi.id)]);
      setAdminAllUsersList((prev) => [createdClientFromApi, ...prev.filter((item) => item.id !== createdClientFromApi.id)]);
      setSelectedUserId(createdClientFromApi.id);
      setAdminSelectedClient(createdClientFromApi);
      setAdminCreateUserLoading(false);
      if (canUseAdminFeatures()) {
        loadUsers().catch((error) => console.warn("Client list refresh failed:", error));
      }
    } catch (error) {
      console.error("User creation failed:", error);

      const message = error?.code === "auth/login-already-in-use" || error?.code === "auth/email-already-in-use"
        ? STATUS_LOGIN_EXISTS
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
      setAdminCreateUserLoading(false);
    }
  }

  return {
    generateAdminPassword,
    createUserFromAdminPanel
  };
}
import { fetchAuthorizedWithTimeout } from "../../utils/apiClient";
