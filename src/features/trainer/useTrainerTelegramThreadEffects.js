import { useEffect } from "react";
import { collection, doc, limit, onSnapshot, orderBy, query, updateDoc } from "firebase/firestore";

const THREAD_TYPES = new Set(["manual", "incoming"]);

export function useTrainerTelegramThreadEffects({
  db,
  auth,
  adminClientPageOpen,
  selectedClientId,
  setAdminClientTelegramMessages
}) {
  useEffect(() => {
    if (!adminClientPageOpen || !selectedClientId) {
      setAdminClientTelegramMessages([]);
      return undefined;
    }

    const messagesQuery = query(
      collection(db, "users", selectedClientId, "telegramMessages"),
      orderBy("sentAt", "asc"),
      limit(200)
    );

    return onSnapshot(
      messagesQuery,
      (snapshot) => {
        const messages = snapshot.docs
          .map((docSnapshot) => ({ id: docSnapshot.id, ...docSnapshot.data() }))
          .filter((message) => THREAD_TYPES.has(message.type));

        setAdminClientTelegramMessages(messages);

        const trainerUid = auth.currentUser?.uid || "";
        const unreadIncoming = messages.filter((message) => (
          message.type === "incoming" &&
          message.direction === "in" &&
          !message.trainerReadAt
        ));

        if (trainerUid && unreadIncoming.length) {
          const trainerReadAt = new Date().toISOString();
          Promise.allSettled(unreadIncoming.map((message) => updateDoc(
            doc(db, "users", selectedClientId, "telegramMessages", message.id),
            { trainerReadAt, trainerReadByUid: trainerUid }
          ))).then((results) => {
            if (results.some((result) => result.status === "rejected")) {
              console.warn("Unable to mark one or more trainer messages as read.");
            }
          });
        }
      },
      (error) => console.warn("Telegram thread subscription error", error)
    );
  }, [adminClientPageOpen, auth, db, selectedClientId, setAdminClientTelegramMessages]);
}
