import assert from "node:assert/strict";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const version = JSON.parse(await readFile("package.json", "utf8")).version;
const baseVersion = "3.0.838";
const directory = resolve(`artifacts/variant-a-${version}`);
const auditDirectory = resolve(`artifacts/telegram-visual-audit-${version}`);
const prior = JSON.parse(await readFile(`artifacts/telegram-visual-audit-${baseVersion}/review.json`, "utf8"));
const release = JSON.parse(await readFile(resolve(directory, "release-status.json"), "utf8"));
const optionalJson = async path => {
  try { return JSON.parse(await readFile(path, "utf8")); }
  catch (error) { if (error.code === "ENOENT") return null; throw error; }
};
const [chrome, webkit, health, additional, finalHandoff, finalLogout] = await Promise.all([
  optionalJson(resolve(auditDirectory, "chromium/index.json")),
  optionalJson(resolve(auditDirectory, "index.json")),
  optionalJson(resolve(directory, "post-release-health.json")),
  optionalJson(resolve(directory, "additional/index.json")),
  optionalJson(resolve(directory, "final-handoff-summary.json")),
  optionalJson(resolve(directory, "final-logout-summary.json"))
]);
const emailAcceptance = release.acceptanceOverrides?.["CLIENT-02"] || {
  status: "interface_fixed_auth_followup",
  followUp: "Telegram-only без password/Google: привязка личной почты требует отдельного Telegram re-auth сценария; текущий обработчик его не поддерживает."
};
const implemented = {
  "trainer-01": "Перестроена шапка приглашения: читаемый заголовок и независимая кнопка закрытия.",
  "trainer-02": "История открывается внутри одного sheet, с возвратом к прогрессу — без двух наложенных окон.",
  "trainer-03": "Удаление доступно на компактном экране, важные действия отделены от длинного содержимого.",
  "trainer-04": "Питание сначала показывает аналитику и пустой план; редактор открывается по явному действию.",
  "trainer-05": "Состояние автосохранения и повтор после ошибки находятся у видимых элементов управления.",
  "trainer-06": "Названия библиотечных упражнений переносятся на две строки, а не теряют важное окончание.",
  "trainer-07": "На телефоне оставлены частые фильтры, остальные доступны через явное раскрытие; фильтры не удалены.",
  "CLIENT-01": "Неразобранные продукты не теряются при завершении, закрытии или новой записи; пропуск явный. Ошибки добавления сохраняют очередь без дублей при повторе.",
  "CLIENT-02": emailAcceptance.status === "implemented"
    ? "Служебная почта не выдаётся за адрес восстановления. Свежая custom-login сессия может добавить личную почту без неизвестного пароля; устаревший вход требует явного повторного входа. После смены почты старый токен отзывается: явная кнопка и Back переводят к повторному входу. Смена аккаунта блокирует чужой запрос/ответ, серверные проверки сохранены. Пароль устанавливается через отдельную ссылку."
    : "Служебная почта не выдаётся за адрес восстановления. Предлагается добавить личную почту; полный custom-login сценарий до итоговой проверки не считается закрытым.",
  "CLIENT-03": "На ожидании есть следующий шаг, собственный идентификатор с копированием и объяснение приглашения.",
  "CLIENT-04": "Выбранный email-способ открывается компактной формой с фокусом и возвратом; черновик не теряется.",
  "CLIENT-05": "Уведомления имеют перенос заголовка, читаемое превью и раскрытие полного текста.",
  "CLIENT-06": "В ответах AI разведены вес основного текста и заголовков без изменения AI-логики.",
  "CLIENT-07": "Добавлено корректное склонение счётчика продуктов, включая 11–14.",
  "WORKOUT-01": "В плане сохранены пять главных вкладок. План и история стали локальной навигацией раздела тренировок.",
  "WORKOUT-02": "Редактор подхода разделён на шапку, содержимое и действие. На низком экране — три строки колеса и видимое «Готово».",
  "admin-recovery-account-disambiguation": "В восстановлении видны маскированная почта и ID, чтобы различать одинаковые имена.",
  "admin-role-action-distinction": "Смена роли отделена от назначения тренера, опасное действие подтверждается для конкретного аккаунта.",
  "admin-account-status-semantics": "Статусы учитывают ожидание тренера, приостановку, отзыв доступа, неактивность и архив.",
  "admin-native-back-sheet-priority": "Общий back-registry отдаёт приоритет верхнему окну; занятая форма удерживает Back. Проверены mock Telegram и browser Back, не физический телефон.",
  "admin-telegram-operations-hierarchy": "Локальная диагностика честно отделена от серверной команды переподключения; перед webhook показано подтверждение бота и окружения.",
  "admin-telegram-inset-consumption": "Фиксированные админские элементы используют существующие безопасные отступы Telegram. Физические режимы Telegram ещё требуют проверки."
};
assert.equal(prior.findings.length, 22);
assert.deepEqual(new Set(Object.keys(implemented)), new Set(prior.findings.map(item => item.id)));
const checklist = prior.findings.map(item => ({
  id: item.id, group: item.group, title: item.title, status: item.id === "CLIENT-02" ? emailAcceptance.status : "implemented", change: implemented[item.id], screens: item.screens,
  ...(item.id === "CLIENT-02" && emailAcceptance.followUp ? { followUp: emailAcceptance.followUp } : {}),
  requiresNativeDeviceCheck: ["CLIENT-02", "admin-native-back-sheet-priority", "admin-telegram-inset-consumption"].includes(item.id)
}));
const escape = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const webkitByKey = new Map((webkit?.screens || []).filter(item => item.status === "captured" && item.screenshot).map(item => [item.key, item]));
const screens = (chrome?.screens || []).filter(item => item.status === "captured" && item.screenshot);
for (const screen of screens) {
  await access(resolve(auditDirectory, "chromium", screen.screenshot));
  const other = webkitByKey.get(screen.key);
  if (other?.screenshot) await access(resolve(auditDirectory, other.screenshot));
}
const afterLink = key => screens.some(screen => screen.key === key) ? `<a href="#screen-${escape(key)}">После</a>` : "";
const cards = checklist.map(item => {
  const key = item.screens.find(value => screens.some(screen => screen.key === value));
  return `<details class="change"><summary><span class="check" aria-hidden="true">${item.followUp ? "!" : "✓"}</span><strong>${escape(item.title)}</strong><small>${escape(item.group)}</small></summary><p>${escape(item.change)}</p>${item.followUp ? `<p><strong>Не закрыт весь сценарий.</strong> ${escape(item.followUp)}</p>` : ""}<p class="links"><a href="../telegram-visual-audit-${baseVersion}/report.html#${escape(item.id)}">Исходное замечание</a>${key ? ` · ${afterLink(key)}` : ""}${item.requiresNativeDeviceCheck ? " · Нужна проверка на телефоне" : ""}</p></details>`;
}).join("");
const gallery = screens.map(screen => {
  const other = webkitByKey.get(screen.key);
  const path = `../telegram-visual-audit-${version}/chromium/${screen.screenshot}`;
  return `<article class="screen" id="screen-${escape(screen.key)}"><a href="${escape(path)}" target="_blank" rel="noopener"><img loading="lazy" src="${escape(path)}" alt="${escape(screen.title || screen.key)}"></a><h3>${escape(screen.title || screen.key)}</h3><p>${escape(screen.key)}</p>${other?.screenshot ? `<a href="../telegram-visual-audit-${version}/${escape(other.screenshot)}" target="_blank" rel="noopener">Снимок WebKit</a>` : ""}</article>`;
}).join("");
const published = release.production.verified;
const publicationTime = release.production.deployedAt
  ? `${new Intl.DateTimeFormat("ru-RU", { timeZone: "Europe/Minsk", dateStyle: "short", timeStyle: "short" }).format(new Date(release.production.deployedAt))} (Минск)`
  : "ещё не выполнена";
