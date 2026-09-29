import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

/**
 * Один .env на весь проект — в корне репозитория.
 * bot/.env больше не нужен (оставлен только как запасной путь).
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const candidates = [
  path.resolve(here, '../../.env'), // repo root (предпочтительно)
  path.resolve(process.cwd(), '.env'),
  path.resolve(here, '../.env'), // legacy: bot/.env
];

let loaded = null;
for (const file of candidates) {
  if (fs.existsSync(file)) {
    dotenv.config({ path: file, override: false });
    loaded = file;
    break;
  }
}

if (loaded) {
  console.log(`[env] loaded ${loaded}`);
}
// В Docker переменные приходят из compose — отсутствие файла .env внутри контейнера нормально.

export const loadedEnvPath = loaded;
