import { captureAuthSession } from "../utils/authSession.js";

export function deferredHandlerFactory(load, factoryName, methods) {
  let modulePromise;
  return context => Object.fromEntries(methods.map(method => [method, async (...args) => {
    const session = captureAuthSession(context.auth);
    if (!session.isCurrent()) return null;
    if (!modulePromise) modulePromise = load().catch(error => { modulePromise = null; throw error; });
    const module = await modulePromise;
    if (!session.isCurrent()) return null;
    return module[factoryName](context)[method](...args);
  }]));
}

// Only factories whose public methods are already asynchronous live here.
// Synchronous navigation, file-picker gestures and resets stay in their owner.
export const createTrainerClientOverviewLoader = deferredHandlerFactory(
  () => import("../features/trainer/trainerClientOverviewLoader.js"),
  "createTrainerClientOverviewLoader", ["loadAdminClientOverview"]);
export const createTrainerClientSummaryLoader = deferredHandlerFactory(
  () => import("../features/trainer/trainerClientSummaryLoader.js"),
  "createTrainerClientSummaryLoader", ["loadTrainerClientSummaries"]);
const createDeferredTrainerProgramTemplateHandlers = deferredHandlerFactory(
  () => import("../features/trainer/trainerProgramTemplateHandlers.js"),
  "createTrainerProgramTemplateHandlers", ["loadAdminTrainingTemplates", "createAdminTemplateFromCurrentPlan",
    "assignAdminTemplateToClient", "clearClientProgram", "assignSavedProgramToClient", "archiveClientProgramAssignment",
    "restoreClientProgramAssignment", "deleteClientProgramAssignment", "renameClientProgramAssignment", "copyCurrentProgramToClient"]);

// A failed JS import happens before the data loader can publish its state.
// Track that first phase too, without letting an older retry/session win.
export function createTrainerLibraryLoadHandler(context, load) {
  return async (...args) => {
    const session = captureAuthSession(context.auth);
    if (!session.isCurrent()) return null;
    const requestToken = {};
    context.setTrainerLibraryLoadState?.((previous) => {
      if (!session.isCurrent()) return previous;
      const sameSession = Boolean(previous?.session?.isCurrent());
      return {
        session, requestToken, templates: "loading", cards: "loading",
        templatesKnown: sameSession && Boolean(previous.templatesKnown),
        cardsKnown: sameSession && Boolean(previous.cardsKnown)
      };
    });
    try {
      return await load(...args);
    } catch (error) {
      context.setTrainerLibraryLoadState?.((previous) => {
        if (!session.isCurrent() || previous?.requestToken !== requestToken) return previous;
        return { ...previous, templates: "error", cards: "error" };
      });
      if (session.isCurrent()) console.warn("Trainer library module load failed:", error);
      return null;
    }
  };
}

export function createTrainerProgramTemplateHandlers(context) {
  const handlers = createDeferredTrainerProgramTemplateHandlers(context);
  return { ...handlers, loadAdminTrainingTemplates: createTrainerLibraryLoadHandler(context, handlers.loadAdminTrainingTemplates) };
}
