# Project map

Карта предназначена для быстрого поиска точки изменения. Путь в первой колонке — стартовая точка: перед правкой обязательно проверить её импорты, CSS Module и тесты с одноимённым префиксом.

## Слои и ответственность

| Слой | Назначение | Где искать |
| --- | --- | --- |
| Bootstrap | React root, service worker, error boundary | `src/main.jsx`, `src/App.jsx`, `src/app/AppBootstrap.jsx` |
| Координация | глобальное состояние, сборка route context | `src/AppCore.jsx` |
| Навигация | список страниц, доступ, back navigation, lazy routes | `src/app/appPages.js`, `src/app/appNavigation.js`, `src/app/appRouteRenderer.jsx`, `src/app/AppRouter.jsx` |
| Client features | экраны и обработчики клиента | `src/features/client/` |
| Trainer features | экраны и обработчики тренера | `src/features/trainer/` |
| Shared UI | общие панели, шапки, модальные примитивы, hooks | `src/shared/ui/`, `src/shared/hooks/` |
| Domain / utils | чистая бизнес-логика и преобразования данных | `src/domain/`, `src/utils/` |
| Backend | callable/HTTP functions, Telegram, reminders, AI | `functions/` |

## Клиент: пять главных вкладок

Текущий визуальный эталон: [«Свой ритм» — компактные пять экранов](docs/client-five-main-screens-signature.html). В runtime используются реальные данные и существующие обработчики, не демонстрационная логика макета.
Предыдущий эталон сохранён: `docs/client-five-main-screens-native-refinement.html?palette=calm-blue`.
Шапки экранов: `src/shared/ui/ClientPageHeader.jsx`, `ClientPageHeader.module.css`. Декоративные полоски убраны по просьбе пользователя; заголовки и функциональные действия сохранены. Геометрия каждого экрана остаётся в его CSS Module.
Регрессия нового интерфейса и основных действий: `tests/e2e/client-native-refinement.spec.js`.

| Сценарий | Точки изменения | Проверка |
| --- | --- | --- |
| Главная / сводка | `src/AppCore.jsx`, `src/app/appRouteRenderer.jsx`, `src/features/client/profile/ProfileSummaryDashboard.jsx`, `src/features/client/profile/profileDashboardModel.js` | `tests/client-ux.test.mjs`, `tests/e2e/client-primary-visual.spec.js` |
| Тренировки: список и режим | `src/features/client/workouts/WorkoutListPage.jsx`, `WorkoutModePage.jsx`, `WorkoutRenderOverview.jsx`, `src/features/client/navigation/` | `tests/workout-entry-navigation.test.mjs`, `tests/workout-presentation.test.mjs`, `tests/e2e/client-workout-visual.spec.js` |
| Питание: дневник | `src/features/client/nutrition/NutritionRoute.jsx`, `NutritionPage.jsx`, `NutritionDiary.jsx`, `NutritionMainContent.jsx` | `tests/nutrition-calendar.test.mjs`, `tests/nutrition-food-presentation.test.mjs`, `tests/e2e/client-nutrition-visual.spec.js` |
| Прогресс / замеры / фото | `src/features/client/profile/ProfileProgressPhotosModal.jsx`, `ProfileMeasurementsModal.jsx`, `src/features/client/measurements/MeasurementWizardPage.jsx` | `tests/profile-measurements.test.mjs`, `tests/profile-quick-weight.test.mjs` |
| Кабинет | `src/features/client/profile/ProfileDashboardRoute.jsx`, `ProfileDashboardShell.jsx`, `ProfilePageChrome.jsx` | `tests/profile-dashboard-schedule.test.mjs`, `tests/e2e/client-primary-visual.spec.js` |

## Тренировки

