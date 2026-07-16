# Telegram backend

## 1. Создать Telegram bot
Открой @BotFather → `/newbot` → получи token.

## 2. Сохранить token в Firebase Secret

```bash
firebase functions:secrets:set TELEGRAM_BOT_TOKEN
```

## 3. Добавить rewrites в firebase.json

```json
{
  "source": "/api/telegram/send-message",
  "function": {
    "functionId": "telegramSendMessage",
    "region": "europe-west1"
  }
}
```

## 4. Deploy

```bash
cd functions
npm install
cd ..
firebase deploy --only functions,hosting
```

## Важно
Для реальной отправки Telegram нужен `chatId`. Username сам по себе не всегда работает.
Следующий этап — webhook `/telegram/webhook`, который будет получать `/start <code>` от клиента и сохранять chatId.


## 5. Deploy webhook functions

```bash
firebase deploy --only functions
```

## 6. Установить webhook Telegram

После deploy возьми URL функции `telegramWebhook`, затем выполни в браузере или через curl:

```bash
https://europe-west1-tren-85720.cloudfunctions.net/telegramSetWebhook?url=https://europe-west1-tren-85720.cloudfunctions.net/telegramWebhook
```

Если проект/регион отличается — замени URL.

## Как работает привязка
1. Клиент в приложении нажимает “Привязать Telegram”.
2. Приложение создаёт `telegramLinkCode` в `users/{uid}`.
3. Открывается бот с `/start CODE`.
4. `telegramWebhook` получает `chatId` и сохраняет его в `users/{uid}.telegram.chatId`.
5. После этого сообщения из админки и напоминания отправляются реально.


## Telegram avatar/name
`telegramWebhook` now saves:
- `telegram.chatId`
- `telegram.telegramUserId`
- `telegram.username`
- `telegram.displayName`
- `telegram.firstName`
- `telegram.lastName`
- `telegram.avatarUrl`

Important: Telegram avatar URL contains the bot token inside the file URL. It works for displaying the avatar, but do not expose the bot token in logs/screenshots. Later it is better to proxy/cache avatars through Firebase Storage.


## Telegram Login Widget

Для красивой авторизации через Telegram нужно в BotFather выполнить:

```text
/setdomain
```

Выбрать бота и указать домен:

```text
tren-85720.web.app
```

Также добавь rewrite в `firebase.json`:

```json
{
  "source": "/api/telegram/login-verify",
  "function": {
    "functionId": "telegramLoginVerify",
    "region": "europe-west1"
  }
}
```

После этого:

```bash
firebase deploy --only functions,hosting
```


## Telegram Login Widget через auth_url

Добавь rewrite в `firebase.json`:

```json
{
  "source": "/api/telegram/login-callback",
  "function": {
    "functionId": "telegramLoginCallback",
    "region": "europe-west1"
  }
}
```

Этот режим надёжнее на мобильном Chrome, чем `data-onauth`, потому что Telegram редиректит данные авторизации прямо на backend.
