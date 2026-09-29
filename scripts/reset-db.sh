#!/usr/bin/env bash
# Очистка БД и загрузка test-data.json на сервере / в Docker.
# Запуск из корня репозитория:
#   bash scripts/reset-db.sh
set -euo pipefail
cd "$(dirname "$0")/.."

if docker compose ps --status running 2>/dev/null | grep -q nash-dom-bot; then
  echo "[reset-db] через docker compose exec bot…"
  docker compose exec -T bot node scripts/reset-and-seed.js
else
  echo "[reset-db] контейнер bot не запущен — локальный node (MYSQL_HOST из .env)…"
  (cd bot && node scripts/reset-and-seed.js)
fi
