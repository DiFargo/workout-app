import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { deleteClientEverywhereFromAdminPanelWithDeps } from "../src/features/trainer/trainerAccountAdminHandlers.js";
import { deleteClientFromTrainerPanelWithDeps } from "../src/features/trainer/trainerClientActionHandlers.js";

function createDeletionDeps(overrides = {}) {
  const calls = {
    deleted: [],
    fetches: [],
    statuses: []
  };
  const deps = {
    canUseAdminFeatures: () => true,
    showAppConfirm: async () => true,
    fetchAuthorized: async (url, options) => {
      calls.fetches.push({ url, options });
      return { ok: true, json: async () => ({ ok: true }) };
    },
    deleteClientFromAdminPanel: async (client, options) => {
      calls.deleted.push({ client, options });
    },
    setAdminClientStatus: (status) => calls.statuses.push(status),
    client: { id: "client-1", role: "client", name: "Илья" },
    ...overrides
  };

  return { calls, deps };
}

test("only an administrator can request full client deletion", async () => {
  const { calls, deps } = createDeletionDeps({ canUseAdminFeatures: () => false });

  const result = await deleteClientEverywhereFromAdminPanelWithDeps(deps);

  assert.equal(result, false);
  assert.equal(calls.fetches.length, 0);
  assert.equal(calls.deleted.length, 0);
  assert.match(calls.statuses.at(-1), /только администратору/i);
});

test("admin deletion refuses trainer and admin accounts", async () => {
  for (const role of ["trainer", "admin"]) {
    const { calls, deps } = createDeletionDeps({
      client: { id: `${role}-1`, role, name: role }
    });

    const result = await deleteClientEverywhereFromAdminPanelWithDeps(deps);

    assert.equal(result, false);
    assert.equal(calls.fetches.length, 0);
    assert.match(calls.statuses.at(-1), /только аккаунты клиентов/i);
  }
});

test("administrator deletion uses the protected endpoint and clears local client state", async () => {
  const { calls, deps } = createDeletionDeps();

  const result = await deleteClientEverywhereFromAdminPanelWithDeps(deps);

  assert.equal(result, true);
  assert.equal(calls.fetches.length, 1);
  assert.equal(calls.fetches[0].url, "/api/admin/deleteUser");
  assert.equal(calls.fetches[0].options.method, "POST");
  assert.deepEqual(JSON.parse(calls.fetches[0].options.body), { uid: "client-1" });
  assert.deepEqual(calls.deleted, [{
    client: deps.client,
    options: { skipConfirm: true, remoteDeleted: true }
  }]);
  assert.match(calls.statuses.at(-1), /Firebase Auth и Firestore/i);
});

test("failed full deletion never falls back to partial Firestore deletion", async () => {
  const { calls, deps } = createDeletionDeps({
    fetchAuthorized: async () => ({
      ok: false,
      json: async () => ({ ok: false, error: "delete failed" })
    })
  });

  const originalConsoleError = console.error;
  console.error = () => {};
  try {
    const result = await deleteClientEverywhereFromAdminPanelWithDeps(deps);
    assert.equal(result, false);
  } finally {
    console.error = originalConsoleError;
  }

  assert.equal(calls.deleted.length, 0);
  assert.match(calls.statuses.at(-1), /Не получилось завершить удаление/i);
});

test("remote admin deletion closes the client workspace without deleting Firestore twice", async () => {
  const state = {
    history: null,
    nutrition: "stale",
    pageOpen: true,
    section: "client",
    selectedClient: "client-1",
    selectedUserId: "client-1"
  };

  await deleteClientFromTrainerPanelWithDeps({
    db: null,
    auth: { currentUser: { uid: "admin-1" } },
    user: { uid: "admin-1" },
    selectedUserId: "client-1",
    canUseAdminFeatures: () => true,
    canUseTrainerFeatures: () => true,
    canManageClientProgram: () => true,
    showAppConfirm: async () => true,
    loadUsers: async () => {},
    setSelectedUserId: (value) => { state.selectedUserId = value; },
    setAdminSelectedClient: (value) => { state.selectedClient = value; },
    setAdminClientHistory: (value) => { state.history = value; },
    setAdminClientNutrition: (value) => { state.nutrition = value; },
    setAdminClientPageOpen: (value) => { state.pageOpen = value; },
    setAdminClientStatus: () => {},
    setTrainerNextSection: (value) => { state.section = value; },
    client: { id: "client-1", role: "client" },
    options: { skipConfirm: true, remoteDeleted: true }
  });

  assert.deepEqual(state, {
    history: [],
    nutrition: null,
    pageOpen: false,
    section: "clients",
    selectedClient: null,
    selectedUserId: null
  });
});

test("new trainer workspace exposes deletion only through the admin capability", async () => {
  const workspace = await readFile(new URL("../src/components/trainer/TrainerWorkspace.jsx", import.meta.url), "utf8");
  const clientsRoute = await readFile(new URL("../src/features/trainer/TrainerClientsWorkspaceRoute.jsx", import.meta.url), "utf8");
  const dashboardRoute = await readFile(new URL("../src/features/trainer/TrainerDashboardWorkspaceRoute.jsx", import.meta.url), "utf8");
  const bridge = await readFile(new URL("../src/features/trainer/trainerBridgeHandlers.js", import.meta.url), "utf8");
  const functions = await readFile(new URL("../functions/index.js", import.meta.url), "utf8");

  assert.match(clientsRoute, /canDeleteClients=\{canUseAdminFeatures\(\)\}/);
  assert.match(dashboardRoute, /canDeleteClients=\{canUseAdminFeatures\(\)\}/);
  assert.match(workspace, /canDeleteClient[\s\S]*?id: "delete", label: "Удалить клиента"/);
  assert.match(workspace, /canDeleteClients && !\["admin", "trainer"\]\.includes/);
  assert.match(bridge, /if \(action === "delete"\)[\s\S]*?deleteClientEverywhereFromAdminPanel/);
  assert.match(functions, /assertAdminContext\(context\)[\s\S]*?Only client accounts can be deleted here/);
  assert.match(functions, /collection\("loginAliases"\)\.where\("uid", "==", uid\)/);
  assert.match(functions, /collection\("trainerClients"\)\.doc\(uid\)/);
  assert.match(functions, /"admin-delete-user"[\s\S]*?limit: 50/);
});
