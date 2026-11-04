# Project map

Карта предназначена для быстрого поиска точки изменения. Путь в первой колонке — стартовая точка: перед правкой обязательно проверить её импорты, CSS Module и тесты с одноимённым префиксом.

## Слои и ответственность

| Слой | Назначение | Где искать |
| --- | --- | --- |
| Bootstrap | React root, service worker, error boundary | `src/main.jsx`, `src/App.jsx`, `src/app/AppBootstrap.jsx` |
| Авторизация | Вход Telegram Mini App первым способом; отдельный Cloud Functions codebase без AI-секретов | `src/components/auth/AuthScreens.jsx`, `src/features/auth/authHandlers.js`, `functions-telegram-auth/` |
| Telegram-приглашение после нижней кнопки | `functions/index.js` → `startTelegramClientInvite`; `functions-telegram-auth/telegramPendingInvite.js`, `index.js`; `src/app/appStartupGate.jsx` | Серверный `telegramPendingClientInvites/{telegramId}` хранит последнее начатое приглашение; вход повторно проверяет его в транзакции. Экран ожидающего клиента позволяет принять/проверить приглашение без повторной регистрации. Чужие live UID не объединяются. |
| Координация | глобальное состояние, сборка route context | `src/AppCore.jsx` |
| Физический ключ администратора | `AdminSecurityKeyBoundary.jsx`, `AdminSecurityKeyContext.js`, `adminSecurityKeyClient.js`; сервер `functions/adminSecurityKeys.js`, `adminSecurityKeyAccess.js` | Личная активация после входа, затем WebAuthn proof до 8 часов с привязкой к роли; API/Firestore/Storage защищены. Инструкция: `docs/admin-security-keys.md`. |
| Производные данные тренировки | memo истории/плана отдельно от отображения секунд | `src/app/useWorkoutPageDerivedState.js`, `src/utils/workoutPageDerivedState.js` |
| Навигация | список страниц, доступ, back navigation, lazy routes | `src/app/appPages.js`, `src/app/appNavigation.js`, `src/app/appRouteRenderer.jsx`, `src/app/AppRouter.jsx` |
| Client features | экраны и обработчики клиента | `src/features/client/` |
| Trainer features | экраны и обработчики тренера | `src/features/trainer/` |
| Shared UI | общие панели, шапки, модальные примитивы, hooks | `src/shared/ui/`, `src/shared/hooks/` |
| Domain / utils | чистая бизнес-логика и преобразования данных | `src/domain/`, `src/utils/` |
| Backend | основной набор callable/HTTP functions, Telegram, reminders, AI | `functions/`; Telegram Mini App auth отдельно: `functions-telegram-auth/` |

## Клиент: пять главных вкладок

