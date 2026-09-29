import './load-env.js';

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

/** openApp / link в MAX работают только если URL привязан к боту в кабинете платформы.
 *  По умолчанию выключены (иначе sendMessage падает с Link not found).
 *  После регистрации https://ДОМЕН в кабинете MAX: MINIAPP_OPENAPP=1 и при необходимости MAX_LINK_BUTTONS=1 */
const enableOpenApp = process.env.MINIAPP_OPENAPP === '1';
const enableLinkButtons = process.env.MAX_LINK_BUTTONS === '1';

function cleanToken(value) {
  return String(value || '')
    .trim()
    .replace(/^['"]|['"]$/g, '')
    .replace(/\r/g, '');
}

function defaultConsentUrl() {
  const raw = (process.env.CONSENT_URL || '').trim();
  if (raw && !/example\.com/i.test(raw)) {
    return raw;
  }
  // По умолчанию PDF с нашего API
  if (domain && domain !== 'localhost' && !domain.startsWith('127.')) {
    return `https://${domain}/server/consent.pdf`;
  }
  return 'http://127.0.0.1:3080/server/consent.pdf';
}

export const config = {
  botToken: apiOnly ? cleanToken(process.env.BOT_TOKEN || '') : cleanToken(required('BOT_TOKEN')),
  consentUrl: defaultConsentUrl(),
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
  enableOpenApp,
  enableLinkButtons,
  mysql: {
    host: process.env.MYSQL_HOST || '127.0.0.1',
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER || 'nash_dom',
    password: process.env.MYSQL_PASSWORD || 'nash_dom',
    database: process.env.MYSQL_DATABASE || 'nash_dom',
  },
};
