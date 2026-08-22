import assert from "node:assert/strict";
import test from "node:test";

import { getUnsafeVoiceFoodStems, isUnsafeVoiceFoodQuery } from "../functions/voiceFoodSafety.js";

test("voice search rejects impossible or spoiled food phrases in Russian", () => {
  for (const [transcript, rejectedQuery] of [
    ["каменная курица", "курица"],
    ["каменая курица", "куриная грудка"],
    ["гнилая курица", "курица"],
    ["протухшая рыба", "рыба"]
  ]) {
    const unsafeStems = getUnsafeVoiceFoodStems(transcript);
    assert.ok(unsafeStems.size > 0, transcript);
    assert.equal(isUnsafeVoiceFoodQuery(rejectedQuery, unsafeStems), true, transcript);
  }
});

test("voice search keeps ordinary foods that were not marked unsafe", () => {
  const unsafeStems = getUnsafeVoiceFoodStems("каменная курица и банан");

  assert.equal(isUnsafeVoiceFoodQuery("куриная грудка", unsafeStems), true);
  assert.equal(isUnsafeVoiceFoodQuery("банан", unsafeStems), false);
  assert.equal(isUnsafeVoiceFoodQuery("каменная соль", unsafeStems), false);
});
