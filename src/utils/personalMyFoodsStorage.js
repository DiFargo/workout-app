import { doc } from "firebase/firestore";
import { db } from "../firebase";

export function getPersonalMyFoodsDocRef(uid) {
  return doc(db, "users", uid, "nutrition", "myFoods");
}
