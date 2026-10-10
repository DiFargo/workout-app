# Вход через Telegram Mini App

Экран входа предлагает Telegram первым способом. Mini App отправляет подписанный
`Telegram.WebApp.initData` на сервер; сервер проверяет подпись и срок действия,
ищет уже привязанный Telegram ID среди активных аккаунтов и только затем выдаёт
Firebase Custom Token. Bot token и Firebase Admin SDK остаются на сервере.

Новый Telegram-аккаунт не создаётся автоматически: тренерские роли и приглашения
сохраняют существующие правила доступа. Если Telegram ещё не привязан, пользователь
входит прежним способом и привязывает Telegram в профиле.

Для одноразового тестового входа в staging разрешён отдельный bootstrap только
для одного заранее заданного Telegram ID и email. Настройки хранятся в игнорируемом
`.env.tren-85720-staging` внутри отдельного Functions codebase; в production этот
флаг выключен. Создаётся профиль только с ролью `client`, без копирования данных
из production. Повторные и другие Telegram ID не создают новые аккаунты.

## Подготовка каждого Firebase-проекта

1. В `@BotFather` назначить URL Mini App кнопке меню тестового или production-бота.
2. Записать токен именно этого бота в секрет соответствующего Firebase-проекта:

   ```powershell
   firebase functions:secrets:set TELEGRAM_MINI_APP_BOT_TOKEN --project tren-85720-staging
   ```

   Ввести токен в интерактивный запрос Firebase CLI. Не вставлять токен в исходники,
   переписку, `.env` для клиентской сборки или Git.
3. Развернуть Hosting и Cloud Function в том же проекте. Сначала проверить staging;
   production требует отдельной настройки его bot token и отдельного deploy.

Тестовый и production-боты используют разные секреты в своих Firebase-проектах.
