export function isTrainerE2EHarnessEnabled() {
  return import.meta.env.DEV &&
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("trainerHarness") === "1";
}