Эталон геометрии: [«Свой ритм» — компактные пять экранов](docs/client-five-main-screens-signature.html). Утверждённая палитра задаётся `AGENTS.md`: canvas `#F2F2F7`, text `#1C1C1E`, accent `#3C6FAA`, success `#237A42`. По подтверждению пользователя 30 октября 2026 основные залитые действия сохраняют сине-зелёный `--ownset-action-gradient` (канонический токен в `src/styles/_variables.css`); однотонный синий не заменяет эту заливку. Цветовые акценты текста, графиков и статусов остаются цветами, а не градиентами. [OwnSet preview](docs/ownset-gradient-preview.html) остаётся историческим примером композиции, не заменяет текущую геометрию. В runtime используются реальные данные и существующие обработчики, не демонстрационная логика макета.
Техническое состояние каскада: базовые алиасы `src/styles/_variables.css` и `src/AppCoreFoundation.module.css` перекрываются активными Apple/iOS контрактами `src/AppCoreClientAppleTheme.css` и `src/AppCoreClientIosTheme.module.css`. Сейчас они содержат canvas `#f5f7f8`, text `#1c282e`, action `#396ba6`; это зафиксированное расхождение с утверждённой палитрой, а не её новое утверждение. Владелец токенов, порядок/специфичность и границы будущего согласования описаны в [architecture](docs/architecture.md#visual-token-ownership). Не менять визуальную палитру в рамках исправления документации; для локальных задач проверять computed styles реального shell и сохранять текущую геометрию/поведение.
Предыдущий эталон сохранён: `docs/client-five-main-screens-native-refinement.html?palette=calm-blue`.
Шапки экранов: `src/shared/ui/ClientPageHeader.jsx`, `ClientPageHeader.module.css`. Декоративные полоски убраны по просьбе пользователя; заголовки и функциональные действия сохранены. Геометрия каждого экрана остаётся в его CSS Module.
Регрессия нового интерфейса и основных действий: `tests/e2e/client-native-refinement.spec.js`.

| Сценарий | Точки изменения | Проверка |
| --- | --- | --- |
| Главная / сводка | `src/AppCore.jsx`, `src/app/appRouteRenderer.jsx`, `src/features/client/profile/ProfileSummaryDashboard.jsx`, `src/features/client/profile/profileDashboardModel.js` | `tests/client-ux.test.mjs`, `tests/profile-body-measurement-reminder.test.mjs`, `tests/e2e/client-primary-visual.spec.js` |
| Тренировки: список и режим | `src/features/client/workouts/WorkoutListPage.jsx`, `WorkoutModePage.jsx`, `WorkoutRenderOverview.jsx`, `src/features/client/navigation/` | `tests/workout-entry-navigation.test.mjs`, `tests/workout-presentation.test.mjs`, `tests/e2e/client-workout-visual.spec.js` |
| Клиентская программа: порядок и достижения | `WorkoutListPage.jsx`, `WorkoutListDialogs.jsx`, `src/utils/clientWorkoutProgramOrder.js`, `workoutHistoryAchievements.js` | Порядок модала восстанавливается по исходному ID-календарю отдельно от исполнительных индексов. История за всё время загружается при открытии через `profileAchievementsHistory.js` с `requireDetails`; только подтверждённые факты. Проверки: `tests/client-program-order.test.mjs`, `tests/workout-history-achievements.test.mjs`, `tests/workout-history-dialog.test.mjs`. |
| Питание: дневник | `src/features/client/nutrition/NutritionRoute.jsx`, `NutritionPage.jsx`, `NutritionDiary.jsx`, `NutritionMainContent.jsx` | `tests/nutrition-calendar.test.mjs`, `tests/nutrition-food-presentation.test.mjs`, `tests/e2e/client-nutrition-visual.spec.js` |
| Прогресс / замеры / фото | `src/features/client/profile/ProfileProgressPhotosModal.jsx`, `ProfileMeasurementsModal.jsx`, `src/features/client/measurements/MeasurementWizardPage.jsx` | `tests/profile-measurements.test.mjs`, `tests/profile-quick-weight.test.mjs` |
| Кабинет | `src/features/client/profile/ProfileDashboardRoute.jsx`, `ProfileDashboardShell.jsx`, `ProfilePageChrome.jsx` | `tests/profile-dashboard-schedule.test.mjs`, `tests/e2e/client-primary-visual.spec.js` |

UX-доработки 3.0.852–3.0.853: `profile/profileProgressChart.js` задаёт календарный период и временную шкалу графика. `src/app/initialWorkoutHandlers.js` отвечает за безопасный повтор загрузки/синхронизации; первичная загрузка не блокирует всю оболочку, но запуск тренировки ждёт достоверного плана. `src/app/AdminLibraryRoute.jsx` и клиентский кабинет загружаются отложенно; тренерские стили — вместе с ролевым маршрутом. Профильная проверка: `tests/ux-startup-remediation.test.mjs`. Результаты всех 38 пунктов и границы проверки: [отчёт о внедрении](docs/UX_AUDIT_REMEDIATION_3.0.852.md).

## Тренировки

| Нужно изменить | Сначала открыть | Связанная логика |
| --- | --- | --- |
| Базовая программа и генерация на сегодня | `BasicWorkoutQuizPage.jsx`, `BasicWorkoutTodayPage.jsx`, `BasicWorkoutFormatSwitcher.jsx` | Два формата: одно занятие (зоны → условия → просмотр) и программа на 4 недели с прямым выбором ответов. `src/utils/basicWorkoutPlanBuilder.js`, `basicWorkoutSchedule.js`, `basicWorkoutTodayFallback.js`, `functions/basicWorkoutTodayPlan.js`; сохранение и ограничения доступа сохраняются. |
| Персонализированный подбор Gemini | `functions/basicWorkoutGemini.js`, `functions/basicWorkoutHybridPlan.js`, `functions/basicWorkoutPersonalization.js`, `src/utils/basicWorkoutClientContext.js` | Общий профиль/история для двух режимов, ограниченный каталог; [контракт 3.0.792](docs/basic-workout-personalization-792.md) |
| Акцент недельной программы | `functions/basicWorkoutEmphasis.js`, `BasicWorkoutQuizPage.jsx`, `src/utils/basicWorkoutQuizDraft.js` | Сбалансированно / ноги и ягодицы / верх / прежняя схема; [контракт 3.0.793](docs/basic-workout-emphasis-793.md) |
| 4-недельный план | `WorkoutPlanPage.jsx`, `workoutPlanRouteHandlers.js`, `workoutPlanUpdateHandlers.js` | `src/utils/workoutPlanNormalization.js`, `workoutPlanMode.js`, `workoutSchedule.js` |
| Пропуск / перенос / порядок следующих тренировок | `workoutReschedule.js`, `workoutCompletion.js` | `src/utils/workoutSchedule.js`, `workoutPlanNormalization.js`, `basicWorkoutSchedule.js` |
| Экран активной тренировки | `WorkoutRunRoute.jsx`, `WorkoutRunPageShell.jsx`, `WorkoutRunStageView.jsx` | `useWorkoutRunViewModel.js`, `workoutRuntimeHandlers.js`, `workoutRunNavigationHandlers.js` |
| Подходы, вес, история упражнения | `WorkoutExerciseSets.jsx`, `WorkoutStageActionPanel.jsx` | `src/utils/workoutPrimaryAction.js`: отдельные выполнение/переход и границы групп; `exerciseWeightInput.js`, `exerciseProgress.js`, `workoutDraftState.js` |
| Выбор упражнения и история внутри тренировки | `WorkoutRunStageView.jsx`, `WorkoutExercisePicker.jsx`, `WorkoutExerciseModals.jsx`, `WorkoutExerciseProgressChart.jsx` | `src/utils/workoutExerciseNavigation.js`: переход по execution steps без выполнения; `workoutExerciseHistory.js`: по нажатию, свой UID, все программы, страницы по 20 тренировок (+1 для hasMore), курсор date/docId без чтения всей истории; `workoutExerciseProgress.js`: фактические рабочие подходы, единицы измерения и честная полнота графика |
| Отдых, таймер, вибрация, сворачивание | `WorkoutRestTimer.jsx`, `WorkoutRestTimer.module.css`, `WorkoutRunOverlays.jsx` | `workoutCountdownTimer.js`, `workoutRuntimeHandlers.js`, `tests/workout-timer-runtime.test.mjs`, `tests/e2e/client-rest-timer.spec.js` |
| Защищённое видео всех ролей | `src/components/media/ProtectedExerciseVideo.jsx`, `src/utils/protectedExerciseVideo.js` | `functions/protectedExerciseVideo.js`, `src/utils/firebaseStorage.js`, `scripts/sync-protected-exercise-videos.mjs`; временные ссылки, без офлайн-кэша видео. Выбранный кадр-превью: `functions/exerciseVideoPoster.js`, редактор `src/components/trainer/ExerciseVideoCropEditor.jsx`; [проверки 3.0.862](docs/EXERCISE_VIDEO_PREVIEW_3.0.862.md) |
| Поздняя догрузка кадров и старый черновик | `workoutFirebaseLoadHandlers.js`, `workoutPersistenceHandlers.js`, `src/utils/workoutMediaMerge.js` | Узкое слияние media после старта без перезаписи подходов/заметок; `workoutDraftState.js` дополняет отсутствующий кадр только для того же источника. Проверки: `tests/workout-plan-load-latency.test.mjs`, `tests/workout-media-merge.test.mjs`, `tests/workout-draft-resume.test.mjs` |
| Автосохранение и восстановление черновика | `useWorkoutRuntimeEffects.js`, `workoutOpenHandlers.js`, `WorkoutListPage.jsx` | `workoutDraftStorage.js`: основной синхронный localStorage, выбор свежего снимка; `workoutDraftFallbackStorage.js`: резерв IndexedDB при отказе записи, очередь по UID/тренировке, подтверждение транзакции; `workoutPlanStorage.js`: вторичные копии без readModel и _editorSnapshot, основной офлайн-план не меняется. Проверки: `workout-draft-warning`, `workout-draft-resume`, `workout-draft-fallback-storage`, `workout-plan-storage`. |
| Завершение и экран результата | `WorkoutFinishStage.jsx`, `workoutCompletionViewHelpers.js` | `workoutFirebaseSaveHandlers.js`, `workoutHistoryHandlers.js`, `tests/workout-completion.test.mjs` |
| История и рекорды | `WorkoutHistoryPage.jsx`, `workoutHistoryNavigation.js` | `workoutHistoryDedupe.js`, `src/utils/workoutHistoryPresentation.js` |

## Питание

Поиск по 7 552 доступным карточкам (включая 150 базовых) и дополнительный Gemini: [описание](docs/gemini-nutrition-test-mode.md). Архив 10 103 товарных строк и отдельный поисковый payload: `public/nutrition-catalog/personal/`; worker `src/utils/personalNutritionCatalog.worker.js`, ранжирование `personalCatalogSearch.js`; `GEMINI_ONLY_FOOD_SEARCH=false`. Пополнение: `scripts/append-belarus-manufacturer-catalog.mjs`, дедупликация `scripts/lib/appendManufacturerFoods.mjs`, карантин `scripts/lib/personalCatalogQuarantine.mjs`. Базовый слой: `src/data/nutrition-catalog/basicFoods.compact.json`. Сервер Gemini: `functions/geminiNutritionSearch.js`.

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
| Честные состояния главной | `ProfileSummaryDashboard.jsx`, `profileDashboardPresentation.js`, `profileDashboardTasks.js` | `useClientDataDemand.js` возвращает загрузку/ошибку/наличие данных текущей auth-сессии; повтор не стирает записи. Нет ложного нуля питания по кэшу другого дня и сравнения веса без двух записей. Проверки: `profile-dashboard-clarity.test.mjs`, `client-demand-resource-state.test.mjs`, `client-demand-strict-loaders.test.mjs`. |
| Достижения клиента | `ProfileAchievementsModal.jsx`, `ProfileMeasurementWizardPanel.jsx` | `profileAchievements.js`: подтверждённые сессии, недели и накопительные месяцы; `profileAchievementsHistory.js`: полная история только текущего auth-сеанса, чтение при открытии. Проверки: `tests/profile-achievements.test.mjs`, `tests/profile-achievements-history.test.mjs`. |
| Полный замер тела | `MeasurementWizardPage.jsx` | `profileMeasurements.js`, assets `public/measurements/` |
| Фото прогресса | `ProfileProgressPhotosModal.jsx` | `firebaseStorage.js`, `imageCompression.js`, `src/components/media/PrivateProgressPhoto.jsx`, `src/utils/privateProgressPhoto.js`; только authenticated blob для private Storage references |
| Подтверждение сохранения питания | `NutritionSyncRecovery.jsx`, `useNutritionRuntimeEffects.js` | `nutritionSyncRevision.js`, `nutritionStateStorage.js`: локальная копия, отправка и подтверждённое облако отделены; поздний ответ не подтверждает новый ввод. Проверки: `nutrition-save-feedback.test.mjs`, `nutrition-save-feedback-react.test.mjs`. |
| Аккаунт, Telegram, reminders | `ProfileAccountSettingsSection.jsx`, `ProfileTelegramModal.jsx`, `ProfileTrainerNotificationsModal.jsx` | `profileTelegramHandlers.js`, `telegramBotLink.js`, `useProfileTelegramEffects.js`: привязка через одноразовую ссылку бота, не iframe Login Widget; `clientTelegramProfile.js`, backend `functions/reminderSchedule.js` |
| Обратная связь | `ProfileFeedbackModal.jsx` | `src/utils/appFeedback.js`, `errorReporting.js` |

## Тренер и администратор

| Сценарий | Точки изменения | Проверка |
| --- | --- | --- |
| Дашборд тренера | `src/features/trainer/TrainerDashboardRoute.jsx`, `TrainerDashboardGrid.jsx` | `tests/trainer-client-summary.test.mjs`, `tests/e2e/trainer-workspace.spec.js` |
| Карточка и вкладки клиента | `TrainerClientsWorkspaceRoute.jsx`, `TrainerClientTrainingTab.jsx`, `TrainerClientCalendarNutritionTab.jsx` | `trainerClient*Handlers.js`, `trainerClientSummaryLoader.js` |
| Расписание и абонемент: список занятий | `TrainerScheduleAgenda.jsx`, `TrainerScheduleAgenda.module.css`; подключение в `TrainerWorkspace.jsx` | `trainerScheduleAgenda.js`: черновик и сохранение дат по ID, только будущие дни; недельное распределение сохраняет конкретные даты. Баланс/продление используют существующий callback. `TrainerSheetCloseContext.js` защищает несохранённый черновик в utility sheet. Проверки: `trainer-schedule-agenda.test.mjs`, `tests/e2e/trainer-schedule-agenda.spec.js`. |
| Первичная настройка клиента: веса и расписание | `TrainerClientSetupFlowModal.jsx` и его CSS Module; `trainerSetupSchedule.js` | Вес шаблона, добавка и итог отделены. Дни недели заполняют даты, ручные правки закреплены за ID текущей копии. `trainerProgramTemplateHandlers.js` возвращает те же lifecycle-метаданные, что записаны в Firebase, чтобы первое сохранение не давало ложный конфликт. Проверки: `trainer-setup-schedule-model.test.mjs`, `trainer-setup-assignment-schedule.test.mjs`; локальная форма `tests/e2e/fixtures/trainer-client-setup.html`. |
| Карточка клиента «Привычные разделы» | `TrainerWorkspace.jsx`, `TrainerClientFamiliar.module.css`, `TrainerClientFamiliarNutritionAnalytics.jsx` | Реальные даты веса и фото: `trainerClientCardPresentation.js`; завершённые дни и отсутствие записей: `trainerFamiliarNutritionAnalytics.js`. Действия и формы сохраняют существующие обработчики. |
| Конструктор программы | `TrainerProgramManagerView.jsx`, `TrainerProgramWorkoutDayEditor.jsx`, `TrainerProgramConstructor.jsx` | `trainerPlanEditorHandlers.js`, `trainerMonthProgram*`, `trainerProgramValidation.js` |
| Карточки упражнений в общем шаблоне | `TrainerProgramExerciseAccordion.jsx`, `TrainerExerciseQuickFields.jsx` | Панель скрывается без потери резерва подходов; `trainerProgramExerciseOrder.js` согласует порядок карточек с исполняемыми блоками, сохраняя группы целиком. |
| Редактор персональной программы | `TrainerWorkoutEditor` в `TrainerWorkspace.jsx`, `TrainerClientProgramExerciseCard.jsx`, `TrainerClientProgramEditor.module.css`; настройки — `TrainerClientExerciseSheet.jsx` и его CSS Module | Карточки отделяют будущую нагрузку от истории. Настройки группируют библиотеку, подходы и отдых, видео загружается только при раскрытии. `trainerAssignmentWorkoutOrder.js` восстанавливает смешанные глобальные/локальные позиции по полному ID-календарю; обычная правка в `trainerProgramDraftPersistence.js` не перенумеровывает дни. Сохранение и запрет изменения выполненных дней остаются в `useTrainerProgramDraft`. |
| Библиотека и выбор упражнения | Пункт «Упражнения» в `TrainerWorkspace.jsx`; `TrainerExerciseLibraryPicker.jsx`, `TrainerExerciseLibrarySearch.jsx` | `trainerNavigation.js`, `trainerWorkoutEditHelpers.js`: явный выбор источника и согласованная замена названия, карточки и медиа без изменения подходов; создание только в библиотеке |
| Пять основных экранов тренера | `TrainerWorkspace.jsx`, `TrainerDailyJournal.jsx`, `TrainerProgramOverviewPage.jsx`, `TrainerPrimaryScreens.module.css` | `trainerPrimaryScreenPresentation.js`: подписи и неизвестная оценка; `TrainerLibraryExercisePreview.jsx`: обложки только рядом с экраном без загрузки MP4; `tests/trainer-primary-screen-presentation.test.mjs`, `tests/trainer-library-preview.test.mjs` |
| Загрузка библиотеки тренера | `trainerProgramTemplateHandlers.js`, `src/app/trainerAsyncHandlers.js`, `trainerLibraryLoadState.js`, `TrainerLibraryLoadNotice.jsx` | Статусы шаблонов и карточек отделены от пустых массивов; данные видимы только после успешного чтения в текущем auth-сеансе. Ошибка и повтор не стирают доступный список. `tests/trainer-loading-stages.test.mjs`, `tests/trainer-library-load-state.test.mjs`, `tests/trainer-template-purpose.test.mjs` |
| Назначение программы и доступы | `TrainerProgramAssignmentAdjustmentModal.jsx`, `TrainerAssignmentExerciseProgress.jsx` | `trainerAssignmentProgress.js`: факт относительно исторического плана отдельно от новой программы; `trainerProgramAssignment.js`, `trainerProgramAccess.js`, `trainerClientProgramAssignments.js` |
| История программ клиента | `TrainerProgramHistoryPanel.jsx` и CSS Module; подключение в `TrainerWorkspace.jsx` | `trainerProgramHistoryPresentation.js`: текущая отдельно, другие новые сверху, просмотр состава. Удаление только пустого архива через `trainerProgramAssignmentDelete.js` → `functions/deleteEmptyClientProgramAssignment.js`; сервер перечитывает права и всю ограниченную историю в транзакции. История тренировок и общие шаблоны не удаляются. |
| История тренировок клиента | `TrainerWorkoutHistoryPanel.jsx` и CSS Module; подключение в `TrainerWorkspace.jsx` | `trainerWorkoutHistoryPresentation.js`: компактный список, поиск по загруженным записям, одно раскрытое занятие. План только из сохранённого snapshot; старые записи без плана показывают факт. Действие тренера остаётся привязано к последней тренировке текущего назначения. |
| Админ: пользователи, библиотека, роли | `src/components/admin/`, `src/features/trainer/Admin*.jsx` | `roleAccess.js`, `adminClient*.js`, `tests/security-boundaries.test.mjs`, `tests/role-access.test.mjs` |
| Админ: рабочая панель 3.0.916 | `AdminWorkspace.jsx`, `AdminPanelHub.jsx`, `AdminUsersWorkspace.jsx`, `AdminTrainerProfile.jsx`, `AdminBaseLibrary.jsx` | Поиск/роль/состояние и адресные действия; обслуживание и восстановление входа свёрнуты отдельно. `adminAssignableTrainer.js` сохраняет серверные ограничения кандидатов; `adminCatalogSearch.js` — локальный поиск по словам. `AdminTrainerProfileRoute.jsx` обновляет выбранный профиль только по актуальному ответу. `trainerUserLoadHandlers.js` сохраняет канонический ID документа. Проверки: `admin-operational-ui`, `admin-trainer-profile-ui`, `admin-catalog-ui`, `admin-basic-program-history-ui`, `tests/e2e/admin-audit-ux.spec.js`. |

`src/utils/trainerWorkspaceUx.js` содержит UID-изолированные локальные предпочтения ленты, правила выбора исторических дат и состояние полноты истории. `src/components/admin/adminAttentionQueue.js` — единый фильтр очередей сводки и каталога. Проверки UX-пакета: `tests/remediation-trainer-ux.test.mjs`, `tests/remediation-client-ux.test.mjs`, `tests/remediation-client-interactions.test.mjs`.

## Общий UI и стили

| Задача | Где искать |
| --- | --- |
| Глобальные токены и reset | `src/styles/_variables.css`, `src/styles/_reset.css`, `src/styles/index.css` |
| Утверждённая палитра / активные token overrides клиента | `AGENTS.md` — продуктовый контракт; `src/AppCoreClientAppleTheme.css`, `src/AppCoreClientIosTheme.module.css` — текущая реализация каскада; [владение и расхождение](docs/architecture.md#visual-token-ownership). Раскладка остаётся в CSS Modules компонентов |
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
| Единая кнопка Telegram / повторный запуск | `functions/telegramAppEntry.js`, `functions/telegramReminderMessages.js`, `src/main.jsx`, `src/app/telegramSingleInstance.js`, `TelegramDuplicateWindow.jsx`; блокировка только в общем origin/storage partition, приглашение сохраняется для повторного открытия |
| Storage файлов | `src/utils/firebaseStorage.js`, `src/utils/imageCompression.js` |
| Каталог продуктов | `src/data/nutrition-catalog/`, `public/nutrition-catalog/`, `scripts/build-nutrition-catalog.mjs` |
| Медиа упражнений и замеров | `public/videos/`, `public/measurements/`, `public/basic-workout/illustrations/`; видео библиотеки в назначенном плане: `functions/clientExerciseMedia.js`, `src/utils/clientExerciseMedia.js` |
| Дополнительные варианты базовой библиотеки с видео тренера | `src/data/basicWorkoutTrainerVideoAdditions.js`; медиа и кадрирование: `basicExerciseOverrides`, `src/utils/basicWorkoutExercisePresentation.js`; не расширяет автоматические планы |
| Android | `capacitor.config.ts`, `android/`, `scripts/prepare-android-version.mjs`, `docs/android-build.md`; [версия и baseline опубликованного APK/AAB](docs/release-operations.md#android-version-metadata-only-for-an-authorized-native-build) |

Не помещать секреты в эти документы или в клиентский код. Секреты Functions определены через Firebase `defineSecret`.

## Проверка перед завершением

| Изменение | Минимальная проверка |
| --- | --- |
| Любой runtime-код | `npm.cmd run build` |
| Изменение чистой логики | соответствующий `node --test tests/<module>.test.mjs` |
| UI / responsive / modals | релевантный Playwright spec из `tests/e2e/` |
| Firestore access / role | `npm.cmd run test:rules` и security/role tests |
| Перед выпуском | `npm.cmd run verify:full` + одобренные staging/production smoke по [docs/release-operations.md](docs/release-operations.md). `verify` — только сборка, artifact budgets и diff whitespace; не полный sign-off |

## Рядом лежащая документация

- [architecture](docs/architecture.md) — границы импортов и сборки.
- [environments](docs/environments.md) — среда и Firebase.
- [release operations](docs/release-operations.md) — выпуск.
- [production smoke checklist](docs/production-smoke-checklist.md) — ручная проверка.
- [android build](docs/android-build.md) — сборка Android.
- [product audit](docs/APP_AUDIT_2026-09-06.md) — текущий продуктовый аудит.

Библиотека упражнений тренера: `src/utils/trainerExerciseLibrary.js` объединяет повторы с сохранением видео; `src/utils/trainerLibraryMuscleGroups.js` определяет группы. Чистый модуль `functions/exerciseLibraryIdentity.js` используется и клиентской сборкой, и серверным поиском видео для единых правил названий.

Общие карточки упражнений и отдельная нагрузка: `functions/exerciseCards.js` — ссылки, снимки и совместимость со старыми копиями; `functions/trainerExerciseCards.js` — приватный серверный CRUD без полей нагрузки; `src/utils/trainerExerciseCards.js` — клиент API. Метаданные для клиента проходят через `functions/clientExerciseMedia.js`. Проверки: `tests/exercise-cards.test.mjs`, `tests/exercise-cards.rules.mjs`, `tests/e2e/trainer-exercise-cards.spec.js`. Модель и состав публикации: [exercise-card-separation](docs/exercise-card-separation.md).
