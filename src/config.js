import 'dotenv/config';

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Отсутствует обязательная переменная окружения: ${name}`);
  }
  return value;
}

export const config = {
  botToken: required('BOT_TOKEN'),
  consentUrl: process.env.CONSENT_URL || 'https://example.com/consent.pdf',
  adminUserIds: (process.env.ADMIN_USER_IDS || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)
    .map(Number),
  mysql: {
    host: process.env.MYSQL_HOST || '127.0.0.1',
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER || 'nash_dom',
    password: process.env.MYSQL_PASSWORD || 'nash_dom',
    database: process.env.MYSQL_DATABASE || 'nash_dom',
  },
};
