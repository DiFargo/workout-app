export function isAdminE2EHarnessEnabled() {
  if (typeof window === "undefined") return false;

  return new URLSearchParams(window.location.search).get("adminHarness") === "1" &&
    (import.meta.env.DEV || ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname));
}
