import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const version = JSON.parse(await readFile("package.json", "utf8")).version;
const directory = resolve(`artifacts/telegram-visual-audit-${version}`);
const read = async name => JSON.parse(await readFile(resolve(directory, name), "utf8"));
const [audit, chromium, client, trainer, admin, root] = await Promise.all([
  read("index.json"), read("chromium/index.json"), read("client-review.json"), read("trainer-review.json"), read("admin-review.json"), read("root-review.json")
]);
const postReleaseHealth = await read("post-release-health.json").catch(error => {
  if (error.code === "ENOENT") return null;
  throw error;
});
for (const inventory of [audit, chromium]) {
  assert.equal(inventory.version, version);
  assert.equal(inventory.summary.captured, 80);
  assert.equal(inventory.summary.failed, 0);
}
const reviewed = new Set([client, trainer, admin, root].flatMap(part => part.reviewedScreens.map(item =>
  (typeof item === "string" ? item : item.key || item.screen).replace(":diagnostic-only", ""))));
assert.ok(audit.screens.every(screen => reviewed.has(screen.key)), "Every inventoried state must have a human review owner.");
const normalize = (finding, group) => ({
  ...finding, group,
  evidence: Array.isArray(finding.evidence) ? finding.evidence.join(" ") : finding.evidence,
  source: (Array.isArray(finding.source) ? finding.source : [finding.source]).map(value => typeof value === "string" ? value : `${value.path}:${value.line}`).join("; "),
  screens: [...new Set((finding.screens || []).map(value => value.replace(/^.*screenshots\//, "").replace(/\.png$/, "").replace(/__FAILED$/, "")))],
  attachments: (finding.screens || []).filter(value => /__FAILED\.png$/.test(value))
});
const findings = [
  ...trainer.findings.map(item => normalize(item, "Тренер")),
  ...client.findings.map(item => normalize(item, "Клиент")),
  ...root.findings.map(item => normalize(item, "Тренировки")),
  ...admin.findings.map(item => normalize(item, "Администратор"))
].sort((a, b) => a.priority.localeCompare(b.priority));
const review = {
  version,
  summary: "Базовую светлую iOS-стилистику стоит сохранить. Главные улучшения — не новая палитра, а понятные действия, один уровень модальности, одинаковая навигация и аккуратные формы в ограниченной высоте Telegram. Ниже отдельно показаны опубликованные исправления и новые замечания следующего этапа.",
  scope: "Проверены 80 уникальных состояний: клиент, вход и анкета, тренировки, питание, профиль, тренерская и админская часть. Сделано по 80 подтверждённых захватов в Chromium и WebKit (160 снимков), каждый сценарий просмотрен участником аудита. Основной viewport — 402×874; 320×720 и 844×390 проверены на трёх представительных сценариях, а не на каждой странице. Дополнительно проверен реальный Production-экран ожидания. Это не все комбинации данных, ошибок, клавиатуры и состояний Telegram.",
  release: {
    postReleaseHealth,
    changes: [
      "Закрыты 13 подтверждённых проблем повторного аудита: Telegram-идентичности и согласие на приглашение, повторное создание после удаления, очистка и дубли связей, защита от ответов старой auth-сессии, ожидание создания профиля, корректная приостановка доступа, синхронизация питания, копирование программ и сохранение AI-плана.",
      "Загрузка видео в черновик больше не сохраняет незавершённую программу целиком. Стандартная форма настройки трёх подходов стала компактнее; отдельный остаточный случай 320×720 отмечен ниже как следующий этап.",
      "Добавлены одноразовое админское восстановление Telegram и серверное хранение хешей кодов вместо открытых кодов в профиле. Реальные пользователи автоматически не перепривязывались по недоверенным старым полям.",
      "Видео вынесены из публичного Hosting в приватное хранилище: авторизация, проверка активного доступа, ссылки на 15 минут и отсутствие кэша видео в service worker. Все 21 исходное видео проверены; запись экрана и уже скачанные копии такая защита не исключает.",
      "После визуальной проверки отдельно исправлена потеря CSS на экранах ожидания и проверки роли; этот малый патч опубликован как 3.0.838. Остальные новые замечания этого отчёта пока являются предложениями, а не автоматически внедрённым редизайном."
    ],
    verification: "1179/1179 unit-тестов; 55/55 тестов Firebase Rules; полный браузерный прогон 496 passed, 160 условных skips, 0 failed. ESLint без замечаний, сборки и bundle budget пройдены, npm audit в трёх пакетах — 0 уязвимостей. Живой staging: 13 сценариев трёх ролей и 9 проверок входа/видео. Для финального 3.0.838 staging и Production повторно прошли 9 проверок, включая вычисленные стили, вход и реальные byte-range данные видео. Временные аккаунты и их данные удалены; index и service worker Production совпадают с артефактом.",
    remainingAction: "Одна старая Telegram-связь не имеет безопасного серверного подтверждения: при необходимости перепривязать её из существующего аккаунта либо через новую проверенную админскую процедуру. App Check подготовлен в коде, но внешний provider/site key не зарегистрирован, поэтому enforcement не включён. Это явно оставшиеся внешние шаги, а не выполненные проверки.",
    beforeImage: "../production-pending-3.0.837.png",
    afterImage: `../production-pending-${version}.png`
  },
  findings,
  options: [
    {
      title: "Вариант A — аккуратная эволюция текущего интерфейса (рекомендую)",
      text: "Сохранить пять вкладок клиента, текущие карточки и спокойный акцент. Унифицировать шапки и sheet: одна шапка, один верхний слой, видимые основные действия. Исправить конкретные тексты и состояния, сократить вторичные фильтры. Telegram BackButton и безопасные отступы использовать последовательно во всех ролях.",
      tradeoff: "Меньше изменений и риска для существующих привычек; web-версия остаётся такой же понятной. Основная работа — точечная компоновка и ясность сценариев, не переписывание приложения."
    },
    {
      title: "Вариант B — более нативная Telegram-оболочка",
      text: "Для одношаговых форм выборочно использовать MainButton/SecondaryButton Telegram, а сложные рабочие формы открывать полноэкранно. Рассмотреть подтверждение закрытия только при несохранённых данных и отдельный fullscreen-режим активной тренировки. В браузере сохранить HTML-кнопки как fallback; не показывать одновременно две одинаковые основные кнопки.",
      tradeoff: "Может освободить место на телефоне, но потребует отдельного адаптера и реальной проверки Telegram iOS/Android. Для тренировки с двумя постоянными действиями не стоит механически заменять существующую нижнюю панель одним MainButton."
    }
  ],
  sequence: [
    "Сначала исправить шапку приглашения и вложенную историю упражнения; затем закрыть неоднозначное завершение голосового ввода и ложное обещание восстановления через служебный email.",
    "Привести sheet к одному правилу: один активный слой, закреплённые важные действия, прокрутка только длинного содержимого. Отдельно проверить короткие экраны и клавиатуру.",
    "Унифицировать навигацию клиента и явные статусы админки; развести изменение роли и назначение тренера. Добавить идентификатор аккаунта в опасные операции восстановления.",
    "Улучшить путь нового пользователя к тренеру, открытие выбранного способа входа, читаемость уведомлений и библиотечных названий. После этого заниматься косметикой и небольшими текстовыми исправлениями.",
    "Провести очный acceptance-проход в Telegram на iPhone и Android: не только screenshots, но клавиатура, Back, закрытие, поворот и реальная доставка приглашения/напоминания."
  ],
  realDeviceChecks: [
    "Нативная клавиатура: имя, email/пароль, вес, сообщение и приглашение; поле и основное действие должны оставаться достижимыми без наложения панелей.",
    "Telegram BackButton и Android Back: сначала закрытие верхнего sheet, затем переход. Отдельно проверить несохранённую программу и закрытие Mini App.",
    "Полноэкранный и развёрнутый/свёрнутый Telegram, safe-area/content-safe-area, поворот и увеличенный системный текст. Mock SDK не доказывает совместимость этих режимов.",
    "Принятие приглашения реальным новым Telegram-пользователем, удаление и повторное приглашение, старый аккаунт с перепривязкой; реальная доставка уведомлений по настройкам.",
    "Медленная и пропадающая сеть, ошибки сохранения и истечение временной видеоссылки во время просмотра; показать понятный повтор, не терять введённые данные."
  ],
  infrastructureNote: "У staging и Production сейчас один Telegram-бот: не подключать staging-webhook к нему, иначе рабочий webhook будет заменён. Нужен отдельный тестовый бот. App Check включать только после регистрации provider и проверки получения токенов на настоящих устройствах. Защита временными URL и watermark не является DRM. Резервные копии, alerting и полный ручной smoke-checklist этим визуальным проходом не подтверждаются.",
  strengths: [...client.strengths, ...trainer.strengths, ...root.strengths, ...admin.strengths],
  limitations: [
    "Основная галерея использует Chromium для стабильного растра; к каждому состоянию приложен WebKit-вариант. Для отдельных WebKit-снимков обнаружена нестабильная отрисовка фиксированных слоёв при неизменном корректном DOM, поэтому пустые участки растра не объявлены дефектами приложения.",
    "Заголовки некоторых клиентских fixture отличаются от production shell; их обрезка не классифицирована как глобальная ошибка Production-шапок.",
    "Админские компоненты сняты standalone-fixture с реальными product tokens, но без полного Telegram navigation bridge. Тёмный отдельный calendar-harness не доказывает, что Production-календарь имеет такое оформление.",
    "Внешняя сеть заблокирована; placeholder-видео, каталожные fallback и синтетическая auth-ошибка библиотеки не являются установленными Production-сбоями.",
    "Для базового генератора визуально снят первый вопрос; последующие вопросы, AI-генерация и все результирующие варианты отдельно не снимались. Состояния ошибок, больших каталогов и очень длинных имён покрыты не исчерпывающе."
  ],
  coverage: audit.screens.reduce((groups, screen) => { const key = screen.key.split("-")[0]; groups[key] = (groups[key] || 0) + 1; return groups; }, {}),
  sourceReports: ["client-review.json", "trainer-review.json", "admin-review.json", "root-review.json"]
};
await writeFile(resolve(directory, "review.json"), JSON.stringify(review, null, 2) + "\n");
console.log(`Consolidated ${findings.length} findings; 80/80 reviewed states; two browser inventories complete.`);
