# Дом под рукой

Чат-бот и мини-приложение для мессенджера **MAX**: связь жителей МКД и управляющих компаний (заявки, статусы, чаты дома, объявления по этажам, парковка).

---

## Соответствие требованиям сдачи (слайды)

| Требование | Где в репозитории |
|------------|-------------------|
| Назначение решения | раздел [Назначение](#назначение) |
| Основной пользовательский сценарий | [Сценарий](#основной-пользовательский-сценарий) |
| Состав и архитектура | [Архитектура](#состав-и-архитектура) + карта каталогов |
| Запуск одной командой (Docker) | [Запуск](#запуск-одной-командой-docker) |
| Переменные окружения | [`.env.example`](.env.example) + таблица ниже |
| Используемые порты | [Порты](#порты) |
| Зависимости + lock-файлы | `bot/package-lock.json`, `client/package-lock.json` |
| Внешние сервисы | [Интеграции](#внешние-сервисы-и-интеграции) |
| Работа с данными | [Данные](#данные-и-тестовые-данные) |
| Тестовые данные | [`test-data.json`](test-data.json), [`testdata/`](testdata/) |
| Пошаговая проверка | [Проверка](#пошаговая-проверка) |
| Ожидаемое поведение | [Ожидаемое поведение](#ожидаемое-поведение) |
| Известные ограничения | [Ограничения](#известные-ограничения) |
| Остановка / перезапуск | [Остановка](#остановка-и-перезапуск) |
| `Dockerfile` / `compose.yaml` / `.dockerignore` / `.env.example` | корень + `bot/` + `client/` |
| OpenAPI 3.0 | [`openapi.yaml`](openapi.yaml), `GET /server/openapi.yaml` |
| DATA-API | [`DATA-API.yaml`](DATA-API.yaml), `GET /server/DATA-API.yaml` |
| Собственный API (HTTPS) | `https://<DOMAIN>/server` |

**Слайд 1 PDF (для проверки):** ссылка на бота/мини-приложение в MAX, URL Git + commit, адрес API, тестовые логины из `test-data.json`, переменные из `.env` (без публикации секретов в публичный README — только в закрытый слайд/кабинет).

---

## Работающее решение в MAX

После деплоя укажите проверяющим:

| Что | Куда |
|-----|------|
| Бот в MAX | ссылка / `@username` бота |
| Мини-приложение | `https://<ДОМЕН>/` (`MINIAPP_URL`) |
| API (HTTPS) | `https://<ДОМЕН>/server` |
| Webhook MAX | `https://<ДОМЕН>/bot` |
| OpenAPI | `https://<ДОМЕН>/server/openapi.yaml` |
| DATA-API | `https://<ДОМЕН>/server/DATA-API.yaml` |
| Статус | `GET https://<ДОМЕН>/server/status` |

Локально без домена: API `http://127.0.0.1:3080/server`, сайт через Caddy `http://127.0.0.1/`.

---

## Назначение

«Дом под рукой» решает задачу коммуникации житель ↔ УК в одном контуре MAX:

- житель подаёт обращения (квартира / подъезд / этаж / дом), смотрит статусы, чаты, парковку, объявления УК;
- руководитель УК регистрирует компанию и дом, обрабатывает заявки, публикует объявления по этажам (с уведомлениями в MAX);
- бот — онбординг, меню и push; мини-приложение — полный кабинет.

---

## Основной пользовательский сценарий

1. Пользователь открывает бота в MAX → `/start` → согласие → выбор роли.
2. **Житель:** телефон → город → адрес → подъезд → квартира → выбор УК → доступ к платформе.
3. **Руководитель УК:** название УК → телефон → город → адрес → подъезды / этажи / парковка → кабинет УК.
4. Кнопка «Открыть Дом под рукой» (или меню мини-приложений) → Bridge `initData` → `POST /server/auth/max`.
5. В мини-приложении: лента, заявки, план дома, парковка, профиль (редактирование своих данных).
6. УК публикует объявление на этаж → жители получают уведомление в MAX + live-обновление по WebSocket.

**Демо API без MAX (веб-логин):**

| Роль | Телефон | Пароль |
|------|---------|--------|
| Житель | `+79001234567` | `1234` |
| УК | `+79001234561` | `1234` |

Источник: [`test-data.json`](test-data.json).

---

## Состав и архитектура

```
                         HTTPS :443 / HTTP :80
                      ┌──────── Caddy ────────┐
                      │                       │
                 /    │                  /server  /bot  /server/ws
                      ▼                       ▼
               web (React SPA)          bot (Node.js)
               client/                     │
                                      Express API
                                      MAX long-poll / webhook
                                      WebSocket /server/ws
                                           │
                                        MySQL 8.4
```

| URL-путь | Компонент | Код |
|----------|-----------|-----|
| `/` | Мини-приложение | `client/` |
| `/server/*` | REST API | `bot/src/api/server.js` |
| `/server/ws` | Realtime | `bot/src/realtime.js` |
| `/bot` | Webhook MAX | `bot/src/bot.js` |

### Карта каталогов

| Путь | Назначение |
|------|------------|
| `bot/` | Бот MAX + Express API + MySQL-схема + Caddyfile + certs |
| `bot/src/handlers.js` | Сценарии бота (согласие, роли, меню) |
| `bot/src/web-db.js` | Веб-схема, дома, заявки, объявления, парковка |
| `bot/src/db.js` | Пользователи, УК, города |
| `bot/scripts/reset-and-seed.js` | Очистка БД + загрузка тестовых данных |
| `client/` | React (Vite) мини-приложение |
| `client/src/screens/` | Экраны: Onboarding, Building, Feed, UkPanel, Profile… |
| `compose.yaml` | MySQL + bot + web + Caddy |
| `test-data.json` | **Тестовые данные (корень)** |
| `testdata/` | Краткая выжимка аккаунтов для проверки |
| `openapi.yaml` | OpenAPI 3.0 |
| `DATA-API.yaml` | Обязательные проверки API |
| `scripts/docker-up.sh` / `.ps1` | Безопасный подъём на слабом VPS |
| `scripts/reset-db.sh` / `.ps1` | Wipe + seed |
| `.env.example` | Шаблон переменных **без секретов** |

---

## Запуск одной командой (Docker)

```bash
cp .env.example .env
# заполните BOT_TOKEN, ADMIN_USER_IDS; на VPS — DOMAIN, MINIAPP_URL, SITE_ADDRESS

# Linux / сервер (рекомендуется на 1–2 GB RAM):
bash scripts/docker-up.sh

# Windows:
powershell -File scripts/docker-up.ps1

# либо на мощной машине:
docker compose up --build -d
```

**Важно:** один файл окружения — **корневой** `.env`. Не используйте `bot/.env`.

После первого старта загрузите тестовые данные:

```bash
bash scripts/reset-db.sh
# или: docker compose exec bot node scripts/reset-and-seed.js
```

---

## Переменные окружения

Шаблон: [`.env.example`](.env.example).

| Переменная | Описание | Пример |
|------------|----------|--------|
| `BOT_TOKEN` | Токен бота MAX | *(обязательно)* |
| `ADMIN_USER_IDS` | max_user_id админов через запятую | `267828110` |
| `CONSENT_URL` | PDF согласия (пусто → `/server/consent.pdf`) | |
| `MYSQL_*` | Доступ к БД | см. `.env.example` |
| `API_PORT` / `API_PUBLISH_PORT` | Порт API | `3080` |
| `DOMAIN` | Домен без схемы | `hackatonmax342.ru` |
| `SITE_ADDRESS` | Адреса Caddy | домен или `http://127.0.0.1` |
| `ACME_EMAIL` | Let's Encrypt | |
| `MINIAPP_URL` | URL мини-приложения | `https://hackatonmax342.ru/` |
| `BOT_MODE` | `auto` / `webhook` / `polling` | `auto` |
| `WEBHOOK_SECRET` | Секрет webhook | |
| `MAX_INITDATA_RELAXED` | Ослабить проверку hash Bridge | `1` |
| `MINIAPP_OPENAPP` | Кнопка openApp (`1` после регистрации URL в MAX) | |
| `MAX_LINK_BUTTONS` | Кнопки link на PDF (`1` после регистрации) | |

---

## Порты

| Порт | Сервис |
|------|--------|
| `80` / `443` | Caddy (сайт + прокси `/server`, `/bot`) |
| `3080` | Bot API напрямую (отладка) |
| `3306` | MySQL |

---

## Зависимости

- `bot/package-lock.json` — `@maxhub/max-bot-api`, `express`, `mysql2`, `cors`, `dotenv`, `undici`, `ws`
- `client/package-lock.json` — `react`, `vite`, `react-router-dom`, `zustand`, `lucide-react`
- Образы: `node:20-alpine`, `mysql:8.4`, `caddy:2.8-alpine`, `nginx` (сборка web)

Сборка Docker рассчитана на **≤ 5 минут** при кэше базовых образов; на слабом VPS — `scripts/docker-up.sh` (последовательный build).

---

## Внешние сервисы и интеграции

| Сервис | Зачем | Как проверить |
|--------|-------|---------------|
| **MAX Bot Platform** (`platform-api2.max.ru`) | События бота, сообщения, openApp | Валидный `BOT_TOKEN`; CA Минцифры в `bot/certs/` |
| **MAX Bridge** (`max-web-app.js`) | `initData` в мини-приложении | Открыть URL из MAX |
| **Let's Encrypt** (Caddy) | HTTPS | DNS → сервер, порты 80/443 |

Без MAX доступны API и веб-логин по телефону. Полный сценарий бота требует токен MAX.

---

## Данные и тестовые данные

### Как устроены данные

- Схема создаётся при старте бота: `ensureSchema` (`bot/src/db.js`) + `ensureWebSchema` / tickets.
- Init SQL: `bot/mysql/init.sql` (первый запуск тома MySQL).
- Бизнес-данные: пользователи, УК, дома, заявки (`requests`), объявления этажей (`entrance_works`), парковка, чаты, сессии.

### Файл тестовых данных

**[`test-data.json`](test-data.json)** (корень) содержит:

- аккаунты жителя и УК (телефон/пароль);
- УК «ДомСервис», дом на Баумана, парковку, объявления по этажам, тестовую заявку.

Краткая копия аккаунтов: [`testdata/accounts.json`](testdata/accounts.json).

### Очистка БД и загрузка теста

Скрипт **полностью очищает** таблицы приложения и заливает JSON заново:

```bash
# на сервере / с Docker
bash scripts/reset-db.sh

# вручную
docker compose exec bot node scripts/reset-and-seed.js

# локально без Docker (MYSQL_HOST=127.0.0.1)
cd bot && npm run seed
```

Код: [`bot/scripts/reset-and-seed.js`](bot/scripts/reset-and-seed.js). Файл монтируется в контейнер: `./test-data.json` → `/app/test-data.json`.

---

## Собственный API

- Базовый адрес: `https://<DOMAIN>/server` (в [`DATA-API.yaml`](DATA-API.yaml) поле `базовый_адрес_api`).
- OpenAPI: [`openapi.yaml`](openapi.yaml).
- Обязательные проверки: health/status, login жителя/УК, список домов/заявок — см. `DATA-API.yaml`.

Пример:

```bash
curl -s https://<DOMAIN>/server/status
curl -s -X POST https://<DOMAIN>/server/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"phone":"+79001234567","password":"1234"}'
```

---

## Пошаговая проверка

### Локально / Docker

1. `cp .env.example .env` → заполнить `BOT_TOKEN` (для API без бота можно временный, для MAX — настоящий).
2. `bash scripts/docker-up.sh` (или `docker compose up --build -d`).
3. `bash scripts/reset-db.sh`.
4. `curl http://127.0.0.1:3080/server/status` → `{ "ok": true, ... }`.
5. Логин жителя → `token`, дома, заявки.
6. Логин УК → панель заявок, смена статуса.
7. Открыть `http://127.0.0.1/` → при наличии Bridge — сценарий MAX; иначе веб-логин (если включён в клиенте) / проверка API.

### В MAX (прод)

1. В `.env`: `DOMAIN`, `MINIAPP_URL=https://<DOMAIN>/`, `BOT_TOKEN`, `ADMIN_USER_IDS`, `BOT_MODE=auto`.
2. `bash scripts/docker-up.sh` → `bash scripts/reset-db.sh`.
3. В кабинете MAX: URL мини-приложения = `MINIAPP_URL` (для кнопки openApp — зарегистрировать домен, затем `MINIAPP_OPENAPP=1`).
4. `/start` в боте → онбординг → мини-приложение.
5. Авторизация мини-приложения: только Bridge → `POST /server/auth/max`.

---

## Ожидаемое поведение

- `GET /server/status` и `/server/health` → `200`, сервис жив.
- `POST /server/auth/login` с тестовыми телефонами → `token` + bootstrap (user, houses, tickets, works…).
- Житель видит дом, объявления, может создать заявку с областью (квартира/подъезд/этаж/дом).
- УК видит заявки, меняет статусы; на плане дома публикует объявления по этажам — жителям уходит сообщение в MAX.
- WebSocket `/server/ws` обновляет заявки / парковку / объявления без перезагрузки.
- Бот: согласие → роль → меню; на публичном домене события на `POST /bot`.

---

## Известные ограничения

- Без валидного `BOT_TOKEN` и доступа к MAX бот в мессенджере не работает (HTTP API — да).
- Кнопки `openApp` / `link` падают с `Link not found`, пока URL не зарегистрирован в кабинете MAX — по умолчанию выключены (`MINIAPP_OPENAPP` / `MAX_LINK_BUTTONS`).
- На `DOMAIN=localhost` — long polling; webhook — на публичном домене.
- Сетка этажей для публикации объявлений — только у роли УК; жители видят список объявлений.
- Сборка на VPS 1–2 GB: только `scripts/docker-up.sh`, иначе OOM при параллельном `npm ci`.

---

## Остановка и перезапуск

```bash
docker compose stop
docker compose start

# пересборка
docker compose down
docker compose up --build -d

# полный сброс тома MySQL (потом снова seed)
docker compose down -v
docker compose up --build -d
bash scripts/reset-db.sh
```

---

## Docker-артефакты

| Файл | Назначение |
|------|------------|
| `compose.yaml` | mysql + bot + web + caddy |
| `bot/Dockerfile` | образ бота/API |
| `client/Dockerfile` | статика фронта |
| `.dockerignore`, `bot/.dockerignore`, `client/.dockerignore` | контекст сборки |
| `.env.example` | переменные без секретов |

---

## Как всё связано (кратко)

1. **MAX** шлёт события боту (`polling`/`webhook`) → `bot/src/handlers.js` пишет в MySQL.
2. **Мини-приложение** (`client`) ходит в `/server` с Bearer-токеном сессии; realtime — `/server/ws`.
3. **Одна БД MySQL** — и бот, и веб: заявки, УК, дом, объявления, парковка.
4. **Caddy** отдаёт SPA и проксирует API/webhook на одном HTTPS-домене.
5. **test-data.json** + `reset-and-seed.js` дают проверяющим воспроизводимый стенд после очистки БД.

---

## Фиксация версии

Сдавайте конкретный **commit Git** (хэш) или архив с контрольной суммой. После дедлайна версию для онлайн-этапа не менять.
