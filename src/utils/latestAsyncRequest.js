export function createLatestAsyncRequest() {
  let active = null;
  return {
    cancel() { active?.abort(); active = null; },
    start() {
      active?.abort();
      const controller = new AbortController();
      active = controller;
      return { signal: controller.signal, isCurrent: () => active === controller && !controller.signal.aborted };
    }
  };
}
