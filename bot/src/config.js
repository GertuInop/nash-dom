import 'dotenv/config';

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Отсутствует обязательная переменная окружения: ${name}`);
  }
  return value;
}

const apiOnly = process.env.API_ONLY === '1' || process.argv.some((a) => String(a).endsWith('api.js'));

export const config = {
  botToken: apiOnly ? (process.env.BOT_TOKEN || '') : required('BOT_TOKEN'),
  consentUrl: process.env.CONSENT_URL || 'https://example.com/consent.pdf',
  adminUserIds: (process.env.ADMIN_USER_IDS || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)
    .map(Number),
  apiPort: Number(process.env.API_PORT || 3080),
  miniappUrl: process.env.MINIAPP_URL || '',
  mysql: {
    host: process.env.MYSQL_HOST || '127.0.0.1',
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER || 'nash_dom',
    password: process.env.MYSQL_PASSWORD || 'nash_dom',
    database: process.env.MYSQL_DATABASE || 'nash_dom',
  },
};
