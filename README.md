# Наш дом

Чат-бот и мини-приложение для мессенджера **MAX**: связь жителей МКД и управляющих компаний (заявки, статусы, чаты, темы, рассылки).

## Работающее решение в MAX

После деплоя укажите проверяющим:

| Что | Куда |
|-----|------|
| Бот в MAX | ссылка на бота / `@username` бота |
| Мини-приложение | `https://<ДОМЕН>/` (URL в настройках бота) |
| API (HTTPS) | `https://<ДОМЕН>/server` |
| Webhook MAX | `https://<ДОМЕН>/bot` |
| OpenAPI | `https://<ДОМЕН>/server/openapi.yaml` |
| DATA-API | `https://<ДОМЕН>/server/DATA-API.yaml` |

Локально без домена API доступен на `http://127.0.0.1:3080/server`.

## Назначение

Сервис «Наш дом» помогает жителям подавать заявки в УК, отслеживать статусы, общаться в чатах дома и читать темы; УК — обрабатывать обращения и публиковать работы по подъездам. В MAX — онбординг и уведомления; веб — кабинет жителя/УК.

## Основной пользовательский сценарий

1. Пользователь открывает бота в MAX → согласие на ПДн → роль (житель / УК).
2. Житель указывает город и адрес, при необходимости подаёт заявку на привязку к УК.
3. По кнопке «Открыть Наш Дом» открывается мини-приложение (`https://<ДОМЕН>/`).
4. В мини-приложении житель видит ленту/темы/чаты/заявки; УК — панель заявок и статусы.
5. Заявки из бота и из веб-клиента пишутся в одну MySQL.

Демо без MAX (веб):

1. Открыть `http://127.0.0.1/` (через Caddy) или фронт на `:5173` при отдельном запуске.
2. Войти: житель `+79001234567` / `1234` или УК `+79001234561` / `1234`.

## Состав и архитектура

```
                    HTTPS :443
                 ┌──── Caddy ────┐
                 │               │
            /    │          /server /bot
                 ▼               ▼
              web (React)     bot (Node)
                                 │
                              mysql
```

| Путь | Компонент |
|------|-----------|
| `/` | React мини-приложение (`client/`) |
| `/server/*` | REST API (`bot/src/api`) |
| `/bot` | Webhook MAX (`@maxhub/max-bot-api`) |

| Каталог | Назначение |
|---------|------------|
| `bot/` | Бот MAX, Express API, Caddyfile, MySQL init, сертификаты Минцифры |
| `client/` | Frontend (Vite + React) |
| `testdata/` | Тестовые аккаунты и примеры данных |
| `openapi.yaml` | Спецификация OpenAPI 3.0 |
| `DATA-API.yaml` | Конфиг обязательных проверок API |

## Запуск одной командой (Docker)

На **слабом VPS** (1–2 GB RAM) не запускайте `docker compose up --build` —
два параллельных `npm ci` часто роняют сервер. Используйте безопасный скрипт:

```bash
cp .env.example .env
cp .env.example bot/.env
# заполните BOT_TOKEN и ADMIN_USER_IDS в bot/.env

# Linux / сервер:
bash scripts/docker-up.sh

# Windows (PowerShell):
powershell -File scripts/docker-up.ps1
```

Либо вручную по шагам:

```bash
docker pull node:20-alpine
docker pull caddy:2.8-alpine
docker pull mysql:8.4
docker compose build bot
docker compose build web
docker compose up -d
```

На мощной машине можно и так: `docker compose up --build -d`.

## Переменные окружения

Шаблон без секретов: [`.env.example`](.env.example) и [`bot/.env.example`](bot/.env.example).

| Переменная | Описание | По умолчанию |
|------------|----------|--------------|
| `BOT_TOKEN` | Токен бота MAX | — (обязательно) |
| `ADMIN_USER_IDS` | ID админов MAX через запятую | пусто |
| `CONSENT_URL` | Ссылка на PDF согласия | `https://example.com/consent.pdf` |
| `MYSQL_*` | Доступ к БД | см. `.env.example` |
| `API_PORT` | Порт API внутри сети | `3080` |
| `API_PUBLISH_PORT` | Проброс API на хост | `3080` |
| `DOMAIN` | Домен Caddy / webhook | `localhost` |
| `ACME_EMAIL` | Email Let's Encrypt | `admin@example.com` |
| `MINIAPP_URL` | URL мини-приложения в кнопке бота | `https://$DOMAIN/` |
| `BOT_MODE` | `auto` / `webhook` / `polling` | `auto` |
| `WEBHOOK_SECRET` | Секрет `X-Max-Bot-Api-Secret` | пусто |

## Порты

| Порт | Сервис |
|------|--------|
| `80` / `443` | Caddy (HTTP→HTTPS, мини-приложение и API) |
| `3080` | Прямой доступ к bot API (удобно для отладки) |
| `3306` | MySQL |

## Зависимости

Зафиксированы lock-файлами:

- `bot/package-lock.json` — Node (бот + API)
- `client/package-lock.json` — Node (frontend)

