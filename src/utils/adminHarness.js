export function isAdminE2EHarnessEnabled() {
  return import.meta.env.DEV &&
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("adminHarness") === "1";
}
