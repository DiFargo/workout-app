# Всесторонний аудит Zmena — 18 октября 2026

## Итог

Приложению не нужен полный редизайн или переписывание. Основная работа сейчас — устранить несколько ошибок целостности данных и приватности, сделать результаты операций честными и закрепить поведение в Telegram. Текущая спокойная светлая iOS-композиция уже достаточно согласована.

Проверена текущая рабочая база **3.0.849**, включая существующие незакоммиченные изменения. Контекст продукта: **закрытое тестирование, до 100 клиентов в ближайшие три месяца**. Открытый вход разрешён; функциональность участника — после допуска тренером/администратором; тренер работает только с назначенными клиентами. Никакие исправления runtime, настройки доступа или публикации в Production в рамках этого аудита не выполнялись.

Выделено **25 подтверждённых функциональных/безопасностных находок: 6 P1 и 19 P2**. Отдельно — 7 архитектурных/эксплуатационных пунктов, 3 рекомендации по клиентскому модулю, 3 визуальных замечания и неподтверждённые риски. Один пункт — одна связанная проблема, а не число всех её симптомов. Частота возникновения в Production не измерялась. P0 или общий обход авторизации не подтверждены; это не гарантия отсутствия других уязвимостей.

Приоритеты:

- **P1** — исправить прежде, чем расширять тестирование и объём чувствительных данных.
- **P2** — конкретная ошибка либо необходимая проверка следующей очереди.
- **P3** — локальная полировка/техническое улучшение, не блокирующее пилот само по себе.

## 1. Метод и границы

Использованы все десять выбранных навыков: Firebase Auth, Firestore, аудит Rules, проектирование Rules как контрольный список, React best practices, composition patterns, web-interface guidelines, Playwright, security best practices и threat modeling. Дополнительно применён проектный UI/UX-навык. Это повлияло на метод: проверялись реальные обработчики и границы сессий, а не только внешний вид и совпадение текста в тестах. Правила проектирования не использовались для замены законного доступа назначенного тренера и администратора на owner-only модель.

Проверка включала трассировку компонентов → обработчиков → Firebase/API → правил, существующие тесты, дополнительные локальные контрпримеры и визуальные снимки реальных React-компонентов с синтетическими данными. Независимые ветки аудита интегрированы в этот отчёт; повторяющиеся замечания объединены.

| Область | Что проверено | Граница доказательства |
| --- | --- | --- |
| Вход и профиль | Telegram, email/Google, приглашения, смена сессии, восстановление, роли | Нет входа под реальными аккаунтами |
| Firebase/Auth/API | Admission, suspended/revoked, admin claims, ownership, ошибки и retry | Локальные actual-handler probes; не live pentest |
| Firestore/Storage | Доступ владельца/тренера/admin, серверные поля, заметки, фотографии | Emulator + исходники; реальные IAM/объекты не читались |
| Тренировки клиента | Выполнение, история, черновик, таймеры, очередь offline, повтор сохранения | Не сертифицированы фоновые таймеры реального телефона |
| Питание | Поиск, AI-фото, камера, блюда, порции, синхронизация, личная база | Без платных AI-вызовов и реальной камеры |
| Замеры и фото | 12 замеров, последнее значение, загрузки, частичные ошибки | Синтетические файлы/данные |
| Тренер | Список, карточка, программы, копирование, архив, расписание, сообщения, отчёты | Воспроизведены ключевые обработчики с mock I/O |
| Администратор | Каталог, роли, приглашения, удаление, доступ, базовые программы | Не менялись реальные роли/пользователи |
| Абонементы | Проданные/использованные занятия, цикл, события истории | Повтор доставки и подставленная метка проверены локально |
| Видео | Серверная выдача, временные URL, watermark, logout, кэш | Нет обещания DRM или запрета записи экрана |
| UI | 80 состояний × Chromium/WebKit, основные экраны трёх ролей | Фикстуры не равны 160 end-to-end сценариям |
| Релиз/эксплуатация | Lint, unit, Rules, Functions, сборки, зависимости, budget, SW, runbooks | Live-заголовки/версия/мониторинг остались не подтверждены |

