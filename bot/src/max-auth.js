import crypto from 'node:crypto';
import { pool, findUserByMaxId, createUser, updateUser } from './db.js';
import { createSession, bootstrapForUser, findUserById, serializeUserFixed } from './web-db.js';
import { config } from './config.js';

/**
 * Валидация WebAppData / initData по документации MAX:
 * https://dev.max.ru/docs/webapps/validation
 */
export function validateInitData(initData, botToken = config.botToken) {
  if (!initData || !botToken) return null;

  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return null;

  const entries = [];
  for (const [key, value] of params.entries()) {
    if (key === 'hash') continue;
    entries.push([key, value]);
  }
  entries.sort((a, b) => a[0].localeCompare(b[0]));
  const launchParams = entries.map(([k, v]) => `${k}=${v}`).join('\n');

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const calculated = crypto.createHmac('sha256', secretKey).update(launchParams).digest('hex');

  const a = Buffer.from(calculated, 'utf8');
  const b = Buffer.from(hash, 'utf8');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return null;
  }

  const authDate = Number(params.get('auth_date') || 0);
  if (!authDate) return null;
  // Рекомендуемый интервал ~1ч (docs/webapps/validation); запас 2ч
  if (Math.abs(Date.now() / 1000 - authDate) > 7200) {
    return null;
  }

  let user = null;
  try {
    user = JSON.parse(params.get('user') || 'null');
  } catch {
    user = null;
  }
  if (!user?.id) return null;

  let chat = null;
  try {
    chat = JSON.parse(params.get('chat') || 'null');
  } catch {
    chat = null;
  }

  return {
    user,
    chat,
    authDate,
    queryId: params.get('query_id') || null,
    startParam: params.get('start_param') || null,
  };
}

/** Проверка hash от requestContact */
export function validateContactHash({ phone, authDate, userId, hash }, botToken = config.botToken) {
  if (!phone || !authDate || !userId || !hash || !botToken) return false;
  const normalized = String(phone).replace(/\D/g, '');
  // пары key=value в алфавитном порядке
  const payload = [
    `authDate=${authDate}`,
    `phone=${normalized}`,
    `userId=${userId}`,
  ].join('\n');
  const calculated = crypto.createHmac('sha256', botToken).update(payload).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(calculated), Buffer.from(String(hash)));
  } catch {
    return false;
  }
}

export async function loginWithMaxUser(maxUser) {
  let user = await findUserByMaxId(maxUser.id);
  if (!user) {
    user = await createUser({
      maxUserId: maxUser.id,
      username: maxUser.username || null,
      firstName: maxUser.first_name || null,
      lastName: maxUser.last_name || null,
      isAdmin: config.adminUserIds.includes(Number(maxUser.id)),
    });
  } else {
    await updateUser(user.id, {
      username: maxUser.username || user.username,
      first_name: maxUser.first_name || user.first_name,
      last_name: maxUser.last_name || user.last_name,
    });
    user = await findUserById(user.id);
  }

  // Веб-доступ: согласие уже дано в MAX-клиенте при открытии мини-приложения
  if (!user.consent_accepted || !user.role) {
    await updateUser(user.id, {
      consent_accepted: 1,
      consent_accepted_at: new Date(),
      role: user.role || 'resident',
      onboarding_step: user.onboarding_step === 'welcome' || !user.onboarding_step ? 'done' : user.onboarding_step,
      uk_status: user.role === 'uk' ? user.uk_status : 'none',
    });
    user = await findUserById(user.id);
  }

  const token = await createSession(user.id);
  const data = await bootstrapForUser(user);
  return { token, ...data, maxUser: serializeMaxUser(maxUser) };
}

function serializeMaxUser(u) {
  return {
    id: u.id,
    firstName: u.first_name,
    lastName: u.last_name,
    username: u.username,
    photoUrl: u.photo_url,
    languageCode: u.language_code,
  };
}

export async function attachPhoneFromMax(userId, phone) {
  await updateUser(userId, { phone: String(phone).trim() });
  return findUserById(userId);
}
