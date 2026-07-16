import test from "node:test";
import assert from "node:assert/strict";

import { getTrainerClientMessageResolvedIds } from "../src/utils/trainerClientMessageResolution.js";

test("resolved client message ids combine successful linked replies and resolution events", () => {
  const resolvedIds = getTrainerClientMessageResolvedIds({
    telegramMessages: [
      { status: "sent", sourceCommentId: "comment-sent" },
      { status: " saved ", replyContext: { sourceCommentId: "comment-saved" } },
      { status: "DELIVERED", replyContext: { sourceCommentIds: ["comment-delivered", "duplicate"] } },
      { status: "read", sourceCommentId: "duplicate" },
      { status: "processed", replyContext: { sourceCommentId: "comment-no-reply" } }
    ],
    trainerEvents: [
      {
        type: "client_message_resolution",
        details: { sourceCommentId: "event-object" }
      },
      {
        type: " client_message_resolution ",
        details: JSON.stringify({ sourceCommentIds: ["event-json-1", "event-json-2", "duplicate"] })
      },
      {
        type: "client_message_resolution",
        sourceCommentId: "event-direct"
      }
    ]
  });

  assert.deepEqual([...resolvedIds].sort(), [
    "comment-delivered",
    "comment-no-reply",
    "comment-saved",
    "comment-sent",
    "duplicate",
    "event-direct",
    "event-json-1",
    "event-json-2",
    "event-object"
  ]);
});

test("unrelated, unsuccessful and malformed records are ignored", () => {
  const resolvedIds = getTrainerClientMessageResolvedIds({
    telegramMessages: [
      { status: "sending", sourceCommentId: "still-sending" },
      { status: "error", replyContext: { sourceCommentId: "failed" } },
      { status: "sent" },
      { status: "read", sourceCommentId: "  " },
      { status: "read", sourceCommentIds: [null, 7, {}, "valid-read"] },
      null,
      "not-a-message"
    ],
    trainerEvents: [
      { type: "other_event", sourceCommentId: "unrelated" },
      { type: "client_message_resolution", details: "not-json" },
      { type: "client_message_resolution", details: JSON.stringify(["not-an-object"]) },
      { type: "client_message_resolution", details: { sourceCommentIds: "not-an-array" } },
      { type: "client_message_resolution", details: { sourceCommentIds: ["", null, 4] } },
      null
    ]
  });

  assert.deepEqual([...resolvedIds], ["valid-read"]);
});

test("invalid collection inputs return an empty Set", () => {
  const resolvedIds = getTrainerClientMessageResolvedIds({
    telegramMessages: { status: "sent", sourceCommentId: "wrong-shape" },
    trainerEvents: "wrong-shape"
  });

  assert.equal(resolvedIds instanceof Set, true);
  assert.equal(resolvedIds.size, 0);
  assert.equal(getTrainerClientMessageResolvedIds().size, 0);
});