Не запускались платные запросы, рассылки, настоящие приглашения, смена ролей, загрузки пользовательских файлов или изменяющие Production smoke-скрипты. Публичные HTTP GET к Hosting из локальной среды не прошли; текущая live-конфигурация и deployed-версия этим аудитом не подтверждаются.

## 2. Результаты проверок

| Проверка | Результат |
| --- | --- |
| Node | 22.23.3, проектный кэшированный runtime |
| ESLint | PASS |
| Полный unit suite | **1422 PASS / 1423; 1 FAIL** |
| Причина единственного FAIL | `AppCore remains a coordinator`: 3303 строки при лимите 3300; не падение пользовательского сценария |
| Functions syntax | PASS |
| Firestore + Storage emulator | 55/55 PASS существующих проверок |
| Дополнительные Rules-контрпримеры | 3/3 воспроизведены: SEC02, SEC03, SEC08 |
| Сборка изолированного staging | PASS, синтетическая конфигурация |
| Локальная production-mode сборка | PASS; не деплой |
| Текущий bundle budget | PASS; его покрытие неполно — ARCH03 |
| `npm audit` root/Functions/telegram-auth | 0 известных advisories на момент проверки; не доказательство безопасности кода |
| Визуальный захват | WebKit 80/80, Chromium 80/80; 0 ошибок захвата |
| Дополнительные воспроизведения | Backend 7 новых probes + 15 baseline; trainer/admin 6 случаев; client 2 случая повторены главным агентом |

Зелёные локальные контрпримеры означают **«ошибка воспроизведена»**, а не «приложение исправлено». Focused-прогоны подагентов пересекаются с общим unit suite и не прибавляются к числу уникальных тестов. `verify:core` остановился на unit-ошибке; оставшиеся проверки выполнены отдельно, полный gate не объявляется зелёным.

Логи и машиночитаемые результаты: [каталог доказательств](../artifacts/comprehensive-audit-2026-10-18/verification-summary.json), [unit](../artifacts/comprehensive-audit-2026-10-18/unit-tests.json), [остальные проверки](../artifacts/comprehensive-audit-2026-10-18/local-checks.json), [reproductions](../artifacts/comprehensive-audit-2026-10-18/reproductions.json).

## 3. Первая очередь: шесть P1

### SEC01 — AI-план доступен до допуска тренером

`aiBasicWorkoutPlan` проверяет факт Firebase-входа, но не активное членство. Pending-профиль, отсутствующий профиль и suspended-профиль при неуспешном отключении Auth доходят до платного провайдера. Контрольный member-only endpoint в тех же fixtures возвращает 403. Общего доступа к чужим данным здесь нет. Per-UID квоты существуют, но не устраняют расходы от множества открытых регистраций.

Источник: [functions/index.js:3871](C:/Users/workk/workout-app/functions/index.js:3871). Исправление: единый admission до любого платного вызова либо отдельно согласованный ограниченный trial. Приёмка: pending/missing/suspended → 403 без provider call; действующий клиент сохраняет все рабочие ветки.

### SEC02 — баланс занятий не идемпотентен

Повтор одного и того же исходного create-event увеличивает `usedSessions` дважды; повтор delete — дважды возвращает занятие. Снимок события не меняется вслед за записью служебной метки в документ. Кроме того, Rules разрешают владельцу истории заранее указать `subscriptionCycleId`, из-за чего обработчик пропускает списание. Это подтверждено actual-handler probe и отдельным emulator allow-тестом.

