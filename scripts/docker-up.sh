#!/usr/bin/env bash
# Безопасный запуск на слабом VPS: образы по одному, без параллельного npm ci
set -euo pipefail
cd "$(dirname "$0")/.."

export COMPOSE_PARALLEL_LIMIT=1
export DOCKER_BUILDKIT=1

echo "==> Тянем базовые образы по одному..."
docker pull node:20-alpine
docker pull caddy:2.8-alpine
docker pull mysql:8.4

echo "==> Собираем bot..."
docker compose build bot

echo "==> Собираем web..."
docker compose build web

echo "==> Поднимаем стек..."
docker compose up -d

echo "==> Готово. Статус:"
docker compose ps
