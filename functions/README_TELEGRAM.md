# Telegram backend

## 1. Создать Telegram bot
Открой @BotFather → `/newbot` → получи token.

## 2. Сохранить token в Firebase Secret

```bash
firebase functions:secrets:set TELEGRAM_BOT_TOKEN --project <your-firebase-project-id>
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
npm ci --prefix functions
firebase deploy --only functions,hosting --project <your-firebase-project-id>
```
## Важно
Для реальной отправки Telegram нужен `chatId`. Username сам по себе не всегда работает.
Следующий этап — webhook `/telegram/webhook`, который будет получать `/start <code>` от клиента и сохранять chatId.


## 5. Deploy webhook functions

```bash
firebase deploy --only functions --project <your-firebase-project-id>
```

## 6. Установить webhook Telegram

`telegramSetWebhook` принимает только `POST` от активного администратора с
Firebase ID token (и App Check token, если включён enforcement). URL webhook
берётся из `TELEGRAM_WEBHOOK_URL` или выводится из текущего project ID. Не
открывай старый GET URL в браузере и никогда не подставляй production URL в
staging. Перед вызовом проверь per-project values в
`functions/.env.<project-id>`.

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

Important: Telegram avatars are cached in Firebase Storage. The resulting
download URL can contain a Storage download token, so do not expose it in
unnecessary logs or screenshots; it does not contain the Telegram bot token.


## Telegram Login Widget

Для красивой авторизации через Telegram нужно в BotFather выполнить:

```text
/setdomain
```

Выбрать бота и указать домен:

```text
<your-firebase-project-id>.web.app
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
firebase deploy --only functions,hosting --project <your-firebase-project-id>
```