| Нужно изменить | Сначала открыть | Связанная логика |
| --- | --- | --- |
| Базовая программа и генерация на сегодня | `BasicWorkoutQuizPage.jsx`, `BasicWorkoutTodayPage.jsx` | `src/utils/basicWorkoutPlanBuilder.js`, `basicWorkoutSchedule.js`, `basicWorkoutTodayFallback.js`, `functions/basicWorkoutTodayPlan.js` |
| 4-недельный план | `WorkoutPlanPage.jsx`, `workoutPlanRouteHandlers.js`, `workoutPlanUpdateHandlers.js` | `src/utils/workoutPlanNormalization.js`, `workoutPlanMode.js`, `workoutSchedule.js` |
| Пропуск / перенос / порядок следующих тренировок | `workoutReschedule.js`, `workoutCompletion.js` | `src/utils/workoutSchedule.js`, `workoutPlanNormalization.js`, `basicWorkoutSchedule.js` |
| Экран активной тренировки | `WorkoutRunRoute.jsx`, `WorkoutRunPageShell.jsx`, `WorkoutRunStageView.jsx` | `useWorkoutRunViewModel.js`, `workoutRuntimeHandlers.js`, `workoutRunNavigationHandlers.js` |
| Подходы, вес, история упражнения | `WorkoutExerciseSets.jsx`, `WorkoutStageActionPanel.jsx` | `src/utils/exerciseWeightInput.js`, `exerciseProgress.js`, `workoutDraftState.js` |
| Отдых, таймер, вибрация, сворачивание | `WorkoutRestTimer.jsx`, `WorkoutRestTimer.module.css`, `WorkoutRunOverlays.jsx` | `workoutCountdownTimer.js`, `workoutRuntimeHandlers.js`, `tests/workout-timer-runtime.test.mjs`, `tests/e2e/client-rest-timer.spec.js` |
| Завершение и экран результата | `WorkoutFinishStage.jsx`, `workoutCompletionViewHelpers.js` | `workoutFirebaseSaveHandlers.js`, `workoutHistoryHandlers.js`, `tests/workout-completion.test.mjs` |
| История и рекорды | `WorkoutHistoryPage.jsx`, `workoutHistoryNavigation.js` | `workoutHistoryDedupe.js`, `src/utils/workoutHistoryPresentation.js` |

## Питание

| Нужно изменить | Сначала открыть | Связанная логика |
| --- | --- | --- |
| Поиск продукта / выдача | `FoodSearchPage.jsx`, `FoodSearchOverlay.jsx`, `FoodSearchResults.jsx` | `src/utils/nutritionSearchResults.js`, `localNutritionCatalog.js`, `nutritionSearchDeadline.js` |
| Карточка продукта / порция / макросы | `FoodProductPage.jsx`, `FoodPortionSelector.jsx`, `FoodProductNutrition.jsx` | `nutritionPortions.js`, `nutritionNumbers.js`, `nutritionFoodTotals.js` |
| Добавление и редактирование еды | `FoodEditPage.jsx`, `NutritionMealModal.jsx` | `nutritionFoodCommitHandlers.js`, `nutritionFoodEntryHandlers.js`, `nutritionDish.js` |
| Поиск по фото | `FoodPhotoAiSearchProcess.jsx`, `NutritionPhotoAiPreview.jsx`, `NutritionPhotoNotFoundModal.jsx` | `nutritionPhotoAiHandlers.js`, `src/utils/nutritionPhotoAi.js`, `src/utils/imageCompression.js`, backend `functions/index.js` |
| Голосовой ввод | `NutritionVoiceModal.jsx`, `useNutritionVoiceRuntime.js` | `nutritionVoiceHandlers.js`, `nutritionVoicePortions.js`, backend `functions/voiceFoodAmounts.js` |
| Календарь и дневной итог | `NutritionCalendarModal.jsx`, `NutritionSummary.jsx`, `NutritionMacroScoreRing.jsx` | `nutritionCalendar.js`, `nutritionPageDerivedState.js`, `nutritionFoodTotals.js` |
| Цели и AI-план питания | `NutritionPlanDetails.jsx`, `aiNutritionPlanHandlers.js` | `aiNutritionPlanBuilder.js`, `aiNutritionSchedule.js`, `clientNutritionPlan.js` |

## Профиль, прогресс и уведомления

| Нужно изменить | Сначала открыть | Связанная логика |
| --- | --- | --- |
| Анкета, тело и цели | `ProfileBodyMetricsSettingsSection.jsx`, `ProfileNutritionModal.jsx` | `profileDefaults.js`, `profileMeasurements.js`, `clientNutritionPlan.js` |
| Быстрый вес | `ProfileQuickWeightModal.jsx` | `profileMeasurements.js`, `tests/profile-quick-weight.test.mjs` |
| Полный замер тела | `MeasurementWizardPage.jsx` | `profileMeasurements.js`, assets `public/measurements/` |
| Фото прогресса | `ProfileProgressPhotosModal.jsx` | `firebaseStorage.js`, `imageCompression.js` |
| Аккаунт, Telegram, reminders | `ProfileAccountSettingsSection.jsx`, `ProfileTelegramModal.jsx`, `ProfileTrainerNotificationsModal.jsx` | `profileTelegramHandlers.js`, `clientTelegramProfile.js`, backend `functions/reminderSchedule.js` |
| Обратная связь | `ProfileFeedbackModal.jsx` | `src/utils/appFeedback.js`, `errorReporting.js` |

