import assert from "node:assert/strict";
import test from "node:test";

import { handleTrainerClientActionWithDeps } from "../src/features/trainer/trainerClientActionHandlers.js";

function createDeps(overrides = {}) {
  const statuses = [];
  const events = [];
  const eventResult = { id: "message-resolution-event" };

  return {
    statuses,
    events,
    eventResult,
    deps: {
      adminSelectedClient: { id: "client-1" },
      canUseTrainerFeatures: () => true,
      canUseAdminFeatures: () => true,
      canManageClientProgram: () => true,
      setAdminClientStatus: (status) => statuses.push(status),
      recordTrainerEvent: async (...args) => {
        events.push(args);
        return eventResult;
      },
      ...overrides
    }
  };
}

test("resolve_client_messages records deduplicated source comments as handled without reply", async () => {
  const { deps, statuses, events, eventResult } = createDeps();

  const result = await handleTrainerClientActionWithDeps({
    ...deps,
    action: "resolve_client_messages",
    payload: {
      sourceCommentIds: [" comment-1 ", "comment-2", "comment-1", "", null]
    }
  });

  assert.equal(result, eventResult);
  assert.deepEqual(events, [[
    "client-1",
    "client_message_resolution",
    "Сообщения обработаны без ответа: 2",
    JSON.stringify({
      sourceCommentIds: ["comment-1", "comment-2"],
      decision: "handled_without_reply"
    })
  ]]);
  assert.equal(statuses.at(-1), "Сообщения отмечены обработанными: 2.");
});

test("resolve_client_messages accepts one sourceCommentId and rejects an empty payload", async () => {
  const accepted = createDeps();
  const acceptedResult = await handleTrainerClientActionWithDeps({
    ...accepted.deps,
    action: "resolve_client_messages",
    payload: { sourceCommentId: " single-comment " }
  });

  assert.equal(acceptedResult, accepted.eventResult);
  assert.deepEqual(
    JSON.parse(accepted.events[0][3]),
    { sourceCommentIds: ["single-comment"], decision: "handled_without_reply" }
  );
  assert.equal(accepted.statuses.at(-1), "Сообщение отмечено обработанным.");

  const rejected = createDeps();
  const rejectedResult = await handleTrainerClientActionWithDeps({
    ...rejected.deps,
    action: "resolve_client_messages",
    payload: { sourceCommentIds: [" ", null] }
  });

  assert.equal(rejectedResult, false);
  assert.equal(rejected.events.length, 0);
  assert.equal(rejected.statuses.at(-1), "Не удалось определить сообщения для обработки.");
});
