# Workout App

Mobile-first fitness application built with React, Vite and Firebase.

The current architecture notes, layer boundaries and verification commands are documented in:

- [docs/architecture.md](docs/architecture.md)
- [docs/environments.md](docs/environments.md)
- [docs/mvp-execution-plan-v2.md](docs/mvp-execution-plan-v2.md)
- [docs/release-operations.md](docs/release-operations.md)
- [docs/refactor-status.md](docs/refactor-status.md)
- [docs/codex-team-setup.md](docs/codex-team-setup.md) — настройка второго Windows-компьютера для работы в Codex по общим правилам.

## Локальный просмотр админки

Из корня репозитория с Node.js 22:

```powershell
npm.cmd ci
npm.cmd run dev:admin
```

Открыть [локальную админку](http://127.0.0.1:4175/). Запуск использует настоящие `AdminPanelHub`, `AdminUsersWorkspaceRoute` и `AdminLibraryRoute` с текущим оформлением. Данные синтетические, хранятся в памяти локального сервера и сбрасываются при его перезапуске. Настройка `VITE_FIREBASE_*` и доступ к Production не нужны.

Старый `adminHarness` используется только внутренними E2E-проверками и не является рабочей локальной версией. Для настоящей авторизации и серверных операций требуется отдельно согласованное [staging-окружение](docs/environments.md).

Для обновления чистой рабочей папки на ветке `main` остановить свой сервер и выполнить:

```powershell
git status --short
git pull --ff-only origin main
npm.cmd ci
npm.cmd run dev:admin
```

При локальных изменениях или расхождении истории сначала сохранить свою работу и согласовать перенос; не удалять правки ради обновления. Подробнее — [настройка второго компьютера](docs/codex-team-setup.md).
