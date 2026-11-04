/**
 * Local, fixture-only visual inventory. Run ONLY after the production release:
 *   AUDIT_BASE_URL=http://127.0.0.1:4186 node scripts/capture-telegram-visual-audit.mjs --after-deploy
 * Optional: AUDIT_BROWSER=chromium, --only=trainer-, --limit=40, --overwrite.
 * Retry only failed/unattempted screens with the SAME options: --after-deploy --retry-failed.
 * No production browser/session is used. Telegram SDK and safe areas are mocks,
 * not a real Telegram WebView; native chrome and the OS keyboard are not rendered.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, webkit, expect } from "@playwright/test";

const args = process.argv.slice(2);
const option = (name, fallback) => args.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3) || fallback;
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const version = JSON.parse(await readFile(resolve(root, "package.json"), "utf8")).version;
const browserName = process.env.AUDIT_BROWSER || "webkit";
if (!["webkit", "chromium"].includes(browserName)) throw new Error("AUDIT_BROWSER must be webkit or chromium.");
const output = resolve(root, `artifacts/telegram-visual-audit-${version}`, browserName === "webkit" ? "." : browserName);
const baseURL = new URL(process.env.AUDIT_BASE_URL || "http://127.0.0.1:4186");
if (!["localhost", "127.0.0.1", "[::1]"].includes(baseURL.hostname)) throw new Error("Only a local isolated Vite fixture server is allowed.");
if (!args.includes("--after-deploy")) throw new Error("Capture is gated: pass --after-deploy only AFTER production deployment is verified.");
if (relative(root, output).startsWith("..")) throw new Error("Output must remain inside the workspace.");
const limit = Math.min(80, Math.max(1, Number(option("limit", "80")) || 80));
const only = option("only", "");
const fixedTime = "2026-10-17T12:00:00.000Z";
const primary = { id: "iphone-17-pro", width: 402, height: 874, deviceScaleFactor: 3 };
const narrow = { id: "small-phone", width: 320, height: 720, deviceScaleFactor: 3 };
const landscape = { id: "landscape", width: 844, height: 390, deviceScaleFactor: 3 };
const selectors = { client: '[data-testid^="client-harness-"]', trainer: ".trainerNextRoot", admin: '[data-testid="admin-harness-root"]' };

async function visible(locator) { await expect(locator.first()).toBeVisible({ timeout: 15000 }); return locator.first(); }
async function click(locator) { await (await visible(locator)).click(); }
async function go(page, url) { await page.goto(new URL(url, baseURL).href, { waitUntil: "domcontentloaded", timeout: 45000 }); }
const id = (value) => `[data-testid="${value}"]`;
const role = (page, name, type = "button") => page.getByRole(type, { name, exact: true });
const clientURL = (page = "", extra = "") => `/?clientHarness=1&clientHarnessTheme=warm-light${page ? `&clientHarnessPage=${page}` : ""}${extra}`;

async function clientTab(page, tab) {
  await go(page, clientURL());
  await visible(page.locator(id("client-harness-main")));
  if (tab !== "main") await click(page.getByTestId(`client-nav-${tab}`));
}
async function trainerNav(page, section) {
  await visible(page.locator(selectors.trainer));
  const mobile = page.getByTestId(`trainer-nav-${section}`);
  await click(await mobile.isVisible() ? mobile : page.getByTestId(`trainer-desktop-nav-${section}`));
}
async function trainerClient(page, tab = "Сводка") {
  await go(page, "/v2?trainerHarness=1");
  await trainerNav(page, "clients");
  await click(page.locator(".trainerNextClientTable > button"));
  await visible(page.locator(".trainerNextClientPage:not([aria-busy=true])"));
  const automaticNutrition = page.locator('[data-trainer-modal-surface="true"]').filter({ has: page.locator("#trainer-nutrition-plan-modal-title") });
  if (await automaticNutrition.isVisible()) await click(automaticNutrition.locator(".trainerNextModalClose"));
  const mobileTabs = page.locator(".trainerNextClientMobileNav");
  const mobile = await mobileTabs.isVisible();
  const tabControl = (mobile ? mobileTabs : page.locator(".trainerNextClientTabs")).getByRole("button", { name: tab, exact: true });
  await click(tabControl);
  if (tab === "Питание") await expect(automaticNutrition).toHaveCount(0);
  else if (await automaticNutrition.isVisible()) await click(automaticNutrition.locator(".trainerNextModalClose"));
  await expect(tabControl).toHaveAttribute(mobile ? "aria-current" : "aria-pressed", mobile ? "page" : "true");
}
async function trainerEditor(page, threeSets = false) {
  await trainerClient(page, "Тренировки");
  await click(page.locator(".trainerClientProgramEditButton"));
  const editor = page.getByRole("dialog", { name: "Редактор программы клиента", exact: true });
  await visible(editor);
  if (!threeSets) return;
  const days = editor.getByRole("combobox", { name: "День программы", exact: true });
  if (await days.isVisible()) await days.selectOption({ index: 2 });
  else await click(editor.getByRole("button", { name: /^День 3 / }));
  await click(editor.getByRole("button", { name: "Редактировать упражнение", exact: true }));
  const sheet = page.getByRole("dialog", { name: "Настройки упражнения", exact: true });
  await visible(sheet);
  for (let sets = await sheet.locator(".trainerNextSetRow").count(); sets < 3; sets += 1) await click(sheet.locator(".trainerNextAddSet"));
  await expect(sheet.locator(".trainerNextSetRow")).toHaveCount(3);
}
async function adminWorkspace(page, section = "") {
  await go(page, "/tests/e2e/fixtures/admin-workspace.html");
  // This standalone component fixture bypasses AppCore's token import; the
  // real application loads this exact stylesheet before rendering its routes.
  await page.addStyleTag({ url: new URL("/src/styles/_variables.css", baseURL).href });
  await visible(page.getByTestId("admin-workspace-harness"));
  if (section) await click(page.getByRole("button", { name: section, exact: true }).filter({ visible: true }));
}

const cases = [];
function add(key, title, prepare, expected, extra = {}) { cases.push({ key, title, prepare, expected, ...extra }); }
function clientPage(key, title, page, expected, extra = "") {
  add(key, title, (browserPage) => go(browserPage, clientURL(page, extra)), expected);
}
for (const [tab, title] of [["main", "Сегодня"], ["workouts", "Тренировки"], ["nutrition", "Питание"], ["progress", "Прогресс"], ["cabinet", "Кабинет"]]) {
  add(`client-${tab}`, title, (page) => clientTab(page, tab), id(`client-harness-${tab}`));
}
add("auth-login", "Вход по приглашению", async (page) => {
  await go(page, "/");
  await click(page.getByRole("button", { name: "У меня есть логин и пароль", exact: true }));
}, (page) => role(page, "Вход по логину и паролю", "heading"), { telegram: false });
add("auth-email-registration", "Регистрация по email", async (page) => {
  await go(page, "/");
  await click(page.getByRole("button", { name: "Новый пользователь? Создать аккаунт", exact: true }));
}, (page) => role(page, "Регистрация по email", "heading"), { telegram: false });
add("auth-browser-telegram", "Приглашение из браузера в Telegram", (page) => go(page, "/?telegramInvite=visual_audit_fixture_token_1234567890"),
  (page) => role(page, "Открыть приглашение в Telegram", "link"), { telegram: false });
for (let step = 0; step <= 9; step += 1) {
  clientPage(`onboarding-${step}`, `Опросник: шаг ${step}`, "firstSetup", id("first-setup-onboarding"), `&clientFirstSetupStep=${step}`);
  cases.at(-1).verify = async (page) => {
    if (step > 0) await expect(page.getByTestId("first-setup-card")).toHaveAttribute("data-step", String(step));
    else await visible(role(page, "Начать"));
  };
}
for (const [page, key, title, rootId] of [
  ["workoutPlan", "plan", "План тренировок", "workout-plan"],
  ["workoutHistory", "history", "История тренировок", "workout-history"],
  ["workoutMode", "mode", "Выбор режима", "workout-mode"],
  ["basicQuiz", "basic-quiz", "Базовая программа: опросник", "basic-quiz"],
  ["basicWorkoutToday", "basic-today", "Базовая тренировка сегодня", "basic-workout-today"]
]) {
  clientPage(`workout-${key}`, title, page, id(`client-harness-${rootId}`));
  if (key === "basic-quiz") {
    cases.at(-1).prepare = async browserPage => {
      await go(browserPage, clientURL(page));
      await browserPage.getByRole("textbox", { name: "Код доступа", exact: true }).fill("1111");
      await click(role(browserPage, "Продолжить"));
      await visible(browserPage.getByTestId("basic-quiz-card"));
    };
  }
}
for (const stage of ["exercise", "warmup", "finish", "saved"]) {
  clientPage(`workout-run-${stage}`, `Тренировка: ${stage}`, "workoutRunStage", id("client-harness-workout-run-stage"), `&clientWorkoutRunStage=${stage}`);
  cases.at(-1).verify = async (page) => {
    await expect(page.getByTestId("workout-run-stage")).toHaveAttribute("data-workout-stage", stage === "saved" ? "finish" : stage);
    if (["finish", "saved"].includes(stage)) await visible(page.getByTestId("workout-finish-screen"));
    if (stage === "saved") await visible(role(page, "Вернуться в меню"));
  };
}
for (const [key, action, expected] of [
  ["technique", "Открыть раздел «Техника»", "workout-exercise-technique-modal"],
  ["notes", "Открыть заметку тренеру", "workout-exercise-note-modal"],
  ["set-editor", "Изменить подход 1", "workout-set-edit-modal"]
]) add(`workout-${key}`, `Тренировка: ${key}`, async (page) => {
  await go(page, clientURL("workoutRunStage", "&clientWorkoutRunStage=exercise"));
  await click(role(page, action));
}, id(expected));
add("workout-rest", "Таймер отдыха", async (page) => {
  await go(page, clientURL("workoutRunStage"));
  await click(page.getByTestId("workout-exercise-set-row").nth(1));
}, id("workout-rest-timer-expanded"));
add("nutrition-search", "Поиск продуктов", async (page) => {
  await clientTab(page, "nutrition"); await click(page.getByTestId("nutrition-orbit-add"));
}, id("food-search-screen"));
add("nutrition-product", "Карточка продукта", async (page) => {
  await clientTab(page, "nutrition"); await click(page.getByTestId("nutrition-orbit-add"));
  await click(page.getByTestId("food-search-my-products-action"));
  await page.getByTestId("food-search-input").locator("input").fill("yogurt");
  await click(page.locator("[data-food-search-result-card]"));
}, id("food-product-page"));
clientPage("nutrition-meal", "Приём пищи", "nutritionMealModal", "[data-nutrition-meal-part=info]");
clientPage("nutrition-ai-photo", "AI: подтверждение фото", "nutritionPhotoPreview", id("nutrition-photo-ai-preview"));
clientPage("profile-measurement-panel", "Замеры: панель", "measurementPanel", id("client-harness-measurement-panel"));
clientPage("profile-measurement-wizard", "Полноэкранный замер", "measurementWizard", id("client-harness-measurement-wizard"), "&clientMeasurementStep=measurement");
add("profile-quick-weight", "Быстрая запись веса", async (page) => {
  await go(page, clientURL("", "&clientMeasurementSnapshotState=single&clientWeightCheckInDue=1"));
  await click(page.getByTestId("profile-summary-task-weight"));
}, id("profile-quick-weight-dialog"));
clientPage("profile-account", "Настройки аккаунта", "cabinet", `${id("profile-settings-dialog")}[data-profile-settings-section="account"]`, "&clientCabinetModal=settings");
cases.at(-1).verify = (page) => visible(page.getByTestId("profile-account-section"));
add("profile-password", "Смена пароля", async (page) => {
  await go(page, clientURL("cabinet", "&clientCabinetModal=settings"));
  await click(page.getByTestId("profile-account-password"));
}, id("profile-password-dialog"));
add("profile-email", "Изменение email", async (page) => {
  await go(page, clientURL("cabinet", "&clientCabinetModal=connections"));
  await click(page.getByTestId("profile-settings-email"));
}, id("profile-email-dialog"));
for (const [key, modal, expected] of [
  ["photos", "photos", "profile-progress-photos-dialog"],
  ["telegram", "telegram", "profile-telegram-dialog"],
  ["notifications", "notifications", "profile-trainer-notifications-dialog"]
]) clientPage(`profile-${key}`, `Кабинет: ${key}`, "cabinet", id(expected), `&clientCabinetModal=${modal}`);
for (const section of ["profile", "connections", "settings"]) {
  clientPage(`profile-sheet-${section}`, `Настройки: ${section}`, "profileSheets", `${id("profile-settings-dialog")}[data-profile-settings-section="${section}"]`, `&sheet=${section}`);
}
clientPage("client-ai-coach", "AI-тренер", "aiCoach", id("client-harness-ai-coach"));
add("nutrition-calendar", "Календарь питания", async (page) => {
  await clientTab(page, "nutrition");
  await click(page.getByTestId("nutrition-orbit-calendar"));
}, id("nutrition-calendar-modal"), { verify: (page) => expect(page.locator("[data-nutrition-calendar-day]")).toHaveCount(42) });
add("nutrition-voice-review", "Голосовой ввод: проверка результатов", async (page) => {
  await go(page, clientURL("voiceReview"));
  await click(page.getByTestId("nutrition-orbit-audio-search"));
  await click(page.getByTestId("nutrition-voice-record"));
}, id("nutrition-voice-sheet"), { verify: (page) => visible(page.getByTestId("nutrition-voice-results")) });
clientPage("nutrition-dish-ingredients", "Редактор блюда: ингредиенты", "nutritionDishIngredients", id("client-harness-nutrition-dish-ingredients"));
clientPage("nutrition-search-history", "История поиска продуктов", "nutritionSearchHistory", id("food-search-history-names"));
clientPage("nutrition-photo-not-found", "AI: продукт на фото не распознан", "", id("nutrition-photo-not-found-modal"), "&clientNutritionPhotoNotFound=1");
clientPage("workout-calendar", "Календарь тренировок", "workoutSheets", id("profile-workout-journal-dialog"), "&sheet=calendar");
cases.at(-1).verify = async (page) => {
  await expect(page.getByRole("tab", { name: "Календарь", exact: true })).toHaveAttribute("aria-selected", "true");
  await visible(page.getByRole("tabpanel", { name: "Календарь тренировок", exact: true }));
};

add("trainer-dashboard", "Тренер: главная", (page) => go(page, "/v2?trainerHarness=1"), '.trainerNextDashboard section[aria-label="Журнал дня"]');
add("trainer-clients", "Тренер: клиенты", async (page) => { await go(page, "/v2?trainerHarness=1"); await trainerNav(page, "clients"); }, ".trainerNextClientsPage");
for (const [tab, key, expected] of [["Сводка", "overview", id("trainer-client-progress-dashboard")], ["Тренировки", "workouts", ".trainerClientWorkoutPlan"], ["Питание", "nutrition", ".trainerNutritionAnalytics"], ["Фото и замеры", "measurements", ".trainerClientBodyProgress"]]) {
  add(`trainer-client-${key}`, `Клиент тренера: ${tab}`, (page) => trainerClient(page, tab), expected);
}
add("trainer-library", "Тренер: библиотека", async (page) => {
  await go(page, "/v2?trainerHarness=1&libraryAudit=1"); await trainerNav(page, "workouts");
  await click(page.locator(".trainerNextPageTabs button").nth(1));
}, ".trainerNextLibrary");
add("trainer-library-program-editor", "Тренер: конструктор программы из библиотеки", async (page) => {
  await go(page, "/v2?trainerHarness=1"); await trainerNav(page, "workouts");
  await click(page.locator(".trainerNextPageTabs button").first());
  const program = page.getByRole("button", { name: /tren\+/ }).first();
  if (await program.getAttribute("aria-pressed") !== "true") await click(program);
  await click(page.getByRole("button", { name: /Редактировать/ }));
}, (page) => page.getByRole("dialog", { name: "РЕДАКТОР ПРОГРАММЫ", exact: true }));
add("trainer-program-editor", "Тренер: редактор программы клиента", (page) => trainerEditor(page), (page) => page.getByRole("dialog", { name: "Редактор программы клиента", exact: true }));
add("trainer-three-set-settings", "Тренер: три подхода и удаление", (page) => trainerEditor(page, true), (page) => page.getByRole("dialog", { name: "Настройки упражнения", exact: true }));
add("trainer-invite", "Тренер: приглашение", async (page) => {
  await go(page, "/v2?trainerHarness=1"); await trainerNav(page, "clients"); await click(role(page, "Добавить клиента"));
}, (page) => page.getByRole("dialog", { name: "Пригласить клиента", exact: true }));
add("trainer-notifications", "Тренер: уведомления", async (page) => {
  await trainerClient(page); await click(role(page, "Действия с клиентом"));
  await click(page.getByRole("button", { name: /Настроить уведомления/ }));
}, (page) => page.getByRole("dialog", { name: "Уведомления", exact: true }));
add("trainer-messages", "Тренер: сообщения", async (page) => {
  await trainerClient(page); await click(page.getByRole("button", { name: /^Сообщения Переписка с клиентом$/ }));
}, (page) => page.getByRole("dialog", { name: "Сообщения", exact: true }));
add("trainer-exercise-history", "Тренер: история выполнения упражнения", async (page) => {
  await trainerClient(page);
  await click(page.getByRole("button", { name: /^Прогресс упражнений Нагрузка, история и решения тренера$/ }));
  const progress = page.getByRole("dialog", { name: "Прогресс упражнений", exact: true });
  await visible(progress);
  await click(progress.getByRole("button", { name: "Открыть историю", exact: true }));
}, ".trainerExerciseProgressHistoryInline", {
  identityNote: "Real trainer exercise-history drill-in inside one utility sheet. The client legacy clientWorkoutRunHistory flag does not render a distinct history surface.",
  verify: async (page) => {
    await expect(page.getByRole("dialog")).toHaveCount(1);
    const dialog = page.locator(".trainerExerciseProgressHistoryInline");
    await visible(dialog.locator("#trainer-exercise-history-title"));
    await visible(dialog.getByText("ИСТОРИЯ УПРАЖНЕНИЯ", { exact: true }));
    await visible(dialog.locator(".trainerExerciseProgressHistorySessions article"));
  }
});

add("admin-overview", "Администратор: обзор", (page) => adminWorkspace(page), id("admin-overview-sections"));
add("admin-users", "Администратор: пользователи", (page) => adminWorkspace(page, "Пользователи и роли"), id("admin-users-workspace"));
add("admin-library", "Администратор: упражнения", (page) => adminWorkspace(page, "Базовые упражнения"), id("admin-base-library"), { identityNote: "Base library root must be visible, not the overview navigation alone." });
add("admin-calendar", "Администратор: календарь", (page) => go(page, "/?adminHarness=1&adminSurface=calendar"), id("admin-calendar-harness"));
add("admin-account", "Администратор: аккаунт", async (page) => {
  await adminWorkspace(page);
  const mobile = role(page, "Аккаунт: настройки и выход");
  await click(await mobile.isVisible() ? mobile : page.locator("button").filter({ hasText: "Александр" }).first());
}, (page) => page.getByRole("dialog", { name: "Аккаунт администратора", exact: true }));
add("admin-telegram-recovery", "Администратор: восстановление Telegram", async (page) => {
  await adminWorkspace(page, "Пользователи и роли"); await click(role(page, "Восстановить вход через Telegram"));
  await page.getByRole("dialog", { name: "Восстановить вход через Telegram", exact: true }).getByRole("combobox", { name: "Клиент", exact: true }).selectOption("client-1");
}, (page) => page.getByRole("dialog", { name: "Восстановить вход через Telegram", exact: true }));

const representatives = ["client-main", "workout-set-editor", "trainer-three-set-settings"];
for (const viewport of [narrow, landscape]) for (const key of representatives) {
  const original = cases.find((item) => item.key === key);
  cases.push({ ...original, key: `${key}-${viewport.id}`, viewport });
}
if (cases.length > 80) throw new Error(`Visual inventory exceeds the 80-screen bound (${cases.length}).`);

function telegramMock(config = {}) {
  const handlers = new Map();
  window.__visualAuditTelegramMock = true;
  window.Telegram = { WebApp: {
    initData: "", initDataUnsafe: {}, platform: "ios", version: "8.0", colorScheme: "light",
    // Injected before the viewport meta tag: innerHeight can temporarily reflect
    // WebKit's 980px mobile layout viewport, not the selected device viewport.
    viewportHeight: config.height || innerHeight, viewportStableHeight: config.height || innerHeight, isExpanded: true,
    safeAreaInset: { top: 24, right: 0, bottom: 30, left: 0 },
    contentSafeAreaInset: { top: 0, right: 0, bottom: 18, left: 0 },
    themeParams: { bg_color: "#F2F2F7", text_color: "#1C1C1E", button_color: "#3F73B8" },
    ready() {}, expand() {}, close() {}, disableVerticalSwipes() {}, enableVerticalSwipes() {},
    setHeaderColor() {}, setBackgroundColor() {}, setBottomBarColor() {}, isVersionAtLeast() { return true; },
    onEvent(name, callback) { if (!handlers.has(name)) handlers.set(name, new Set()); handlers.get(name).add(callback); },
    offEvent(name, callback) { handlers.get(name)?.delete(callback); },
    BackButton: { show() {}, hide() {}, onClick() {}, offClick() {} },
    MainButton: { show() {}, hide() {}, setParams() {}, onClick() {}, offClick() {} },
    HapticFeedback: { impactOccurred() {}, notificationOccurred() {}, selectionChanged() {} }
  } };
}

async function geometry(page) {
  return page.evaluate(() => {
    const viewport = { width: innerWidth, height: innerHeight };
    const shown = (node) => { const r = node.getBoundingClientRect(), s = getComputedStyle(node); return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none" && Number(s.opacity) > 0; };
    const description = (node) => ({ tag: node.tagName.toLowerCase(), testId: node.dataset.testid || null, role: node.getAttribute("role"), label: (node.getAttribute("aria-label") || node.getAttribute("title") || node.textContent || "").trim().replace(/\s+/g, " ").slice(0, 70) });
    const rect = (node) => { const r = node.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height), bottom: Math.round(r.bottom) }; };
    const nodes = [...document.querySelectorAll("body *")].filter(shown);
    const overflow = nodes.filter((node) => { const r = node.getBoundingClientRect(); return r.left < -1 || r.right > innerWidth + 1; }).slice(0, 15).map((node) => ({ ...description(node), ...rect(node) }));
    const touch = nodes.filter((node) => node.matches("button,a[href],input,select,textarea,[role=button],[role=switch]"))
      .filter((node) => { const r = node.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; })
      .map((node) => { const target = node.matches("input[type=checkbox],input[type=radio]") ? node.closest("label") || node : node; return { ...description(node), ...rect(target) }; })
      .filter((item) => item.width < 44 || item.height < 44).slice(0, 30);
    const dialogs = nodes.filter((node) => node.matches("dialog[open],[role=dialog],[role=alertdialog]")).map((node) => ({ ...description(node), ...rect(node), clientHeight: node.clientHeight, scrollHeight: node.scrollHeight }));
    const images = [...document.images];
    return { viewport, documentWidth: document.documentElement.scrollWidth, overflow, smallTouchCandidates: touch, dialogs,
      images: { total: images.length, incomplete: images.filter((image) => !image.complete).length, unavailable: images.filter((image) => image.complete && !image.naturalWidth).length },
      platform: document.documentElement.dataset.platform || null,
      safeArea: { viewport: getComputedStyle(document.documentElement).getPropertyValue("--app-viewport-height").trim(), bottom: getComputedStyle(document.documentElement).getPropertyValue("--telegram-content-safe-area-bottom").trim() },
      interpretation: "Geometry and <44 CSS px targets are potential review candidates, not confirmed usability/accessibility defects. Native keyboard/chrome and effective hit regions require real-device review." };
  });
}

async function main() {
  const dev = await fetch(new URL("/@vite/client", baseURL));
  if (!dev.ok) throw new Error("A local DEV Vite server with actual component fixtures is required. Do not point this at production hosting.");
  const indexPath = resolve(output, "index.json");
  const refresh = option("refresh", "");
  const retry = args.includes("--retry-failed") || Boolean(refresh);
  if (retry && args.includes("--overwrite")) throw new Error("Choose --retry-failed OR --overwrite, not both.");
  let existing = null;
  try { existing = JSON.parse(await readFile(indexPath, "utf8")); }
  catch (error) { if (error.code !== "ENOENT") throw error; }
  if (retry && !existing) throw new Error("--retry-failed requires an existing audit index.");
  if (existing && !retry && !args.includes("--overwrite")) throw new Error("Audit index exists; use --retry-failed or --overwrite explicitly. No directory is deleted.");
  const selected = cases.filter((item) => !only || item.key.includes(only)).slice(0, limit);
  const scope = { planned: cases.length, selected: selected.length, limit, filter: only || null, omitted: cases.filter((item) => !selected.includes(item)).map((item) => item.key) };
  if (retry && (existing.version !== version || existing.baseURL !== baseURL.origin || existing.browser !== browserName || existing.fixedTime !== fixedTime || JSON.stringify(existing.scope) !== JSON.stringify(scope) || !Array.isArray(existing.screens))) {
    throw new Error("Retry index version, server, browser, clock or scope does not match. Use the original filter/limit/browser/server options; do not overwrite successful captures.");
  }
  const index = retry ? existing : {
    version, generatedAt: new Date().toISOString(), source: "local actual React component fixtures",
    productionDeploymentVerifiedByOperator: true, baseURL: baseURL.origin, browser: browserName, fixedTime,
    primaryDevice: { ...primary, physicalReference: "iPhone 17 Pro: 1206×2622 physical pixels / 3 = 402×874 logical CSS px (Apple specification provided/verified for this task)." },
    telegram: { simulated: true, note: "Deterministic SDK mock only. NOT real Telegram, NOT proof of real-device layout, authentication, delivery or production data access. Native system bars and OS keyboard are not rendered." },
    data: "Synthetic fixture data only; local fresh browser contexts; all API mutations and all external network blocked; no production accounts.",
    scope, screens: []
  };
  const runCases = selected.filter((item) => refresh ? item.key.includes(refresh) : !retry || !index.screens.some((screen) => screen.key === item.key && screen.status === "captured"));
  if (retry) {
    index.retries = [...(index.retries || []), { startedAt: new Date().toISOString(), keys: runCases.map((item) => item.key) }];
    delete index.stopped;
    delete index.completedAt;
  }
  const saveIndex = () => {
    const scopedScreens = index.screens.filter((screen) => selected.some((item) => item.key === screen.key));
    index.summary = {
      captured: scopedScreens.filter((item) => item.status === "captured").length,
      failed: scopedScreens.filter((item) => item.status === "failed").length,
      unattempted: selected.filter((item) => !scopedScreens.some((screen) => screen.key === item.key && ["captured", "failed"].includes(screen.status))).map((item) => item.key)
    };
    return writeFile(indexPath, JSON.stringify(index, null, 2) + "\n");
  };
  await mkdir(resolve(output, "screenshots"), { recursive: true });
  await saveIndex();
  if (!runCases.length) {
    index.completedAt = new Date().toISOString();
    await saveIndex();
    process.stdout.write(`Nothing to retry. Index: ${indexPath}\n`);
    return;
  }
  const browser = await ({ chromium, webkit })[browserName].launch({ headless: true });
  const started = Date.now();
  try {
    for (const item of runCases) {
      if (Date.now() - started > 20 * 60 * 1000) { index.stopped = "20-minute safety bound reached"; break; }
      const viewport = item.viewport || primary;
      const entry = { key: item.key, title: item.title, viewport, status: "pending", telegramMock: item.telegram !== false, fixtureOnly: true, identityNote: item.identityNote || null };
      const previousEntry = index.screens.findIndex((screen) => screen.key === item.key);
      if (previousEntry >= 0) index.screens[previousEntry] = entry;
      else index.screens.push(entry);
      const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, deviceScaleFactor: viewport.deviceScaleFactor, isMobile: true, hasTouch: true, locale: "ru-RU", timezoneId: "Europe/Minsk", colorScheme: "light", reducedMotion: "reduce", serviceWorkers: "block" });
      const page = await context.newPage();
      page.setDefaultTimeout(9000);
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message.slice(0, 500)));
      await context.route("**/*", async (route) => {
        const request = route.request();
        const url = new URL(request.url());
        if (url.hostname === "telegram.org" && url.pathname.endsWith("telegram-web-app.js")) return route.fulfill({ contentType: "application/javascript", body: item.telegram === false ? "/* SDK intentionally absent for browser-entry screen */" : `(${telegramMock.toString()})(${JSON.stringify({ height: viewport.height })});` });
        if (url.origin !== baseURL.origin || url.pathname.startsWith("/api/") || !["GET", "HEAD"].includes(request.method())) return route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ ok: false, error: "visual-audit-network-blocked" }) });
        return route.continue();
      });
      if (item.telegram !== false) await context.addInitScript(telegramMock, { height: viewport.height });
      await page.clock.setFixedTime(new Date(fixedTime));
      try {
        await item.prepare(page);
        const identity = typeof item.expected === "function" ? item.expected(page) : page.locator(item.expected);
        await visible(identity);
        await item.verify?.(page);
        await page.evaluate(async () => { await document.fonts.ready; document.querySelectorAll("video").forEach((video) => video.pause()); });
        await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
        await page.waitForTimeout(150); // Let the mobile compositor present fixed/sticky layers before raster capture.
        entry.identity = typeof item.expected === "string" ? item.expected : "verified accessible role/test identifier";
        entry.actualURL = new URL(page.url()).pathname + new URL(page.url()).search;
        entry.metrics = await geometry(page);
        if (item.telegram !== false && entry.metrics.safeArea.viewport) {
          const stableHeight = Number.parseFloat(entry.metrics.safeArea.viewport);
          if (Math.abs(stableHeight - viewport.height) > 1) throw new Error(`Fixture viewport height mismatch: ${stableHeight} / ${viewport.height}.`);
        }
        entry.screenshot = `screenshots/${item.key}.png`;
        await page.screenshot({ path: resolve(output, entry.screenshot), fullPage: false, animations: "disabled", scale: "css" });
        entry.status = "captured";
      } catch (error) {
        entry.status = "failed";
        entry.error = error.message.slice(0, 1800);
        entry.actualURL = page.url().startsWith(baseURL.origin) ? page.url().slice(baseURL.origin.length) : "blocked or unavailable";
        entry.diagnosticScreenshot = `screenshots/${item.key}__FAILED.png`;
        try { await page.screenshot({ path: resolve(output, entry.diagnosticScreenshot), animations: "disabled", scale: "css" }); } catch { entry.diagnosticScreenshot = null; }
      } finally {
        entry.runtimeErrors = errors.slice(0, 10);
        await context.close();
        await saveIndex();
        process.stdout.write(`${entry.status}: ${entry.key}\n`);
      }
    }
  } finally {
    await browser.close();
    index.completedAt = new Date().toISOString();
    await saveIndex();
  }
  if (index.summary.failed || index.summary.unattempted.length) process.exitCode = 1;
  process.stdout.write(`Index: ${indexPath}\n`);
}

await main();
