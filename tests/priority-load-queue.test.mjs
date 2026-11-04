import test from "node:test";
import assert from "node:assert/strict";
import { createPriorityLoadQueue } from "../src/utils/priorityLoadQueue.js";

const flush = () => new Promise(resolve => setImmediate(resolve));
test("foreground work outranks queued background work, with one reserved slot", async () => {
  const queue = createPriorityLoadQueue();
  const starts = [];
  let release;
  const background = queue.schedule(() => new Promise(resolve => { starts.push("background"); release = resolve; }), { priority: 1 });
  const second = queue.schedule(() => { starts.push("second-background"); }, { priority: 1 });
  const foreground = queue.schedule(() => { starts.push("foreground"); });
  await foreground;
  await flush();
  assert.deepEqual(starts, ["foreground", "background"]);
  release();
  await Promise.all([background, second]);
  assert.deepEqual(starts, ["foreground", "background", "second-background"]);
});

test("obsolete queued work is skipped before I/O and errors release a slot", async () => {
  const queue = createPriorityLoadQueue({ concurrency: 1 });
  let active = true, release;
  const first = queue.schedule(() => new Promise(resolve => { release = resolve; }));
  const stale = queue.schedule(() => { throw new Error("must not dispatch"); }, { isCurrent: () => active });
  await flush();
  active = false;
  release();
  await first;
  assert.equal(await stale, null);
  await assert.rejects(queue.schedule(() => { throw new Error("network"); }), /network/);
  assert.equal(await queue.schedule(() => "recovered"), "recovered");
});
