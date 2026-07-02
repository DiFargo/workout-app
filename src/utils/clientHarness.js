export function isClientE2EHarnessEnabled() {
  if (typeof window === "undefined") return false;

  const harnessRequested = new URLSearchParams(window.location.search).get("clientHarness") === "1";
  if (!harnessRequested) return false;
  if (import.meta.env.DEV) return true;

  return ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
}
