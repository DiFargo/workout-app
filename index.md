# Workout App — быстрый вход

Этот файл — короткая карта для работы с репозиторием. Он не заменяет [AGENTS.md](AGENTS.md): правила из `AGENTS.md` обязательны и имеют приоритет.

## Что это за проект

Мобильное fitness-приложение на React + Vite + Firebase: клиентская часть, кабинет тренера, админ-панель, Cloud Functions, PWA и Android-оболочка Capacitor.

## Начинать отсюда

1. Прочитать `AGENTS.md` — границы изменений, безопасность ролей и дизайн-система.
2. Открыть [project_map.md](project_map.md) и выбрать модуль по пользовательскому сценарию.
3. Просмотреть целевой JSX/JSX-модуль, его colocated CSS и тесты с тем же префиксом.
4. Менять минимальный набор файлов. Не переносить логику обратно в `src/App.jsx`.
5. Проверить изменение подходящими тестами и сборкой.

## Рабочий цикл GPT-6 Astra

1. Сначала зафиксировать ожидаемый результат и короткие критерии готовности.
2. Брать контекст точечно через карту: целевой маршрут, компонент, CSS Module, зависимости и тесты.
3. Для понятной задачи сразу выполнять работу; уточнять только решение, которое нельзя безопасно вывести из продукта или которое меняет результат.
4. Выбирать проверку по риску: документация — diff и ссылки; UI — сборка и целевой экран; бизнес-логика, Firebase и роли — профильные тесты и smoke-проверка.
5. После явной просьбы о публикации сперва собрать, затем опубликовать и проверить живую версию.

## Основные точки входа

| Задача | Сначала открыть |
| --- | --- |
| Запуск, авторизация, маршруты | `src/main.jsx`, `src/App.jsx`, `src/AppCore.jsx`, `src/app/` |
| Экран клиента | `src/features/client/` и `src/shared/ui/` |
| Тренировки | `src/features/client/workouts/`, `src/utils/workout*.js` |
| Питание | `src/features/client/nutrition/`, `src/utils/nutrition*.js` |
| Кабинет, вес, замеры, фото | `src/features/client/profile/`, `src/features/client/measurements/` |
| Тренер | `src/features/trainer/`, `src/components/trainer/`, `src/utils/trainer*.js` |
| Администратор | `src/components/admin/`, `src/features/trainer/Admin*.jsx`, `src/utils/admin*.js` |
| Firebase / API / фоновые задачи | `src/firebase.js`, `functions/`, `firestore.rules`, `storage.rules` |
| Стили / общий UI | `src/styles/`, `src/shared/ui/`, CSS Module рядом с компонентом |
| Тест или выпуск | `tests/`, `tests/e2e/`, `scripts/`, `docs/release-operations.md` |

## Команды

```powershell
npm.cmd run build        # production-сборка
npm.cmd run verify:core  # build + unit tests + critical lint + budget
npm.cmd run test:e2e     # Playwright UI-regression
npm.cmd run test:rules   # Firestore rules
npm.cmd run android:build # production build + sync Capacitor Android
```

## Рабочие ограничения

- `src/App.jsx` остаётся тонкой оболочкой; `src/AppCore.jsx` — координатором.
- `src/domain/` и `src/utils/` не импортируют React или UI.
- Не смешивать напрямую `features/client` и `features/trainer`.
- Не менять Firebase, доступы, роли, навигацию или публичные контракты без явной задачи.
- Для клиентского UI сохранять mobile-first и проверять safe areas, нижнюю навигацию, модальные окна и 44 px touch targets.
- Не публиковать без явной просьбы пользователя.

## Поддержка карты

При добавлении нового крупного маршрута, доменного модуля или изменении владельца файла обновить `project_map.md` в той же задаче. Карта должна оставаться маршрутом к исходнику, а не дублировать реализацию.
