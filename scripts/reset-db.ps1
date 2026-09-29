# Очистка БД и загрузка test-data.json
# Из корня: powershell -File scripts/reset-db.ps1
$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)

$running = docker compose ps --status running 2>$null | Select-String "nash-dom-bot"
if ($running) {
  Write-Host "[reset-db] через docker compose exec bot…"
  docker compose exec -T bot node scripts/reset-and-seed.js
} else {
  Write-Host "[reset-db] контейнер bot не запущен — локальный node…"
  Push-Location bot
  node scripts/reset-and-seed.js
  Pop-Location
}
