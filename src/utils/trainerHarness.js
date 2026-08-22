export function isTrainerE2EHarnessEnabled() {
  if (typeof window === "undefined") return false;

  return new URLSearchParams(window.location.search).get("trainerHarness") === "1" &&
    (import.meta.env.DEV || ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname));
}
