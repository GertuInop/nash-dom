# Наш Дом — бот MAX + мини-приложение

Мини-приложение — **три файла** в `bot/miniapp/`:

| Файл | Назначение |
|------|------------|
| `index.html` | Разметка + подключение [MAX Bridge](https://dev.max.ru/docs/webapps/bridge) |
| `app.css` | Стили (MAX / navy) |
| `app.js` | Логика UI + вызовы API + Bridge |

Документация: [Bridge](https://dev.max.ru/docs/webapps/bridge) · [API](https://dev.max.ru/docs-api) · [Мини-приложения](https://dev.max.ru/docs/webapps/introduction) · [Валидация](https://dev.max.ru/docs/webapps/validation)

## Связка с MAX

1. Bridge (`https://st.max.ru/js/max-web-app.js`) → `window.WebApp`
2. При старте читается `WebApp.initData`
3. Сервер `POST /api/auth/max` проверяет подпись HMAC (`WebAppData` + `BOT_TOKEN`)
4. Создаётся/находится пользователь по `max_user_id` в общей MySQL
5. Опционально: `WebApp.requestContact()` → `POST /api/auth/max/phone` (HMAC телефона)
6. `BackButton`, `enableClosingConfirmation`, `shareMaxContent` / `HapticFeedback`
7. В боте кнопка `openApp` (OpenAppButton) → URL из `MINIAPP_URL`

Бот и мини-приложение пишут в **одну БД** (`nash_dom`).

## Запуск

```bash
cd bot
cp .env.example .env
# BOT_TOKEN, ADMIN_USER_IDS, при необходимости MINIAPP_URL=https://...
docker compose up --build -d
```

Локально (без Docker-бота, только API + мини-приложение):

```bash
cd bot
docker compose up -d mysql
npm ci
npm run api
# http://127.0.0.1:3080/
```

## Подключение в кабинете MAX

По [инструкции](https://dev.max.ru/docs/webapps/introduction):

1. Залейте `miniapp/` (или весь сервис) на **HTTPS**-хост
2. Чат-боты → ⋮ → Настройки → URL мини-приложения = `https://ваш-домен/`
3. В `.env` укажите тот же `MINIAPP_URL` — в меню бота появится кнопка «Открыть Наш Дом»
4. Диплинк: `https://max.ru/<botName>?startapp` (payload → `initDataUnsafe.start_param`)

> Для MAX нужны `https` и домен `platform-api2.max.ru` с сертификатами Минцифры (уже в `certs/`).

## Проверка без MAX

Откройте `http://127.0.0.1:3080/` в браузере — вход по телефону (демо `+7 900 123-45-67` / `1234`).
