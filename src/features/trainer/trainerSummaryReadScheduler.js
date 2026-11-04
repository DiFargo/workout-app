// Hold a slot until the actual SDK promise settles, not merely until a UI
// deadline expires. Repeated/superseded runs share this per-auth ceiling.
export const MAX_TRAINER_SUMMARY_SOURCE_READS = 6;
export const TRAINER_INITIAL_SUMMARY_PAGE_SIZE = 20;
const schedulers = new WeakMap();

export function scheduleTrainerSummaryRead(auth, read, isCurrent) {
  let scheduler = schedulers.get(auth);
  if (!scheduler) {
    scheduler = { active: 0, queue: [] };
    schedulers.set(auth, scheduler);
  }
  const stale = () => Object.assign(new Error("Чтение сводки больше не требуется"), { code: "summary/superseded" });
  const drain = () => {
    while (scheduler.active < MAX_TRAINER_SUMMARY_SOURCE_READS && scheduler.queue.length) {
      const job = scheduler.queue.shift();
      if (!job.isCurrent()) { job.reject(stale()); continue; }
      scheduler.active += 1;
      Promise.resolve().then(() => {
        if (!job.isCurrent()) throw stale();
        return job.read();
      }).then(job.resolve, job.reject).finally(() => {
        scheduler.active -= 1;
        drain();
      });
    }
  };
  return new Promise((resolve, reject) => {
    scheduler.queue.push({ read, isCurrent, resolve, reject });
    drain();
  });
}
