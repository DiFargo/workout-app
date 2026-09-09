import test from "node:test";
import assert from "node:assert/strict";
import { getProgramLibraryStatusMeta } from "../src/utils/trainerProgramLibraryStatus.js";

test("library usage follows current assignments rather than stale saved status", () => {
  for (const status of ["active", "assigned", "ready"]) {
    assert.equal(getProgramLibraryStatusMeta({ lifecycleStatus: status, assignedClientIds: ["old-client"] }, 0).tone, "ready");
    assert.equal(getProgramLibraryStatusMeta({ lifecycleStatus: status }, 1).tone, "used");
  }
  assert.equal(getProgramLibraryStatusMeta({ lifecycleStatus: "draft" }, 0).id, "draft");
  assert.equal(getProgramLibraryStatusMeta({ lifecycleStatus: "archived" }, 1).id, "archived");
});
