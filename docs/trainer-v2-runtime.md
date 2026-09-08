# Trainer style comparison — 3.0.710

- Existing interface: https://tren-85720.web.app/
- Temporary comparison interface: https://tren-85720.web.app/v2
- `/v2/` and nested `/v2/...` paths opt in; `/v20` and `/cssV2` do not.
- Both URLs use the same authentication, roles, assigned clients and Firebase data.
- The variant is selected from the URL on startup, not from shared local storage.
- No trainer business logic, access checks or persistence handlers changed.

## Implementation

`src/app/cssVariant.js` loads the scoped V2 CSS only for its URL. Existing CSS
Modules retain their original rules; appended selectors require the V2 marker.
The program constructor has semantic data attributes for stable styling.
The final choice can be promoted later without maintaining duplicate components.

## Verification

- ESLint: no errors; 36 existing warnings.
- Unit tests: 680 passed.
- Firestore Rules emulator: 30 passed.
- Functions syntax, isolated staging build, production build and bundle budget passed.
- Both production dependency audits report zero vulnerabilities after targeted
  updates to xmldom and the Functions qs override. Functions are not deployed.
- Dedicated browser checks cover both URLs at 320px and 1366px: reload, main
  navigation, client tabs, actions sheet, cabinet, program library, constructor,
  day navigation, editable controls and horizontal overflow.
- The harness intentionally uses no-op persistence callbacks for the program
  manager. These browser checks do not claim end-to-end Firebase writes.

## Existing broad-suite limitation

The full legacy browser suite is not green. Its run was stopped after failures
on the original `/` route, including obsolete `.adminPanelHubPage` selectors,
client dashboard copy and trainer card navigation expectations. Its results are
not reported as a successful full release gate. Logs remain in
`artifacts/trainer-v2-full-e2e.log` and `artifacts/trainer-v2-release-gate.log`.
The comparison release is limited to presentation and is checked separately.

## Deployment

Target: Firebase Hosting only, project `tren-85720`. The production artifact
marker is verified before upload. Firestore Rules, Functions and stored data
are outside this deployment.

## Responsive refinement — 3.0.708

Acceptance checklist:
- [x] V2 matches the client shell widths, 20px phone gutters (16px at 320px), sticky headers and 70px bottom navigation including the default safe-area space.
- [x] Single vertical scroll owner; last cards remain above navigation.
- [x] Client cards use one phone column, two tablet columns, and desktop table columns; long names wrap without overlapping statistics.
- [x] Program cards, search, cabinet and sync sheet use compact calm-blue surfaces.
- [x] Original URL and all existing data/actions remain available; no persistence or access changes.
- [x] 680 unit tests pass; ESLint has zero errors and 36 existing warnings.
- [x] Focused browser coverage: 16 checks pass across 320, 375, 430, 600, 768, 1024 and 1366px plus short landscape. Eight duplicate project cases are intentionally skipped. The final 1024px case hit Chromium ERR_NO_BUFFER_SPACE before app load and passed in an isolated rerun.
- [x] Production build, bundle budget and production artifact validation pass.

The adaptive harness adds long names, enough clients to scroll, and a sync preview;
it is test-only and does not add demo users to Firebase. Constructor styles no
longer require local `!important` overrides; existing source-contract tests pass.

## Nested screens and palette completeness — 3.0.710

The V2 marker supplies shared palette values inherited by trainer components and
portaled sheets. Local CSS Modules retain their legacy colors as variable
fallbacks, so the original URL keeps its presentation. Alpha in translucent
backgrounds and shadows is preserved. Semantic success/warning/error colors
remain distinct. No client data, authorization or persistence behavior changed.

- All trainer CSS Modules now consume the V2 palette for legacy violet values,
  including tasks, messages, calendar, nutrition, measurements, photos, program
  and exercise editors, onboarding and review dialogs.
- Client detail has 16px outer phone gutters and a compact sticky back row.
  Nutrition removes a redundant inner padding layer; program sections use 14px.
- Utility sheet content no longer inherits the full-page trainer height.
- Browser checks inspect computed colors throughout all four client tabs and
  utility sheets at 393, 768 and 1366px; additional phone checks cover cabinet
  analytics/notifications, program library, constructor and day editor.
- Focused suite: 19 passed, 11 intentionally skipped duplicate viewport cases.
  Extended phone palette case also passes. Unit tests: 680 passed.
- Production build and bundle/artifact validation pass. Existing full-suite
  limitations described above remain; fixture checks do not claim Firebase writes.


## 3.0.711 — утверждённые четыре вкладки клиента