Источник: [functions/index.js:2518](C:/Users/workk/workout-app/functions/index.js:2518), [firestore.rules:1023](C:/Users/workk/workout-app/firestore.rules:1023). Нужен серверный ledger и идемпотентный переход в одной транзакции с балансом, без доверия клиентской метке. Приёмка: retry, duplicate, delete-before-create, смена цикла и подставленная метка не меняют баланс повторно. Firebase прямо предупреждает о доставке событий более одного раза и отсутствии гарантированного порядка. [Документация Firestore triggers](https://firebase.google.com/docs/functions/firestore-events).

### SEC06 — фотографии тела имеют долговечные bearer-ссылки

Фото прогресса сохраняются через `getDownloadURL`, а полученный token URL записывается в документы. Тот, кто легитимно получил ссылку, например прежний тренер, может обращаться к объекту после переназначения, пока объект/токен не отозван. Прямое чтение SDK ограничено Rules, но possession URL — другой контракт. Реальные фотографии и токены не запрашивались.

Источник: [firebaseStorage.js:28](C:/Users/workk/workout-app/src/utils/firebaseStorage.js:28), [progressPhotoPersistence.js:23](C:/Users/workk/workout-app/src/features/client/profile/progressPhotoPersistence.js:23). Нужны storage paths и authenticated blob либо короткая серверная выдача после проверки текущего доступа; миграция должна отдельно отозвать старые постоянные токены. Уже скачанную копию отозвать невозможно. Firebase предлагает прямое SDK-скачивание для более точного контроля через Rules. [Документация downloads](https://firebase.google.com/docs/storage/web/download-files).

### TR01 — копия дня теряет групповые упражнения

В клиентском редакторе новые IDs упражнений не согласованы со ссылками в `taskBlocks`/embedded group config. Реальная цепочка построения назначенной программы → копирование → выполнение даёт **0 шагов вместо 8** для суперсета из двух упражнений на четыре круга. Уже исправленный месяц-программный путь — другой обработчик и здесь не помогает.

Источник: [trainerPlanEditorHandlers.js:533](C:/Users/workk/workout-app/src/features/trainer/trainerPlanEditorHandlers.js:533). Исправление: единое отображение exercise/block IDs во всех структурах. Приёмка: superset/triset/interval сохраняют структуру после копирования, сохранения и reload; исходный день не меняется.

### TR02 — восстановление архива не восстанавливает активное назначение

Если архивировать единственную активную программу и вернуть её, обработчики сообщают успех, workouts получают active, но профиль остаётся с пустым `assignedProgramId` и `client_archived`. Архивный timestamp ошибочно участвует в выборе assignment. Календарные массивы также не восстанавливаются; это не означает удаления всех reminder-настроек — merge сохраняет пропущенные поля.

Источник: [trainerProgramTemplateHandlers.js:755](C:/Users/workk/workout-app/src/features/trainer/trainerProgramTemplateHandlers.js:755). Нужны явное восстановление выбранной assignment identity и scoped calendar slots. Приёмка: archive → restore → reload возвращает именно программу клиента; отдельно проверить другое активное назначение и исторически завершённую программу.

### CL01 — AI-фото может пережить смену аккаунта

Запрос фото-поиска защищён от более нового фото-запроса, но не от новой auth-сессии. Поздний ответ аккаунта A может попасть в результат/preview приложения уже для B. Воспроизведена публикация старого результата в новую UI-сессию; серверный обход доступа не заявляется.

Источник: [nutritionPhotoAiHandlers.js:234](C:/Users/workk/workout-app/src/features/client/nutrition/nutritionPhotoAiHandlers.js:234). Нужны auth-generation guards для всех веток и reset/cancel retained file/preview/request при logout. Приёмка: old success/error/lookup не меняют состояние B, включая повторный вход под тем же UID.

## 4. Подтверждённые P2: безопасность, Telegram, данные

| ID | Проблема и точное условие | Минимальное изменение / приёмка |
| --- | --- | --- |
| SEC03 | Удаление trainer-created профиля с чужим email администратором удаляет чужие invitations, найденные только по email. Чужие Auth/профиль сохраняются. Создание placeholder подтверждено emulator. [index.js:5216](C:/Users/workk/workout-app/functions/index.js:5216) | Удалять alias/invite только после проверки uid/authUid. Тест: fake profile deletion сохраняет все чужие документы |
| SEC04 | Disconnect оставляет nested `telegram.chatId/userId` из-за merge; ручная отправка использует их, не проверяя актуальную связь. [index.js:2002](C:/Users/workk/workout-app/functions/index.js:2002) | Удалять весь destination map/листья; outbound сверяет connected + canonical owner. После disconnect — 0 bot calls |
| SEC05 | Avatar refresh, начатый до disconnect/rebind, поздно публикует старый Telegram map. [index.js:1783](C:/Users/workk/workout-app/functions/index.js:1783) | Публиковать только avatar leaves с проверкой текущего binding/version. Delayed refresh не возвращает старую связь |
| SEC07 | Запрос старого тренера, авторизованный до reassignment, позже записывает настройки клиента через Admin SDK. [index.js:1931](C:/Users/workk/workout-app/functions/index.js:1931) | Транзакционная проверка актуального назначения перед записью; stale request → conflict/forbidden без изменения |
| SEC08 | Прежний тренер читает `trainerNotes` по ID-prefix после reassignment; удаление собственной заметки отдельно отклоняется из-за `request.resource` в delete. [firestore.rules:1098](C:/Users/workk/workout-app/firestore.rules:1098) | Read по ownerUid + current assignment, отдельный delete contract. Обе ветки подтверждены локальным emulator |
| SEC09 | Публичный resolve-login раскрывает email по alias; limiter берёт первый XFF. [index.js:1335](C:/Users/workk/workout-app/functions/index.js:1335) | Определить публичность alias/email, защитить credential exchange; доверенный ingress/IP и общий budget. Remote XFF-spoofing пока не подтверждён |

Полные предпосылки, ограничения и тесты: [security best-practices report](../artifacts/comprehensive-audit-2026-10-18/security_best_practices_report.md), [детали SEC01–09](../artifacts/comprehensive-audit-2026-10-18/security-findings.json), [модель угроз](../artifacts/comprehensive-audit-2026-10-18/workout-app-threat-model.md).

## 5. Подтверждённые P2: тренер и администратор

| ID | Что происходит | Что изменить и проверить |
| --- | --- | --- |
| TR03 | Сохранение расписания из старого snapshot пишет `planned` поверх одновременно выполненной/перенесённой тренировки. История не удаляется, представления расходятся. [calendarHandlers.js:320](C:/Users/workk/workout-app/src/features/trainer/trainerClientCalendarHandlers.js:320) | Fresh read/revision conflict и узкие поля. Completion/move между открытием и сохранением сохраняется либо операция конфликтует без writes |
| TR04 | Telegram без публичного username: UI сообщает отправку, но бот не вызывается; текст сохраняется только внутри. [messagingHandlers.js:189](C:/Users/workk/workout-app/src/features/trainer/trainerMessagingHandlers.js:189) | Разделить «открыть личный чат» и bot delivery по numeric ID; явно показывать fallback/ошибку |
| TR05 | CSV/PDF использует только загруженную страницу истории — первоначально 80 записей. Полнота не указана. [clientActionHandlers.js:106](C:/Users/workk/workout-app/src/features/trainer/trainerClientActionHandlers.js:106) | Отдельный paginated export либо явный диапазон/partial. 81+ записей и отказ чтения не дают ложный полный отчёт |
| TR06 | Rename/description-only в редакторе базовой программы проходит name-only text round-trip, теряя sets/reps/video/IDs/groups новой версии. Выданные копии не меняются. [AdminBasicProgramLifecycle.jsx:251](C:/Users/workk/workout-app/src/components/admin/AdminBasicProgramLifecycle.jsx:251) | Сохранять structured workouts при неизменённом составе; ID-aware reconciliation при изменении. Никакой молчаливой потери полей |
| TR07 | При отказе/отсутствии Clipboard повторный invite тренера пишет «скопировано», но ручной ссылки нет. [AdminTrainerProfileRoute.jsx:362](C:/Users/workk/workout-app/src/features/trainer/AdminTrainerProfileRoute.jsx:362) | Статус создания отдельно от копирования; доступная ссылка всегда; повтор copy не создаёт новый invite |
| TR08 | Ошибка client→trainer promotion уходит в unhandled rejection без понятного сообщения. [AdminUsersWorkspace.jsx:290](C:/Users/workk/workout-app/src/components/admin/AdminUsersWorkspace.jsx:290) | Operation-owned error/status, очистка pending, обновление списка при ambiguous outcome, без ложного успеха |
| TR09 | Архивный клиент остаётся обычным в «Клиенты/Внимание», хотя dashboard его исключает. [trainerActionCenter.js:256](C:/Users/workk/workout-app/src/utils/trainerActionCenter.js:256) | Отдельный доступный архив и единая активная выборка/счётчики; архив не требует действий в очереди |
| TR10 | Quick-toggle reminders получает false от сохранения, но создаёт успешное событие и возвращает true. [clientActionHandlers.js:362](C:/Users/workk/workout-app/src/features/trainer/trainerClientActionHandlers.js:362) | Проверять результат до success event. Failure → false, 0 успешных событий, понятная ошибка |

Детали и сценарии: [trainer/admin findings](../artifacts/comprehensive-audit-2026-10-18/trainer-admin-findings.json). TR01/02/03/04/06/10 дополнительно повторены главным агентом через actual factories/modules, без сети.

## 6. Подтверждённые P2: клиент

| ID | Проблема | Исправление / приёмка |
| --- | --- | --- |
| CL02 | Камера получена после закрытия сканера: cleanup уже прошёл и tracks не останавливаются. [useNutritionRuntimeEffects.js:69](C:/Users/workk/workout-app/src/features/client/nutrition/useNutritionRuntimeEffects.js:69) | После await проверять stopped, немедленно stop всех tracks; deferred permission → close → resolve даёт stop=1 |
| CL03 | Финальный комментарий не входит в черновик незавершённой тренировки, при Resume сбрасывается. [useWorkoutRuntimeEffects.js:208](C:/Users/workk/workout-app/src/features/client/workouts/useWorkoutRuntimeEffects.js:208) | Versioned draft содержит комментарий; Resume сохраняет, Restart явно очищает |
| CL04 | При refresh истории с pending-очередью и network error известная cloud-история заменяется только pending. [workoutHistoryHandlers.js:87](C:/Users/workk/workout-app/src/features/client/workouts/workoutHistoryHandlers.js:87) | Error branch merge текущей same-session history + pending с dedupe; не показывать исчезновение облачных записей |
| CL05 | Удаление продукта/блюда из «Моей базы» реализовано обработчиком, но нет достижимого UI/confirmation. [FoodProductPage.jsx:77](C:/Users/workk/workout-app/src/features/client/nutrition/FoodProductPage.jsx:77) | Подключить локальное удаление личного продукта с подтверждением; прошлые порции дневника неизменны |
| CL06 | Быстро выбрать фото A→B: поздний FileReader A меняет preview, хотя сохраняться будет B; после удаления preview может вернуться. [profileProgressHandlers.js:124](C:/Users/workk/workout-app/src/features/client/profile/profileProgressHandlers.js:124) | Per-view generation/file identity и abort предыдущего чтения; out-of-order и remove-during-read не возвращают старое изображение |

Полные данные: [client findings](../artifacts/comprehensive-audit-2026-10-18/client-findings.json).

## 7. Визуальный аудит и Telegram UX

Основной viewport: **iPhone 17 Pro, 402×874 CSS px**, с детерминированным mock safe-area. Дополнительно проверены представительные редакторы на 320×720 и 844×390. Системные панели, настоящая клавиатура, VoiceOver/TalkBack и жесты Telegram не эмулируются этими снимками.

Просмотрены оба набора и полноразмерные подозрительные состояния. Современные клиентские, тренерские и админские экраны согласованы; в проверенных состояниях нет подтверждённого массового горизонтального переполнения или необходимости менять визуальную концепцию. Нижняя навигация в дополнительной DOM-проверке имеет видимый текст, active `aria-current` и высоту 49 px; отсутствие отдельного `aria-label` у текстовой кнопки само по себе не дефект.

Геометрический скан нашёл по пять состояний с элементами шире viewport: workout-plan/mode/basic-quiz, profile-notifications и AI-coach. Это full-bleed header boxes; document width остаётся 402 px, а на полноразмерных снимках не подтверждена потеря интерактивного содержимого. Их не считаем пятью доказанными поломками; ширину/центрирование headers нужно перепроверить в актуальном shell на узком телефоне и при длинных заголовках.

| ID/тип | Наблюдение | План |
| --- | --- | --- |
| VTA01, P3, подтверждено | Действие «Настроить абонемент» 370×35 px без расширенного hitbox. [TrainerAppleClient.module.css:186](C:/Users/workk/workout-app/src/components/trainer/TrainerAppleClient.module.css:186) | Сохранить компактный вид, но ≥44 px эффективной зоны на 402/320; проверить ending/frozen/long labels |
| VTA02, P3, текст | Пустой журнал ссылается на «задачи выше», когда секции задач нет. [TrainerDailyJournal.jsx:227](C:/Users/workk/workout-app/src/components/trainer/TrainerDailyJournal.jsx:227) | Разные truthful empty states: нет событий/задач, только задачи, filtered-empty, loading/error |
| UX03, P3, ясность | Email-вход советует «Нет доступа? Попроси тренера…», хотя регистрация открытая. [AuthScreens.jsx:309](C:/Users/workk/workout-app/src/components/auth/AuthScreens.jsx:309) | Разделить «Нет аккаунта? Создать» и «Есть приглашение? Активировать»; объяснить, что знакомство доступно, работа — после тренера |
| Рекомендация | Много вторичных подписей 9–12 px; плотность хорошая, но чтение при масштабировании не сертифицировано | Проверить 120–150% текста/длинные имена; повышать читаемость точечно, не раздувать все карточки |
| Рекомендация | Итог действия должен отличать prepared/copied/sent/saved/synced | Исправлять статусы вместе с TR04/07/08/10; ошибки оставляют данные и предлагают безопасный retry |
| Покрытие неизвестно | Чёрный standalone `admin-calendar` и маленькая `nutrition-ai-photo` — изолированные component fixtures | Снять актуальный production-reachable маршрут в его shell. Не объявлять их регрессиями основного UI по одному fixture |

Не нужно удалять все focus outlines ради «красоты»: клавиатурный фокус должен оставаться заметным, без двойных случайных рамок. Не нужно возвращать насыщенную старую тему или добавлять декоративные изображения. Для Telegram важнее стабильные размеры, понятное закрытие sheets, сохранение ввода, отсутствие дублирования окон и доступность главного действия при клавиатуре.

### Отдельная обязательная device-матрица

До следующего расширения пилота проверить на реальном Telegram iOS и Android:

1. Вход/выход/смена аккаунта, pending→assigned, Telegram link→disconnect→relink, вход с другого устройства.
2. Клавиатура в onboarding/name/email/password/weight/search: поле и footer доступны, после закрытия не остаётся пустой inset.
3. Back/swipe/close sheet, несохранённый ввод, вложенные модалки; одна точка запуска → одно рабочее окно.
4. Долгий scroll веса в районе 125 и границ диапазона: без дрожания и циклического snap; сохранить точные десятичные значения.
5. Камера: permission allow/deny/delayed, уход назад, смена приложения; индикатор гаснет при закрытии.
6. Тренировка online→offline→background→resume→save/retry; нет двойной истории или списания занятия.
7. Большой текст, длинные русские названия, VoiceOver/TalkBack, reduced motion; фокус не уходит под sheet.
8. Обновление N→N+1 и rollback без принудительного reload во время тренировки; сохранение черновика/очереди.

SDK предоставляет события viewport и safe-area, но их наличие в коде не подтверждает native поведение. [Telegram Mini Apps](https://core.telegram.org/bots/webapps).

## 8. Архитектура, производительность и готовность пилота

| ID | Наблюдение | Решение |
| --- | --- | --- |
| ARCH01, P2 | Gate AppCore: 3303 > 3300 строк. [app-structure.test.mjs:112](C:/Users/workk/workout-app/tests/app-structure.test.mjs:112) | Небольшое осмысленное выделение уже существующей ответственности; не сжимать строки и не переписывать AppCore ради теста |
| ARCH02, P2 | Документы приписывают `npm run verify` lint/unit, но это release-profile build/budget/diff; полный gate — `verify:core/full` | Согласовать названия/документацию и CI-команду; релиз не должен ошибочно считаться полностью проверенным |
| ARCH03, P2 | Budget проверяет 71,34 KiB static-entry gzip, но обязательный boot union — **569,42 KiB gzip**, 31 asset, включая App static closure и trainer CSS | Добавить измерение реальной bootstrap-цепочки и baseline; затем профиль холодного старта. Это не измерение CWV и не доказательство тормозов |
| ARCH04, P3 | Секундный timerTick инвалидирует вычисления/сортировку полной истории. [AppCore.jsx:1250](C:/Users/workk/workout-app/src/AppCore.jsx:1250) | Отделить elapsed display от history memo; проверить profiler, background recovery и previous results |
| ARCH05, P3 | Native Android metadata 3.0.813 не синхронизирован с web 3.0.849 | Только перед новым Android-релизом: monotonic versionCode + consistency guard. Не блокирует Telegram-only пилот |
| ARCH06, P3 | AGENTS/project_map/active CSS имеют разные описания палитры и override owners | Зафиксировать утверждённую текущую палитру и владельца токенов. Не менять вид всех страниц ради старого текста |
| ARCH07, P2 readiness | В просмотренных auth/account поверхностях нет privacy notice и понятного запроса экспорта/удаления | Сначала учесть внешние соглашения; доступное уведомление и support-led процесс подходят для 100 клиентов. Не утверждается нарушение конкретного закона |

[Архитектурные детали](../artifacts/comprehensive-audit-2026-10-18/architecture-findings.json), [boot metrics](../artifacts/comprehensive-audit-2026-10-18/boot-metrics.json).

Ещё три ограниченные доработки клиента:

- **CLR01:** определить ожидаемую свежесть питания между устройствами. Cloud merge есть, но обычный autosave не применяет returned merge локально; другая сессия может отображаться только после reload. Сначала согласовать SLA свежести, затем listener/reload, не менять хранение без необходимости.
- **CLR02:** измерить размер `nutrition/state` на 90 днях реалистичных данных, включая tombstones. Это рост на одного клиента, не общая нагрузка 100 пользователей. Настроить порог и план архивирования до лимита документа; текущий переполненный production-документ не обнаружен и не запрашивался.
- **CLR03:** добавить реальные hook/runtime-тесты timer/draft, а не только assertions о тексте исходника: pause/resume, изменение отдыха, background time, restore/restart.

### Что ещё нужно подтвердить вне исходников

- App Check enforcement и доверенный ingress/IP на реально deployed конфигурации; default false в исходнике не доказывает выключенный Production.
- Доставку redacted client-error события в настроенный collector; Functions/AI/Storage budget alerts и получателя тревоги.
- Реальные backup/retention настройки, ответственного и изолированную репетицию восстановления Auth + Firestore + Storage. Runbook уже есть — отсутствие инфраструктуры не утверждается.
- Политику legacy invited клиента после unassignment: сохраняет ли он доступ к своей истории/инструментам или всегда становится pending. Не менять это молча.
- Старые frozen-абонементы в sessions-only UI: сохраняется флаг, но формы его не снимают. Нужна явная миграционная политика, не автоматическое размораживание.
- Задержанные trainer loaders при logout/relogin: missing session invalidation — кандидат, реальная видимость старых данных ещё не воспроизведена.
- Реальный маршрут admin calendar и populated/error-state покрытия; полная iOS/Android native матрица из раздела 7.

## 9. Защита видео: что уже есть и чего не обещать

Есть server-side membership check, allowlist bucket/path/content-type, выдача V4 URL на **15 минут**, отзыв permanent download token при защищённой выдаче, `private/no-store`, обновление URL, session-scoped cache и очистка playback при смене источника/сессии. В UI — watermark с именем/коротким ID.

Источник: [protectedExerciseVideo.js](C:/Users/workk/workout-app/functions/protectedExerciseVideo.js:1), [ProtectedExerciseVideo.jsx](C:/Users/workk/workout-app/src/components/media/ProtectedExerciseVideo.jsx:1), [WorkoutVideoProtectionMark.jsx](C:/Users/workk/workout-app/src/features/client/workouts/WorkoutVideoProtectionMark.jsx:1).

Это затрудняет массовое получение постоянных ссылок, но **не делает скачивание или запись экрана невозможными**. Signed URL доступен держателю до истечения срока; DOM-watermark можно скрыть. [Контракт signed URLs](https://cloud.google.com/storage/docs/access-control/signed-urls). Для пилота не рекомендую немедленный дорогой DRM-проект. Если защита эксклюзивного каталога станет бизнес-приоритетом — отдельно оценить transcode/burn-in watermark, сегментированную доставку, аудит выдачи и стоимость. Приватные фото требуют более срочного исправления SEC06.

## 10. План доработок: небольшие проверяемые релизы

Оценки — относительный объём, не обещание календарной даты. Каждый пакет требует отдельной реализации, focused-проверок, полного gate и разрешённой публикации; этот аудит ничего не выкладывает.

| Очередь | Объём | Состав | Критерий готовности |
| --- | --- | --- | --- |
| **A. Надёжность тренировок и занятий** | Средний | SEC02, TR01, TR02, TR03 | Retry не меняет баланс дважды; копии групп исполняются; archive/restore/reload активирует нужную программу; concurrent completion не затирается |
| **B. Приватность и границы сессии** | Средний/крупный из-за миграции фото | SEC01, SEC06, CL01; SEC03/07/08 | Admission до paid I/O; private media не использует постоянный capability; старые URL отозваны контролируемо; cross-session publication=0; current-assignment enforcement |
| **C. Telegram без неоднозначности** | Средний | SEC04/05, TR04/07/10, UX03 | Disconnect окончателен для старых запросов; ID-only delivery работает; created/copied/sent отличаются; ошибки правдивы; native link/relink smoke |
| **D. Сохранение пользовательского ввода** | Средний | CL02/03/04/05/06, TR06/08/09 | Камера останавливается; комментарий/история не исчезают; preview=file; база очищается; rename не обедняет план; архив/role errors понятны |
| **E. Полные отчёты и эксплуатация** | Средний | TR05, SEC09, ARCH01/02/07; collector/backup/App Check evidence | Отчёты честно полные/partial; alias/IP контракт согласован; gate зелёный; notice и support-процесс доступны; restore подтверждён |
| **F. Telegram-полировка и доступность** | Малый/средний | VTA01/02, размеры текста, keyboard/back/long-data/error states | Реальная device-матрица без блокирующих дефектов; touch/focus/scroll/keyboard выдерживают сценарии |
| **G. Измеренная оптимизация** | Средний | ARCH03/04/06, CLR01/02/03; ARCH05 только для Android-релиза | Boot-path budget и реальные cold-start traces; история не пересчитывается от тика; 90-day data-size проверен; один token contract |

A и B — первая обязательная очередь до расширения тестирования; их можно разбить на несколько малых патч-релизов. Не объединять всё в одну огромную выкладку. C/D следуют сразу за ними; E/F — до расширения пилота. G выполняется по измерениям, без блокировки полезных небольших исправлений.

### Единый checklist приёмки изменений

- Воспроизводящий текущую ошибку контрпример заменён тестом правильного поведения; отдельно проверена негативная ветка.
- Firebase/Auth/тренер/admin/Telegram/история/питание/замеры/навигация не удалены и не заменены фикстурой.
- Правила проверяются emulator для owner/pending/suspended/assigned/foreign trainer/admin, включая смену назначения.
- Запись/отправка/копирование не выдают ложный success; ambiguous commit не создаёт повторную программу/историю/списание.
- Build/lint/unit/Rules/Functions/budget проходят; deployment соответствует явно разрешённым targets.
- Изменённый mobile surface проверен с настоящими данными нужной формы, не только happy-path screenshot.
- Production smoke и rollback выполняются только в рамках отдельно разрешённого релиза, без реальных побочных действий над клиентами.

## 11. Что сохраняем и чего сейчас не делаем

Сохраняем архитектурные границы, существующий CSS Modules подход, светлый iOS UI, lazy feature routes, bounded fan-out, canonical Telegram identity, versioned admin claims, idempotent completion/tombstones, nutrition merge, guarded uploads, explicit-save drafts и bounded SW caching. Уже исправленные 848/849 сценарии сравнения истории и поиска не переобъявляются сломанными.

Не рекомендую ради 100 клиентов: переписывать всё на новый router/store/TypeScript, дробить на микросервисы, менять Firebase, ставить ещё набор навыков или вводить второй дизайн-системный слой. Legacy transfer/delete нельзя возвращать без отдельного hardening, но они **не посчитаны активными дефектами текущего V2 UI**.

Снимки синтетические: [визуальный обзор и галерея](../artifacts/comprehensive-audit-2026-10-18/report.html). Для технической реализации использовать связанные JSON: там есть точные предусловия, несколько evidence anchors, confidence и тесты приёмки каждого пункта.
