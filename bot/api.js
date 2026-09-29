import './src/load-env.js';
import { ensureSchema, pingDb } from './src/db.js';
import { startApiServer } from './src/api/server.js';

/** Запуск только HTTP API (без MAX-бота) — общая MySQL с ботом */
async function main() {
  await pingDb();
  console.log('✅ MySQL подключен');
  await ensureSchema();
  console.log('✅ Схема БД проверена');
  await startApiServer();
  console.log('API-only режим: бот не запущен');
}

main().catch((error) => {
  console.error('Не удалось запустить API:', error);
  process.exit(1);
});
