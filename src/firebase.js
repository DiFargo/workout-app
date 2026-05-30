import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyBq50IlvE_e4H08hTzSkkV3FIsRMDuzowg",
  authDomain: "tren-85720.firebaseapp.com",
  projectId: "tren-85720",
  storageBucket: "tren-85720.firebasestorage.app",
  messagingSenderId: "870948637708",
  appId: "1:870948637708:web:2b99749866f761c394f229"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
