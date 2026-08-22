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

// This config exists only for Node unit tests, where Firebase services can be
// imported by pure helpers. It is deliberately not a real Firebase project and
// keeps tests from falling back to production credentials.
const testFirebaseConfig = {
  apiKey: "AIzaSyA12345678901234567890123456789012",
  authDomain: "workout-app-test.invalid",
  projectId: "workout-app-test",
  storageBucket: "workout-app-test.invalid",
  messagingSenderId: "000000000000",
  appId: "1:000000000000:web:test"
};

const runtimeEnvironment = typeof import.meta.env === "undefined" ? {} : import.meta.env;
const runtimeMode = typeof import.meta.env === "undefined" ? "test" : import.meta.env.MODE;
const runtimeIsTest = typeof import.meta.env === "undefined";
const firebaseEnvironment = String(
  runtimeEnvironment.VITE_FIREBASE_ENVIRONMENT || (runtimeMode === "production" ? "production" : "")
).trim().toLowerCase();

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

const usesBundledProductionConfig = firebaseEnvironment === "production";

if (!runtimeIsTest && usesBundledProductionConfig && runtimeMode !== "production") {
  throw new Error("Bundled production Firebase configuration is allowed only in a production build.");
}

if (!runtimeIsTest && !usesBundledProductionConfig && missingEnvironmentValues.length > 0) {
  throw new Error(`Firebase configuration is incomplete: ${missingEnvironmentValues.join(", ")}`);
}

if (!runtimeIsTest && !usesBundledProductionConfig && environmentFirebaseConfig.projectId === productionFirebaseConfig.projectId) {
  throw new Error("A non-production build cannot use the production Firebase project.");
}

const firebaseConfig = usesBundledProductionConfig
  ? productionFirebaseConfig
  : runtimeIsTest
    ? testFirebaseConfig
    : environmentFirebaseConfig;

export const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
