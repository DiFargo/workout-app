import { APP_PAGES, APP_PAGE_GROUPS, DEFAULT_APP_PAGE } from "./appPages";

const APP_PAGE_SET = new Set(Object.values(APP_PAGES));

export function normalizeAppPage(page) {
  if (typeof page !== "string") {
    return DEFAULT_APP_PAGE;
  }

  return APP_PAGE_SET.has(page) ? page : DEFAULT_APP_PAGE;
}

export function isClientCorePage(page) {
  return APP_PAGE_GROUPS.CLIENT_CORE.includes(page);
}

export function isClientPrimaryPage(page) {
  return isClientCorePage(page);
}

export function isClientWorkflowPage(page) {
  return APP_PAGE_GROUPS.CLIENT_WORKFLOW.includes(page);
}

export function isTrainerForbiddenClientPage(page) {
  return (
    APP_PAGE_GROUPS.CLIENT_CORE.includes(page) ||
    APP_PAGE_GROUPS.CLIENT_WORKFLOW.includes(page) ||
    page === APP_PAGES.AI_COACH
  );
}

export function isTrainerWorkspacePage(page) {
  return APP_PAGE_GROUPS.TRAINER.includes(page);
}

export function isAdminWorkspacePage(page) {
  return APP_PAGE_GROUPS.ADMIN.includes(page);
}