Основа: [интерактивный макет](trainer-client-four.html) и [разбор структуры](trainer-client-four-analysis.md).

- Компактный профиль, облегчённые верхние вкладки, мобильная навигация сохранена.
- Сводка: компактные показатели, динамика, отдельные переходы к заданиям и календарю/абонементу.
- Тренировки: отдельное раскрытие назначения, список реальных тренировок с упражнениями и переходом в существующий редактор; календарь на компьютере расположен рядом.
- Питание: короткий выбор периода, показатели, графики и текущий план в двух колонках на компьютере.
- Фото: две последние фотосессии выбраны по умолчанию; выбор дат и просмотр фото, отдельный полный список сессий. Замеры: четыре основных показателя с раскрытием всех 12 и историей.
- Изменения включаются только на `/v2`. Данные, Firebase, роли и обработчики сохранения сохранены; демонстрационные действия макета в приложение не перенесены.

Приёмка: четыре вкладки на 320/393/768/1366 px, компактность профиля, отсутствие горизонтального переполнения, выбор двух дат, открытие фото, 12 замеров, отдельное назначение, открытие упражнения/редактора. Изолированный E2E проверяет интерфейс с тестовыми данными и не подтверждает запись в production Firebase. Для production используется чтение назначенного клиента без отправки сообщений или тестовых записей.


## 3.0.712 — исправление адаптации по макету

Проверка 3.0.711 по горизонтальной прокрутке была недостаточной: наследуемая строка grid могла смещать действия профиля за левый край, а общий grid календаря и списка оставлял большие вертикальные промежутки.

- Один порог 760 px: мобильный экран с нижней навигацией; выше — рабочая область до 1120 px и вкладки сверху. Внутри карточки клиента на компьютере глобальная панель не дублируется; выход к списку сохраняется.
- Поля 16 px на телефоне и 24 px на компьютере, заголовки вкладок, компактный профиль с явными ячейками grid.
- Независимая колонка программы и списка тренировок, компактный календарь рядом.
- Питание без двойной обёртки, четыре показателя в строку на компьютере; график прогресса без вложенной карточки, выбор показателя над графиком.
- Переносы подписей и длинных имён, рамки/отступы фото, единые размеры кнопок.

Проверено: 32 сочетания вкладки/ширины (320, 393, 760, 761, 768, 1024, 1366, 1920); отдельные проверки положения каждого элемента профиля, границ нижней панели и промежутка программа/список. 680 unit-тестов; 17 пройденных focused E2E в двух запусках, 11 намеренных пропусков дублирующего mobile-проекта. Линтер: 0 ошибок, 36 существующих предупреждений. Оригинальный адрес и редакторы проверены focused E2E; сохранения production-данных во время smoke не выполняются.


## 3.0.713 — sparse client states

- Stacked calendar and subscription controls prevent text overlap in narrow columns. Clients without workouts can expand the calendar and subscription below a labelled disclosure.
- One measurement shows its date and explains why no trend is available. Missing photos show a descriptive empty state; measurements remain accessible. Nutrition bars are capped at 40 px.
- Setup action wraps separately on compact screens; diary remains available in the nutrition page header. Original trainer routes and data handlers remain intact.
- Verified: 20 focused E2E checks, plus five sparse-client viewport checks (320, 393, 768, 1024, 1366), production build, bundle budget and Firebase artifact guard. Existing four-tab coverage spans 320–1920 px. Lint has no errors; pre-existing warnings remain.


## 3.0.714 — unified client pages

Reviewed with ui-ux-pro-max (grouping, hierarchy, touch targets) and emil-design-eng (consistent geometry, restrained states). The existing approved iOS palette remains the reference.

| Before | After | Why |
| --- | --- | --- |
| Unequal sidebars leave large holes | Sequential full-width sections; nutrition plan and macros share one row | Keep the content flow continuous |
| Oversized key metrics and broken mobile words | Content-sized columns on desktop, compact rows on phones | Read labels and values without truncation |
| Duplicate task button in profile | Tasks in the overview action group before the chart | One predictable entry point |
| Identical workout rows | Check icon and completion label from planned workout slots | Distinguish completed sessions without colour alone |
| Mixed labels and tiny avatar | Larger avatar, shorter headings, consistent controls | Match the calm iOS interface |

Acceptance: all 11 user comments addressed across overview, workouts, nutrition and photos/measurements. Protected handlers and original route preserved. Eight viewport checks (320–1920), task/calendar/message sheets, program editor, photo comparison, sparse states and 680 unit tests verified. Explicit layout checks cover metric height, section gaps and completed workout identity. Screenshots also inspected below the fold for calendar, nutrition and measurements.
