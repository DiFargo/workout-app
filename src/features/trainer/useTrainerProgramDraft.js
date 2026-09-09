import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createTrainerPlanEditorHandlers } from "./trainerPlanEditorHandlers";
import { createTrainerWorkspaceHandlers } from "./trainerWorkspaceHandlers";
import { createProgramDraft, isProgramDraftDirty } from "../../utils/trainerProgramDraft.js";

export function useTrainerProgramDraft({ open, client, workouts, completedWorkoutIds = [], exerciseLibrary, onStatus }) {
  const [draft, setDraft] = useState(() => open ? createProgramDraft(workouts, client) : null);
  const [uploadingId, setUploadingId] = useState("");
  const session = useRef(null);
  useLayoutEffect(() => {
    if (open) {
      const initial = createProgramDraft(workouts, client);
      initial.sessionId = Symbol("editor-session");
      initial.completedWorkoutIds = completedWorkoutIds;
      session.current = initial;
      // Capture before paint so the editor never displays another client's draft.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDraft(initial);
    } else {
      session.current = null;
      setDraft(null);
    }
    return () => { session.current = null; };
    // A draft owns the snapshot taken at opening, never a later background refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, client.id]);
  const dirty = isProgramDraftDirty(draft);
  useEffect(() => {
    if (!open || !dirty) return;
    const guard = (event) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [open, dirty]);
  const currentSession = draft?.sessionId;
  // The factory only captures setPlan; this ref guard runs on a later edit/upload.
  // eslint-disable-next-line react-hooks/refs
  const handlers = createTrainerPlanEditorHandlers({
    plan: draft?.plan,
    setPlan: (update) => {
      if (!currentSession || session.current?.sessionId !== currentSession) return;
      setDraft((current) => current ? { ...current, plan: typeof update === "function" ? update(current.plan) : update } : current);
    },
    saveWorkoutsToFirebase: async () => true,
    trainerExerciseLibraryItems: exerciseLibrary || [],
    selectedUserId: client.id,
    auth: {},
    setAdminExerciseVideoUploadingId: setUploadingId,
    setAdminClientStatus: onStatus,
    draftOnly: true
  });
  return {
    draft, dirty, uploadingId,
    rename: (name) => setDraft((current) => current ? { ...current, plan: { ...current.plan, assignedProgramName: name } } : current),
    handlers: createTrainerWorkspaceHandlers({ ...handlers, setAdminClientStatus: onStatus }),
    markSaved: (result) => setDraft((current) => current ? { ...current, plan: result?.plan || current.plan, baseline: structuredClone(result?.plan || current.plan), revision: current.revision + 1 } : current)
  };
}
