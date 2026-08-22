import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";

import { db } from "../../../firebase";
import { normalizeBasicWorkoutExerciseOverrides } from "../../../utils/basicWorkoutExercisePresentation.js";

const EMPTY_OVERRIDES = Object.freeze({});

let cachedOverrides = null;
let pendingOverridesRequest = null;

async function loadBasicWorkoutExerciseOverrides() {
  if (cachedOverrides) return cachedOverrides;

  if (!pendingOverridesRequest) {
    pendingOverridesRequest = getDocs(collection(db, "basicExerciseOverrides"))
      .then((snapshot) => {
        const records = {};
        snapshot.forEach((item) => {
          records[item.id] = item.data();
        });
        cachedOverrides = normalizeBasicWorkoutExerciseOverrides(records);
        return cachedOverrides;
      })
      .catch(() => EMPTY_OVERRIDES)
      .finally(() => {
        pendingOverridesRequest = null;
      });
  }

  return pendingOverridesRequest;
}

// Shared read-through cache avoids a Firestore request for every exercise slide.
// A read failure is deliberately non-blocking: the original exercise material
// stays available and the workout itself can continue offline.
export function useBasicWorkoutExerciseOverrides(enabled = true) {
  const [overrides, setOverrides] = useState(() => cachedOverrides || EMPTY_OVERRIDES);

  useEffect(() => {
    let active = true;

    if (!enabled) return () => {
      active = false;
    };

    loadBasicWorkoutExerciseOverrides().then((nextOverrides) => {
      if (active) setOverrides(nextOverrides);
    });

    return () => {
      active = false;
    };
  }, [enabled]);

  return overrides;
}

