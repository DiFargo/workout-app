export function isClientE2EHarnessEnabled() {
  return import.meta.env.DEV &&
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("clientHarness") === "1";
}
