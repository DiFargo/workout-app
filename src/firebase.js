import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const productionFirebaseConfig = {
  apiKey: "AIzaSyBq50IlvE_e4H08hTzSkkV3FIsRMDuzowg",
  authDomain: "tren-85720.firebaseapp.com",
  projectId: "tren-85720",
  storageBucket: "tren-85720.firebasestorage.app",
  messagingSenderId: "870948637708",
  appId: "1:870948637708:web:2b99749866f761c394f229"
};

const runtimeEnvironment = typeof import.meta.env === "undefined" ? {} : import.meta.env;
const runtimeMode = typeof import.meta.env === "undefined" ? "test" : import.meta.env.MODE;
const runtimeIsDevelopment = typeof import.meta.env === "undefined" ? false : import.meta.env.DEV;

const environmentFirebaseConfig = {
  apiKey: runtimeEnvironment.VITE_FIREBASE_API_KEY,
  authDomain: runtimeEnvironment.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: runtimeEnvironment.VITE_FIREBASE_PROJECT_ID,
  storageBucket: runtimeEnvironment.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: runtimeEnvironment.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: runtimeEnvironment.VITE_FIREBASE_APP_ID
};

const missingEnvironmentValues = Object.entries(environmentFirebaseConfig)
  .filter(([, value]) => !String(value || "").trim())
  .map(([key]) => key);

if (runtimeMode === "staging" && missingEnvironmentValues.length > 0) {
  throw new Error(`Staging Firebase configuration is incomplete: ${missingEnvironmentValues.join(", ")}`);
}

const firebaseConfig = {
  apiKey: environmentFirebaseConfig.apiKey || productionFirebaseConfig.apiKey,
  authDomain: environmentFirebaseConfig.authDomain || productionFirebaseConfig.authDomain,
  projectId: environmentFirebaseConfig.projectId || productionFirebaseConfig.projectId,
  storageBucket: environmentFirebaseConfig.storageBucket || productionFirebaseConfig.storageBucket,
  messagingSenderId: environmentFirebaseConfig.messagingSenderId || productionFirebaseConfig.messagingSenderId,
  appId: environmentFirebaseConfig.appId || productionFirebaseConfig.appId
};

if (runtimeIsDevelopment && firebaseConfig.projectId === productionFirebaseConfig.projectId) {
  console.warn("Local development is connected to the production Firebase project.");
}

export const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