Основные пакеты бота: `@maxhub/max-bot-api`, `express`, `mysql2`, `cors`, `dotenv`, `undici`.  
Frontend: `react`, `vite`.  
Образы Docker: `node:20-alpine`, `nginx:1.27-alpine`, `mysql:8.4`, `caddy:2.8-alpine`.

## Внешние сервисы и интеграции

| Сервис | Зачем | Условие проверки |
|--------|-------|------------------|
| **MAX Bot Platform** (`platform-api2.max.ru`) | События бота, кнопки, openApp | Валидный `BOT_TOKEN`; сертификаты Минцифры в `bot/certs/` |
| **Let's Encrypt** (через Caddy) | HTTPS на публичном домене | DNS A/AAAA → сервер, порты 80/443 |

Контейнеризация **не заменяет** рабочую версию в MAX: бот/мини-приложение должны быть доступны проверяющим по ссылке.

Локально API и веб можно проверить **без MAX** (логин по телефону). Полный сценарий бота требует токен MAX.

## Данные и тестовые данные

- Схема БД: `bot/mysql/init.sql` (города, пользователи, заявки, чаты…).
- Дома и работы сидируются при старте API (`seedHousesAndWorks`).
- Тестовые аккаунты: [`testdata/accounts.json`](testdata/accounts.json).
- Примеры запросов/ответов: [`testdata/sample.json`](testdata/sample.json).

| Роль | Телефон | Пароль |
|------|---------|--------|
| Житель | `+79001234567` | `1234` |
| УК | `+79001234561` | `1234` |

Админ в боте MAX — ваш `max_user_id` в `ADMIN_USER_IDS` (веб-админ не обязателен для проверки API).

## Собственный API (требования проверки)

- **Адрес API:** `https://<ДОМЕН>/server` (должен быть доступен весь период проверки).
- **OpenAPI 3.0:** [`openapi.yaml`](openapi.yaml) и `GET /server/openapi.yaml`.
- **DATA-API:** [`DATA-API.yaml`](DATA-API.yaml) и `GET /server/DATA-API.yaml` — перед сдачей замените `базовый_адрес_api`.
- **Статус:** `GET /server/status` → `200` JSON `{ ok, service, status }`.

## Пошаговая проверка

### Локально (Docker)

1. `docker compose up --build -d`
2. `curl http://127.0.0.1:3080/server/status` → `ok: true`
3. `curl -X POST http://127.0.0.1:3080/server/auth/login -H "Content-Type: application/json" -d "{\"phone\":\"+79001234567\",\"password\":\"1234\"}"` → есть `token`
4. Открыть `http://127.0.0.1/` (Caddy) → вход теми же данными → кабинет жителя
5. Повторить логин с `+79001234561` → кабинет УК

### В MAX (прод)

1. В `.env`: `DOMAIN`, `MINIAPP_URL=https://<ДОМЕН>/`, `BOT_TOKEN`, `ADMIN_USER_IDS`
2. DNS и `docker compose up --build -d`
3. В кабинете MAX: URL мини-приложения = `MINIAPP_URL`
4. Написать боту `/start` → онбординг → кнопка «Открыть Наш Дом»
5. В мини-приложении авторизация через Bridge (`initData`) или демо-логин

## Ожидаемое поведение

- `GET /server/status` всегда `200`, если контейнер bot жив.
- Первый логин по телефону создаёт пользователя (житель / УК по последней цифре телефона).
- Житель видит дома, темы, чаты, заявки; УК — панель заявок и смену статусов.
- Бот в MAX: согласие → роль → меню; на публичном домене события приходят на `POST /bot`.

## Известные ограничения

- Без `BOT_TOKEN` и доступа к MAX бот в мессенджере не работает (API и веб — да).
- На `DOMAIN=localhost` используется long polling; webhook — на публичном домене.
- `CONSENT_URL` по умолчанию — заглушка.
- Сборка Docker рассчитана на ≤ 5 минут при уже скачанных базовых образах.
- На VPS с 1–2 GB RAM используйте `scripts/docker-up.sh` (последовательная сборка), иначе OOM при параллельном `npm ci`.

## Остановка и перезапуск

```bash
docker compose stop
docker compose start

# полный перезапуск с пересборкой
docker compose down
docker compose up --build -d

# с удалением данных MySQL
docker compose down -v
```

## Docker-конфигурация в репозитории

| Файл | Назначение |
|------|------------|
| `compose.yaml` | Запуск всех компонентов одной командой |
| `bot/Dockerfile` | Образ бота + API |
| `client/Dockerfile` | Образ фронта (статика через Caddy) |
| `bot/.dockerignore`, `client/.dockerignore`, `.dockerignore` | Исключения контекста сборки |
| `.env.example`, `bot/.env.example` | Шаблоны переменных без секретов |

## Фиксация версии кода

Сдавайте конкретный commit Git (хэш) или архив с контрольной суммой. После дедлайна версию кода для онлайн-этапа менять нельзя.
