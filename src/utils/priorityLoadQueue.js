// A timeout is not cancellation. Slots stay occupied until the actual work
// settles; stale queued work is skipped before dispatch.
export function createPriorityLoadQueue({ concurrency = 2, backgroundConcurrency = 1 } = {}) {
  const queue = [];
  let running = 0;
  let background = 0;
  let scheduled = false;
  function pump() {
    scheduled = false;
    queue.sort((a, b) => a.priority - b.priority);
    while (running < concurrency) {
      const index = queue.findIndex(job => job.priority === 0 || background < backgroundConcurrency);
      if (index < 0) return;
      const job = queue.splice(index, 1)[0];
      if (!job.isCurrent()) { job.resolve(null); continue; }
      running += 1;
      if (job.priority > 0) background += 1;
      Promise.resolve().then(() => job.isCurrent() ? job.task() : null)
        .then(job.resolve, job.reject)
        .finally(() => {
          running -= 1;
          if (job.priority > 0) background -= 1;
          requestPump();
        });
    }
  }
  function requestPump() {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(pump);
  }
  return {
    schedule(task, { priority = 0, isCurrent = () => true } = {}) {
      return new Promise((resolve, reject) => {
        queue.push({ task, priority, isCurrent, resolve, reject });
        requestPump();
      });
    }
  };
}
