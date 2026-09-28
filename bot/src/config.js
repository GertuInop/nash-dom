import 'dotenv/config';

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Отсутствует обязательная переменная окружения: ${name}`);
  }
  return value;
}

const apiOnly = process.env.API_ONLY === '1' || process.argv.some((a) => String(a).endsWith('api.js'));

const domain = (process.env.DOMAIN || 'localhost').trim();
const botModeEnv = (process.env.BOT_MODE || 'auto').trim().toLowerCase();

/** webhook на публичном домене; polling локально / если явно указано */
function resolveBotMode() {
  if (botModeEnv === 'webhook' || botModeEnv === 'polling') return botModeEnv;
  if (domain && domain !== 'localhost' && !domain.startsWith('127.')) return 'webhook';
  return 'polling';
}

const botMode = resolveBotMode();
const miniappUrl =
  process.env.MINIAPP_URL ||
  (domain && domain !== 'localhost' ? `https://${domain}/` : '');

export const config = {
  botToken: apiOnly ? (process.env.BOT_TOKEN || '') : required('BOT_TOKEN'),
  consentUrl: process.env.CONSENT_URL || 'https://example.com/consent.pdf',
  adminUserIds: (process.env.ADMIN_USER_IDS || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)
    .map(Number),
  apiPort: Number(process.env.API_PORT || 3080),
  domain,
  botMode,
  /** Секрет для заголовка X-Max-Bot-Api-Secret (A-Z a-z 0-9 -) */
  webhookSecret: process.env.WEBHOOK_SECRET || '',
  webhookPath: '/bot',
  miniappUrl,
  mysql: {
    host: process.env.MYSQL_HOST || '127.0.0.1',
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER || 'nash_dom',
    password: process.env.MYSQL_PASSWORD || 'nash_dom',
    database: process.env.MYSQL_DATABASE || 'nash_dom',
  },
};
