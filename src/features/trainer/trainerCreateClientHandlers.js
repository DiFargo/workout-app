import { deleteApp, initializeApp } from "firebase/app";
import { createUserWithEmailAndPassword, getAuth, signOut } from "firebase/auth";
import { doc, getFirestore, setDoc } from "firebase/firestore";

const STATUS_NO_ACCESS = "\u0421\u043e\u0437\u0434\u0430\u0432\u0430\u0442\u044c \u043a\u043b\u0438\u0435\u043d\u0442\u043e\u0432 \u043c\u043e\u0436\u0435\u0442 \u0442\u043e\u043b\u044c\u043a\u043e \u0430\u0434\u043c\u0438\u043d \u0438\u043b\u0438 \u0442\u0440\u0435\u043d\u0435\u0440.";
const STATUS_EMAIL_REQUIRED = "\u0412\u0432\u0435\u0434\u0438 \u043a\u043e\u0440\u0440\u0435\u043a\u0442\u043d\u044b\u0439 email \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044f.";
const STATUS_PASSWORD_SHORT = "\u041f\u0430\u0440\u043e\u043b\u044c \u0434\u043e\u043b\u0436\u0435\u043d \u0431\u044b\u0442\u044c \u043c\u0438\u043d\u0438\u043c\u0443\u043c 6 \u0441\u0438\u043c\u0432\u043e\u043b\u043e\u0432.";
const STATUS_CLIENT_CREATED = "\u041a\u043b\u0438\u0435\u043d\u0442 \u0441\u043e\u0437\u0434\u0430\u043d \u2705";
const STATUS_CLIENT_CREATED_FOR_TRAINER = "\u041a\u043b\u0438\u0435\u043d\u0442 \u0441\u043e\u0437\u0434\u0430\u043d \u0438 \u043f\u0440\u0438\u0432\u044f\u0437\u0430\u043d \u043a \u0442\u0440\u0435\u043d\u0435\u0440\u0443 \u2705";
const STATUS_EMAIL_EXISTS = "\u041f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044c \u0441 \u0442\u0430\u043a\u0438\u043c email \u0443\u0436\u0435 \u0441\u0443\u0449\u0435\u0441\u0442\u0432\u0443\u0435\u0442.";
const STATUS_WEAK_PASSWORD = "\u041f\u0430\u0440\u043e\u043b\u044c \u0441\u043b\u0438\u0448\u043a\u043e\u043c \u0441\u043b\u0430\u0431\u044b\u0439. \u041d\u0443\u0436\u043d\u043e \u043c\u0438\u043d\u0438\u043c\u0443\u043c 6 \u0441\u0438\u043c\u0432\u043e\u043b\u043e\u0432.";
const STATUS_PROFILE_PERMISSION_DENIED = "\u041a\u043b\u0438\u0435\u043d\u0442 \u0441\u043e\u0437\u0434\u0430\u043d \u0432 Auth, \u043d\u043e \u043f\u0440\u043e\u0444\u0438\u043b\u044c \u043d\u0435 \u0437\u0430\u043f\u0438\u0441\u0430\u043b\u0441\u044f \u0432 Firestore. \u041d\u0443\u0436\u043d\u043e \u0440\u0430\u0437\u0440\u0435\u0448\u0438\u0442\u044c \u0442\u0440\u0435\u043d\u0435\u0440\u0443 \u0437\u0430\u043f\u0438\u0441\u044c users/{clientId}.";
const STATUS_CREATE_FAILED = "\u041d\u0435 \u043f\u043e\u043b\u0443\u0447\u0438\u043b\u043e\u0441\u044c \u0441\u043e\u0437\u0434\u0430\u0442\u044c \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044f. \u041f\u0440\u043e\u0432\u0435\u0440\u044c email/\u043f\u0430\u0440\u043e\u043b\u044c \u0438 Firebase Auth.";

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
    const password = adminNewUserPassword.trim();
    const displayName = adminNewUserName.trim();

    if (!email || !email.includes("@")) {
      setAdminCreateUserStatus(STATUS_EMAIL_REQUIRED);
      return;
    }

    if (!password || password.length < 6) {
      setAdminCreateUserStatus(STATUS_PASSWORD_SHORT);
      return;
    }

    setAdminCreateUserLoading(true);
    setAdminCreateUserStatus("");
    setAdminCreatedCredentials(null);

    let secondaryApp = null;

    try {
      secondaryApp = initializeApp(auth.app.options, `admin-create-user-${Date.now()}`);
      const secondaryAuth = getAuth(secondaryApp);
      const secondaryDb = getFirestore(secondaryApp);
      const credential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
      const createdUser = credential.user;

      const currentTrainerEmail = String(auth.currentUser?.email || user?.email || "").toLowerCase();
      const currentTrainerId = auth.currentUser?.uid || user?.uid || "";
      const createdAt = new Date().toISOString();
      const isTrainerCreator = currentUserRole === "trainer" && !canUseAdminFeatures();

      const clientPayload = {
        email,
        name: displayName || email.split("@")[0],
        role: "client",
        assignedProgramId: "",
        assignedProgramName: "",
        createdAt,
        updatedAt: createdAt,
        createdBy: currentTrainerEmail || ADMIN_EMAIL,
        createdByEmail: currentTrainerEmail || ADMIN_EMAIL,
        createdByUid: currentTrainerId || "",
        ...(isTrainerCreator ? {
          trainerId: currentTrainerId,
          assignedTrainerId: currentTrainerId,
          coachId: currentTrainerId,
          trainerEmail: currentTrainerEmail,
          assignedTrainerEmail: currentTrainerEmail,
          coachEmail: currentTrainerEmail
        } : {})
      };

      let savedClientProfile = false;

      try {
        await setDoc(doc(db, "users", createdUser.uid), clientPayload, { merge: true });
        savedClientProfile = true;
      } catch (primaryWriteError) {
        console.warn("Primary user profile write failed, trying secondary user context:", primaryWriteError);
      }

      if (!savedClientProfile) {
        await setDoc(doc(secondaryDb, "users", createdUser.uid), clientPayload, { merge: true });
      }

      if (currentTrainerId) {
        const trainerClientLink = {
          clientId: createdUser.uid,
          uid: createdUser.uid,
          email,
          name: displayName || email.split("@")[0],
          role: "client",
          trainerId: currentTrainerId,
          trainerEmail: currentTrainerEmail,
          assignedTrainerId: currentTrainerId,
          assignedTrainerEmail: currentTrainerEmail,
          createdAt,
          updatedAt: createdAt
        };

        try {
          await setDoc(doc(db, "users", currentTrainerId, "trainerClients", createdUser.uid), trainerClientLink, { merge: true });
        } catch (trainerLinkError) {
          console.warn("Trainer client link write failed:", trainerLinkError);
        }
      }

      await signOut(secondaryAuth);

      const createdClient = {
        id: createdUser.uid,
        ...clientPayload
      };

      setAdminCreatedCredentials({
        email,
        password,
        name: displayName || email.split("@")[0]
      });

      setAdminNewUserName("");
      setAdminNewUserEmail("");
      setAdminNewUserPassword("");
      setAdminCreateUserStatus(isTrainerCreator ? STATUS_CLIENT_CREATED_FOR_TRAINER : STATUS_CLIENT_CREATED);
      setUsersList((prev) => [createdClient, ...prev.filter((item) => item.id !== createdClient.id)]);
      setAdminAllUsersList((prev) => [createdClient, ...prev.filter((item) => item.id !== createdClient.id)]);
      setSelectedUserId(createdClient.id);
      setAdminSelectedClient(createdClient);

      if (canUseAdminFeatures()) {
        await loadUsers();
      }
    } catch (error) {
      console.error("User creation failed:", error);

      const message = error?.code === "auth/email-already-in-use"
        ? STATUS_EMAIL_EXISTS
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
