import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildTrainerUserLists, isCurrentTrainerClient } from "../src/utils/trainerUserLists.js";
import { mapWithConcurrency, MAX_TRAINER_LINKED_PROFILE_CONCURRENCY } from "../src/utils/trainerDataReadLimits.js";

test("trainer sync reuses queried profiles and reads only missing linked profiles", async () => {
  const source = await readFile(new URL("../src/features/trainer/trainerUserLoadHandlers.js", import.meta.url), "utf8");
  const body = source.slice(source.indexOf("export async function loadTrainerUsersWithDeps"), source.indexOf("export async function mirrorClientForTrainerWithDeps")).replace("export ", "");
  const snapshot = (items) => ({ forEach: (callback) => items.forEach((item) => callback({ id: item.id, data: () => item })) });
  const known = { id: "known", role: "client", trainerId: "trainer" };
  const readIds = [];
  const loader = new Function("collection", "doc", "getDoc", "getDocs", "query", "where", "buildTrainerUserLists", "isCurrentTrainerClient", "mapWithConcurrency", "MAX_TRAINER_LINKED_PROFILE_CONCURRENCY", "isPermissionDeniedError", `${body}; return loadTrainerUsersWithDeps;`)(
    (...parts) => parts.slice(1).join("/"), (...parts) => parts.slice(1).join("/"),
    async (path) => { readIds.push(path); return { exists: () => true, id: "missing", data: () => ({ role: "client", trainerId: "trainer" }) }; },
    async (path) => snapshot(path.endsWith("trainerClients") ? [{ id: "known" }, { id: "missing" }] : [known]),
    (path) => path, () => null, buildTrainerUserLists, isCurrentTrainerClient, mapWithConcurrency, MAX_TRAINER_LINKED_PROFILE_CONCURRENCY, () => false
  );
  let clients;
  const noop = () => {};
  await loader({ adminEmail: "admin@example.com", db: {}, auth: { currentUser: { uid: "trainer" } }, canUseAdminFeatures: () => false, canUseTrainerFeatures: () => true, loadTrainerClientSummaries: (items) => { clients = items; }, setAdminAllUsersList: noop, setAdminClientStatus: noop, setAdminSelectedClient: noop, setSelectedUserId: noop, setTrainerClientSummariesLoading: noop, setUsersList: noop });
  assert.deepEqual(readIds, ["users/missing"]);
  assert.deepEqual(clients.map((item) => item.id).sort(), ["known", "missing"]);
});
