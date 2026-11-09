// Reviewed opt-in follow-up. Reuses the owned two-account creation, hard request
// budgets, durable intent and verified cleanup; never enters old AI/media tests.
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { handleTrainerClientActionWithDeps } from "../src/features/trainer/trainerClientActionHandlers.js";
import { updateAdminBasicWorkoutAccess } from "../src/utils/adminBasicWorkoutAccess.js";
import { parseBasicAccessSmokeArgs, runBasicWorkoutAccessSmoke, safeBasicAccessSmokeError } from "./smoke-basic-workout-access-release.mjs";

const check = (condition, code) => { if (!condition) throw Object.assign(new Error(code), { smokeCode: code }); };

export function runAdminBasicAccessGrantRegression(input, dependencies = {}) {
  return runBasicWorkoutAccessSmoke(input, { ...dependencies, runOwnedGrantRegression: async context => {
    const auth = { currentUser: { uid: context.administratorId } };
    const db = { app: { options: { projectId: "tren-85720" } } };
    const initial = await context.readClient();
    let selected = { id: context.clientId, role: "client", basicWorkoutAccess: false,
      assignedTrainerId: initial.fields.assignedTrainerId.stringValue };
    let users = [selected], confirmationCount = 0, status = "";
    const run = action => handleTrainerClientActionWithDeps({
      auth, db, action, adminSelectedClient: selected,
      canUseTrainerFeatures: () => true, canUseAdminFeatures: () => true, canManageClientProgram: () => true,
      showAppConfirm: async config => {
        check(typeof config.title === "string" && typeof config.confirmText === "string", "actual-confirmation-config-missing");
        confirmationCount++; return true;
      },
      saveBasicWorkoutAccess: args => updateAdminBasicWorkoutAccess({ ...args, request: context.requestAsAdmin }),
      setUsersList: updater => { users = updater(users); },
      setAdminSelectedClient: updater => { selected = updater(selected); },
      setAdminClientStatus: value => { status = value; }
    });
    await context.proveAdmin(false);
    let denied = false;
    try { await run("grant_basic_access"); } catch (error) { denied = error.code === "basic-access-permission-denied"; }
    check(denied && selected.basicWorkoutAccess === false && users[0].basicWorkoutAccess === false && /ключом/.test(status), "unproven-admin-not-denied-by-actual-handler");
    check((await context.readClient()).fields.basicWorkoutAccess?.booleanValue !== true, "unproven-grant-persisted");
    await context.pass("Реальный handler/helper: admin без proof получил отказ Rules, оптимистического доступа нет");
    await context.proveAdmin(true);
    check(await run("grant_basic_access") === true && selected.basicWorkoutAccess === true && users[0].basicWorkoutAccess === true && /открыт/.test(status), "actual-grant-handler-failed");
    const granted = await context.readClient();
    check(granted.fields.basicWorkoutAccess?.booleanValue === true && granted.fields.updatedAt?.stringValue === selected.updatedAt &&
      granted.fields.assignedTrainerId?.stringValue === initial.fields.assignedTrainerId.stringValue, "actual-grant-readback-mismatch");
    await context.pass("Реальный handler/helper: grant подтверждён сервером с updateTime, назначение не изменено");
    check(await run("revoke_basic_access") === true && selected.basicWorkoutAccess === false && users[0].basicWorkoutAccess === false && /отключён/.test(status), "actual-revoke-handler-failed");
    const revoked = await context.readClient();
    check(revoked.fields.basicWorkoutAccess?.booleanValue === false && revoked.fields.updatedAt?.stringValue === selected.updatedAt &&
      revoked.fields.assignedTrainerId?.stringValue === initial.fields.assignedTrainerId.stringValue && confirmationCount === 3, "actual-revoke-readback-mismatch");
    await context.pass("Реальный handler/helper: revoke подтверждён сервером, индивидуальное назначение сохранено");
  } });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const { report, output } = await runAdminBasicAccessGrantRegression(parseBasicAccessSmokeArgs(process.argv.slice(2)));
    console.log(JSON.stringify({ project: report.project, version: report.version, cases: report.cases.length,
      failed: report.failed === true, failedStep: report.failedStep || null, cleanupVerified: report.cleanupVerified, output }));
    if (report.failed) process.exitCode = 1;
  } catch (error) { console.error(JSON.stringify(safeBasicAccessSmokeError(error))); process.exitCode = 1; }
}
