# Дом под рукой — клиент

React мини-приложение. API: `/server` (через корневой Caddy в общем стеке).

## Локально без Docker

```bash
npm install
npm run dev
```

Прокси Vite: `/server` → `http://127.0.0.1:3080`.

## Docker

Полный стек — из корня репозитория (`scripts/docker-up.sh` / `docker-up.ps1`).

Только статика:

```bash
docker compose up --build -d
```

Клиент: http://localhost:5173 (без прокси API — для прода используйте корневой compose).
