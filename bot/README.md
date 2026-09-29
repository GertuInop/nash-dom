# Наш дом — чат-бот для жителей и УК в мессенджере MAX

## Назначение

Чат-бот **«Наш дом»** связывает жителей многоквартирных домов и управляющие компании: заявки, аварии, статусы, рассылки, справочная информация.

## Основной пользовательский сценарий

1. Пользователь запускает бота (`/start` или кнопка Start).
2. Видит приветствие и подтверждает согласие на обработку ПДн.
3. Выбирает роль: **житель** или **управляющая компания**.
4. Житель указывает адрес проживания → открывается главное меню.
5. УК указывает название и контакты → заявка уходит администратору на одобрение.
6. Администратор одобряет/отклоняет заявки на роль УК.

## Состав и архитектура

| Компонент | Описание |
|-----------|----------|
| `bot.js` | Точка входа: бот + HTTP API |
| `api.js` | Только HTTP API (без MAX), та же MySQL |
| `src/bot.js` | Обработчики MAX Bot API |
| `src/api/server.js` | REST API для веб-клиента |
| `src/web-db.js` | Веб-схема и запросы (дома, чаты, темы) |
| `src/handlers.js` | Онбординг, меню, админ-решения |
| `src/db.js` | Работа с MySQL |
| `src/keyboards.js` | Inline-клавиатуры |
| `mysql/init.sql` | Схема БД |
| `certs/` | Сертификаты Минцифры для TLS к MAX API |
| `caddy/Caddyfile` | Reverse proxy + автоматический HTTPS |
| `docs/` | OpenAPI и DATA-API для контейнера |
| `../client/` | React мини-приложение |

Мини-приложение — React в `../client`. Данные в общей MySQL `nash_dom`. Вход из MAX — Bridge `initData` и `POST /server/auth/max`.

Публичные пути (Caddy):

| Путь | Назначение |
|------|------------|
| `/` | фронт (мини-приложение) |
| `/server/*` | REST API для фронта |
| `/bot` | webhook MAX |

Роли: `resident`, `uk`, `admin`.

Стек: **Node.js**, **MySQL 8**, **Express**, **Caddy**, **Docker Compose**, `@maxhub/max-bot-api`, React (Vite).

> MAX API (`platform-api2.max.ru`) — сертификаты Минцифры в `certs/`.

## Быстрый запуск (одна команда)

```bash
docker compose up --build -d
```

Перед запуском скопируйте корневой `../.env.example` в `../.env` и укажите `BOT_TOKEN`, `ADMIN_USER_IDS`, а для продакшена — `DOMAIN`, `ACME_EMAIL`, `MINIAPP_URL`. Файл `bot/.env` не используйте.

## HTTPS через Caddy

Caddy слушает **80/443** и разводит пути: `/` → `web`, `/server` и `/bot` → `bot`.

1. В `.env`:
   - `DOMAIN=ваш-домен.ru`
   - `ACME_EMAIL=you@mail.ru`
   - `MINIAPP_URL=https://ваш-домен.ru/`
   - `WEBHOOK_SECRET=...` (рекомендуется на проде)
2. DNS A/AAAA → IP сервера, порты **80/443**.
3. `docker compose up --build -d`
4. В кабинете MAX: URL мини-приложения = `MINIAPP_URL` (`https://ваш-домен.ru/`).

На публичном `DOMAIN` бот сам включает **webhook** (`POST /bot`). Локально (`localhost`) — long polling.

## Переменные окружения и порты

| Переменная | Описание | По умолчанию |
|------------|----------|--------------|
| `BOT_TOKEN` | Токен бота MAX | — |
| `ADMIN_USER_IDS` | ID админов MAX через запятую | пусто |
| `CONSENT_URL` | Ссылка на PDF согласия | `https://example.com/consent.pdf` |
| `MYSQL_HOST` | Хост MySQL | `127.0.0.1` / в Docker: `mysql` |
| `MYSQL_PORT` | Порт MySQL | `3306` |
| `MYSQL_USER` | Пользователь БД | `nash_dom` |
| `MYSQL_PASSWORD` | Пароль БД | `nash_dom` |
| `MYSQL_DATABASE` | Имя БД | `nash_dom` |
| `MYSQL_ROOT_PASSWORD` | Root-пароль MySQL (Docker) | `rootpass` |
| `API_PORT` | Порт HTTP внутри Docker-сети | `3080` |
| `DOMAIN` | Домен для Caddy / Let's Encrypt / webhook | `localhost` |
| `ACME_EMAIL` | Email для Let's Encrypt | `admin@example.com` |
| `MINIAPP_URL` | HTTPS URL мини-приложения (кнопка `openApp`) | `https://$DOMAIN/` |
| `BOT_MODE` | `auto` / `webhook` / `polling` | `auto` |
| `WEBHOOK_SECRET` | Секрет заголовка `X-Max-Bot-Api-Secret` | пусто |

Порты:
- **80 / 443** — Caddy
- **3306** — MySQL
- **3080** — прямой доступ к bot (опционально)

## Зависимости и интеграции

- `@maxhub/max-bot-api` — API мессенджера MAX
- `mysql2` — драйвер MySQL
- `express` / `cors` — HTTP API для веб-клиента
- `dotenv` — переменные окружения
- Внешний сервис: **MAX Bot Platform** (нужен валидный `BOT_TOKEN`)

Версии зафиксированы в `package-lock.json`.

## Данные и тестовые данные

Схема создаётся автоматически из `mysql/init.sql` при первом старте контейнера MySQL.

Тестовый сценарий без seed-данных:
1. Укажите свой MAX `user_id` в `ADMIN_USER_IDS`.
2. Запустите бота вторым аккаунтом как житель.
3. Третьим (или тем же не-админ) аккаунтом подайте заявку на роль УК.
4. Из админ-аккаунта откройте «Заявки на роль УК» и одобрите.

Локальный запуск без Docker (нужен свой MySQL):

```bash
cp ../.env.example ../.env
# правьте только ../.env
docker compose -f ../compose.yaml up --build -d
# заполните BOT_TOKEN, ADMIN_USER_IDS, параметры MySQL
npm ci
# примените mysql/init.sql к своей БД
npm run start
```

## Проверка

Ожидаемое поведение:
1. `/start` → приветствие + кнопки согласия.
2. «Согласен» → выбор роли.
3. Роль «Житель» → запрос адреса → главное меню (авария, заявки, УК, настройки…).
4. Роль «УК» → название → контакты → статус «ожидание одобрения».
5. Админ видит заявки и может одобрить/отклонить; УК получает уведомление.

Разделы заявок, статусов и рассылок работают в боте и в веб-кабинете (общая БД).

Подробный чеклист сдачи, OpenAPI и DATA-API — в корневом [README.md](../README.md).

## Ограничения

- Без валидного `BOT_TOKEN` и доступа к `platform-api2.max.ru` бот в MAX не работает; HTTP API и веб-клиент доступны локально.
- `CONSENT_URL` по умолчанию — заглушка.
- На `localhost` — long polling; на публичном `DOMAIN` — webhook `POST /bot`.
- Контейнеризация не заменяет рабочую версию бота/мини-приложения в MAX.
- Без сертификатов Минцифры (`certs/`) TLS к MAX API падает с `UNABLE_TO_GET_ISSUER_CERT_LOCALLY`.

## Остановка и перезапуск

```bash
docker compose stop
docker compose start
# или полный перезапуск
docker compose down
docker compose up --build -d
```

Удаление данных MySQL:

```bash
docker compose down -v
```
