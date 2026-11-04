import { useRef, useState } from "react";

export function useTrainerInviteSubmission({ credentials, loading, onSubmit }) {
  const inFlight = useRef(false);
  const completed = useRef(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function submit(event, username) {
    event?.preventDefault?.();
    if (credentials || completed.current || loading || inFlight.current) return;
    inFlight.current = true;
    setSubmitting(true);
    setError("");
    try {
      const result = await onSubmit?.(event, username);
      if (result && typeof result === "object") completed.current = true;
    } catch {
      setError("Не удалось создать приглашение. Проверь соединение и повтори попытку.");
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  }

  return { submit, submitting: loading || submitting, error };
}