## Тренер и администратор

| Сценарий | Точки изменения | Проверка |
| --- | --- | --- |
| Дашборд тренера | `src/features/trainer/TrainerDashboardRoute.jsx`, `TrainerDashboardGrid.jsx` | `tests/trainer-client-summary.test.mjs`, `tests/e2e/trainer-workspace.spec.js` |
| Карточка и вкладки клиента | `TrainerClientsWorkspaceRoute.jsx`, `TrainerClientTrainingTab.jsx`, `TrainerClientCalendarNutritionTab.jsx` | `trainerClient*Handlers.js`, `trainerClientSummaryLoader.js` |
| Конструктор программы | `TrainerProgramManagerView.jsx`, `TrainerProgramWorkoutDayEditor.jsx`, `TrainerProgramConstructor.jsx` | `trainerPlanEditorHandlers.js`, `trainerMonthProgram*`, `trainerProgramValidation.js` |
| Назначение программы и доступы | `TrainerProgramAssignmentAdjustmentModal.jsx` | `trainerProgramAssignment.js`, `trainerProgramAccess.js`, `trainerClientProgramAssignments.js` |
| Админ: пользователи, библиотека, роли | `src/components/admin/`, `src/features/trainer/Admin*.jsx` | `roleAccess.js`, `adminClient*.js`, `tests/security-boundaries.test.mjs`, `tests/role-access.test.mjs` |

## Общий UI и стили

| Задача | Где искать |
| --- | --- |
| Глобальные токены и reset | `src/styles/_variables.css`, `src/styles/_reset.css`, `src/styles/index.css` |
| Текущий calm-blue контракт клиента | `src/AppCoreClientAppleTheme.css`; раскладка остаётся в CSS Modules компонентов |
| Нижняя навигация | `src/shared/ui/BottomBar.jsx`, `BottomBar.module.css`, `src/features/client/navigation/` |
| Шапка клиентских экранов | `src/shared/ui/ClientPageHeader.jsx` |
| Общая shell / mobile layout | `src/shared/ui/ClientAdaptiveShell.module.css`, `src/AppCore*module.css` |
| Модальная оболочка | `src/shared/ui/ResponsiveModalLayer.module.css`, `src/shared/hooks/useBodyScrollLock.js`, `useModalFocusTrap.js` |
| Уведомление об успешном сохранении | `src/shared/ui/SaveSuccessNotice.jsx` |
| Morph icons | `src/shared/ui/MorphingIcon.jsx` |

Правило: стили компонента остаются рядом с ним. Новые глобальные правила добавлять только в `src/styles/`, если они действительно кросс-приложенческие.

## Firebase, данные и Android

| Область | Файлы |
| --- | --- |
| Инициализация Firebase | `src/firebase.js`, `firebase.json` |
| Правила доступа | `firestore.rules`, `storage.rules`, `tests/firestore-rules.rules.mjs` |
| Cloud Functions | `functions/index.js` и соседние модули в `functions/` |
| Storage файлов | `src/utils/firebaseStorage.js`, `src/utils/imageCompression.js` |
| Каталог продуктов | `src/data/nutrition-catalog/`, `public/nutrition-catalog/`, `scripts/build-nutrition-catalog.mjs` |
| Медиа упражнений и замеров | `public/videos/`, `public/measurements/`, `public/basic-workout/illustrations/` |
| Android | `capacitor.config.ts`, `android/`, `docs/android-build.md` |

Не помещать секреты в эти документы или в клиентский код. Секреты Functions определены через Firebase `defineSecret`.

## Проверка перед завершением

| Изменение | Минимальная проверка |
| --- | --- |
| Любой runtime-код | `npm.cmd run build` |
| Изменение чистой логики | соответствующий `node --test tests/<module>.test.mjs` |
| UI / responsive / modals | релевантный Playwright spec из `tests/e2e/` |
| Firestore access / role | `npm.cmd run test:rules` и security/role tests |
| Перед выпуском | `npm.cmd run verify` + [docs/release-operations.md](docs/release-operations.md) |

## Рядом лежащая документация

- [architecture](docs/architecture.md) — границы импортов и сборки.
- [environments](docs/environments.md) — среда и Firebase.
- [release operations](docs/release-operations.md) — выпуск.
- [production smoke checklist](docs/production-smoke-checklist.md) — ручная проверка.
- [android build](docs/android-build.md) — сборка Android.
- [product audit](docs/APP_AUDIT_2026-09-06.md) — текущий продуктовый аудит.