const additionalGallery = (additional?.entries || []).map(item => `<article class="screen"><a href="${escape(item.screenshot)}" target="_blank" rel="noopener"><img loading="lazy" src="${escape(item.screenshot)}" alt="${escape(item.title)}"></a><h3>${escape(item.title)}</h3><p>${escape(item.browser)} · изолированный компонент, синтетические props</p></article>`).join("");
const verification = Object.entries(release.verification).map(([label, result]) => `<li><strong>${escape(label)}</strong>: ${escape(typeof result === "string" ? result : JSON.stringify(result))}</li>`).join("");
const liveEvidence = [["liveEmailHandoff", "Живой UI: почта → выход → вход"], ["customPartialRun", "Custom-session: успешные этапы и исходная ошибка"], ["productionSmoke", "Production: доступ и приватное видео"]]
  .filter(([key]) => release.evidence?.[key])
  .map(([key, label]) => `<a href="${escape(release.evidence[key])}">${escape(label)}</a>`).join(" · ");
const captureDiagnostics = [chrome, webkit].filter(Boolean).map(inventory => {
  const errors = inventory.screens.filter(item => item.runtimeErrors?.length);
  return `${escape(inventory.browser)}: ${inventory.summary.captured}/80 снимков, ${inventory.summary.failed} ошибок захвата; ${errors.length} состояний с pageerror${errors.length ? ` (${errors.map(item => escape(item.key)).join(", ")})` : ""}`;
}).join(". ");
const html = `<!doctype html><html lang="ru"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ZMENA · Вариант A · ${escape(version)}</title><style>
:root{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#1c1c1e;background:#f2f2f7;font-synthesis:none}*{box-sizing:border-box}body{margin:0}main{max-width:1160px;margin:auto;padding:40px 24px 64px}h1{font-size:clamp(30px,5vw,48px);letter-spacing:-.04em;line-height:1.08;margin:12px 0 16px}h2{font-size:24px;letter-spacing:-.02em;margin:32px 0 14px}h3{font-size:16px}p,li{line-height:1.5}a{color:#3c6faa;text-underline-offset:3px}.eyebrow,.meta{color:#636366;font-size:13px}.eyebrow{letter-spacing:.06em;font-weight:650}.lede{max-width:770px;color:#636366;font-size:18px}.panel,.change{background:#fff;border:1px solid rgba(60,60,67,.12);border-radius:20px;padding:20px;margin:12px 0}.panel p:first-child{margin-top:0}.status{display:inline-block;padding:8px 12px;border-radius:12px;background:#efeff4;font-size:14px;font-weight:650}.change summary{display:flex;align-items:center;gap:12px;cursor:pointer;min-height:44px;list-style:none}.change summary::-webkit-details-marker{display:none}.change summary strong{flex:1;min-width:0;font-size:15px}.change summary small{color:#636366;font-size:12px}.check{display:grid;place-items:center;width:28px;height:28px;flex:0 0 28px;border-radius:50%;color:#237a42;background:#edf6ef}.change p{margin:12px 0 0}.links{font-size:13px}.gallery{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px}.screen{min-width:0;border:1px solid rgba(60,60,67,.12);border-radius:18px;background:#fff;padding:10px;scroll-margin-top:16px}.screen img{width:100%;height:310px;object-fit:contain;object-position:top;background:#f2f2f7;border-radius:10px}.screen p{font-size:11px;color:#636366;overflow-wrap:anywhere}.screen a{font-size:13px}.screen h3{margin:12px 0 6px}.panel ul{margin-bottom:0;padding-left:20px}.panel li+li{margin-top:7px}:focus-visible{outline:3px solid #3c6faa;outline-offset:3px}@media(max-width:800px){.gallery{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:480px){main{padding:28px 16px 48px}.panel,.change{padding:16px}.change summary{flex-wrap:wrap}.change summary small{margin-left:40px}.gallery{gap:10px}.screen img{height:270px}.lede{font-size:16px}}
</style></head><body><main><div class="eyebrow">ZMENA · ВАРИАНТ A · ${escape(version)}</div><h1>Привычный интерфейс.<br>Более понятные действия.</h1><p class="lede">Сохранён спокойный iOS-стиль. Внесены доработки по 22 пунктам выбранного варианта.${emailAcceptance.status === "implemented" ? " Клиентский сценарий личной почты дополнен для свежего входа через Telegram/custom-сессию с прежней серверной защитой." : " CLIENT-02 ещё требует завершения клиентского сценария и проверок."} Нативные проверки не подменяются снимками стенда.</p><span class="status">${published ? "Опубликовано в Production" : "Подготовка выпуска — ещё не опубликовано"}</span>
<section class="panel"><p><strong>${published ? "Production: " : "Подготовленная версия: "}${escape(version)}</strong></p><p>${published ? `<a href="https://tren-85720.web.app/?release=${escape(version)}">Открыть приложение</a> · ` : ""}<a href="#changes">22 доработки</a> · <a href="#gallery">Галерея после изменений</a></p><p class="meta">Публикация: ${escape(publicationTime)}. Снимки — локальные реальные компоненты с синтетическими данными; они не подтверждают нативную клавиатуру и жесты телефона.</p></section>
<h2>Что изменилось</h2><section class="panel"><ul><li>Компактный email-вход и понятный путь нового пользователя к тренеру.</li><li>Пять постоянных вкладок клиента, локальные «Обзор / План / История».</li><li>Один уровень истории упражнения, читабельные приглашения и видимые состояния сохранения.</li><li>Явный выбор или пропуск голосовых продуктов; повтор ошибки не создаёт дубли.</li><li>Различимые действия администратора и подтверждение серверного обслуживания.</li></ul></section>
<h2>Проверки выпуска</h2><section class="panel"><ul>${verification || "<li>Итоговые проверки ещё выполняются.</li>"}</ul><p><a href="full-gate-summary.json">Исходный полный прогон</a>${finalHandoff ? ' · <a href="final-handoff-summary.json">Проверка явного повторного входа</a>' : ""}${finalLogout ? ' · <a href="final-logout-summary.json">Финальная проверка выхода и перехода ко входу</a>' : ""}</p>${liveEvidence ? `<p>${liveEvidence}</p>` : ""}${health ? `<p><strong>После публикации.</strong> ${escape(health.summaryRU)} <a href="post-release-health.json">Сигналы и ограничения наблюдения</a></p>` : ""}<p class="meta">Число сценариев и покрытые ограничения указаны отдельно; отсутствие ошибок в журнале не доказывает отсутствие всех ошибок интерфейса.</p></section>
<h2 id="changes">22 пункта выбранного варианта</h2>${cards}
<h2>Что ещё требует отдельной проверки</h2><section class="panel"><ul>${release.limitations.map(item => `<li>${escape(item)}</li>`).join("")}</ul><p>Вариант B с заменой HTML-действий нативными MainButton/SecondaryButton не внедрялся. Серверные правила, роли и Telegram-привязки не перенастраивались ради UI. Клиентский сценарий почты использует существующий защищённый API.</p></section>
<h2 id="gallery">После изменений · ${screens.length} состояний</h2><p class="meta">Основной viewport 402×874. Короткие и узкие экраны — дополнительные представительные проверки, не все сочетания устройства и данных.</p><p class="meta">${captureDiagnostics || "Захват ещё не выполнен."} Pageerror стенда учитываются отдельно от успешного получения снимка и не скрываются. Полная диагностика: <a href="../telegram-visual-audit-${version}/chromium/index.json">Chromium</a> · <a href="../telegram-visual-audit-${version}/index.json">WebKit</a>. <a href="../telegram-visual-audit-${version}/capture-run-notes.json">Причины и история пересъёмки</a>.</p><div class="gallery">${gallery || "<p>Галерея будет добавлена после публикации.</p>"}</div>${additionalGallery ? `<h2>Пограничные примеры компонентов</h2><p class="meta">Дополнительные изолированные состояния, не полный маршрут приложения и не нативный Telegram.</p><div class="gallery additional-gallery">${additionalGallery}</div>` : ""}<p class="meta">Исходный аудит: <a href="../telegram-visual-audit-${baseVersion}/report.html">версия ${baseVersion}</a>. <a href="acceptance.json">Единый контрольный список</a> · <a href="release-status.json">Состояние выпуска</a></p></main></body></html>`;
await mkdir(directory, { recursive: true });
await writeFile(resolve(directory, "acceptance.json"), JSON.stringify({ version, variant: "A", generatedAt: new Date().toISOString(), items: checklist }, null, 2) + "\n");
await writeFile(resolve(directory, "report.html"), html);
console.log(`Variant A report: ${directory}; ${checklist.filter(item => item.status === "implemented").length} implemented items, ${checklist.filter(item => item.followUp).length} UI-fixed/auth-follow-up, ${screens.length} screenshots.`);
