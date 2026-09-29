# Безопасный запуск на слабом ПК/VPS: без параллельной сборки
$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")

if (-not (Test-Path ".env")) {
  Write-Host "Нет корневого .env. Сделайте: copy .env.example .env"
  exit 1
}
if (Test-Path "bot\.env") {
  Write-Host "ВНИМАНИЕ: найден bot\.env — он больше не используется. Удалите: Remove-Item bot\.env"
}

$env:COMPOSE_PARALLEL_LIMIT = "1"
$env:DOCKER_BUILDKIT = "1"

Write-Host "==> Тянем базовые образы по одному..."
docker pull node:20-alpine
docker pull caddy:2.8-alpine
docker pull mysql:8.4

Write-Host "==> Собираем bot..."
docker compose build bot

Write-Host "==> Собираем web..."
docker compose build web

Write-Host "==> Поднимаем стек..."
docker compose up -d

Write-Host "==> Готово:"
docker compose ps
Write-Host "==> Логи бота:"
docker compose logs bot --tail 40
