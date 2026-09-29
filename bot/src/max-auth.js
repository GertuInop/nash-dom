import crypto from 'node:crypto';
import { findUserByMaxId, createUser, updateUser } from './db.js';
import { createSession, bootstrapForUser, findUserById } from './web-db.js';
import { config } from './config.js';

function decodeValue(rawValue, mode) {
  if (mode === 'none') return rawValue;
  let value = rawValue;
  const times = mode === 'twice' ? 2 : 1;
  for (let i = 0; i < times; i += 1) {
    try {
      value = decodeURIComponent(String(value).replace(/\+/g, '%20'));
    } catch {
      break;
    }
  }
  return value;
}

function extractAppData(initData) {
  let appData = String(initData || '').trim();
  if (!appData) return '';

  if (appData.includes('WebAppData=')) {
    try {
      const fragment = appData.startsWith('#') ? appData.slice(1) : appData;
      const outer = new URLSearchParams(fragment);
      const nested = outer.get('WebAppData');
      if (nested) appData = nested;
    } catch {
      /* keep */
    }
  }
  return appData;
}

function parsePairs(appData) {
  return appData.split('&').filter(Boolean).map((pair) => {
    const eq = pair.indexOf('=');
    if (eq === -1) return [pair, ''];
    return [pair.slice(0, eq), pair.slice(eq + 1)];
  });
}

function buildParams(rawPairs, mode) {
  const params = [];
  for (const [key, rawValue] of rawPairs) {
    if (key === 'hash') continue;
    params.push([key, decodeValue(rawValue, mode)]);
  }
  params.sort((a, b) => a[0].localeCompare(b[0]));
  return params;
}

function parseUserChat(params) {
  let user = null;
  const userRaw = params.find(([k]) => k === 'user')?.[1];
  try {
    user = userRaw ? JSON.parse(userRaw) : null;
  } catch {
    user = null;
  }

  let chat = null;
  const chatRaw = params.find(([k]) => k === 'chat')?.[1];
  try {
    chat = chatRaw ? JSON.parse(chatRaw) : null;
  } catch {
    chat = null;
  }

  return {
    user,
    chat,
    authDate: Number(params.find(([k]) => k === 'auth_date')?.[1] || 0),
    queryId: params.find(([k]) => k === 'query_id')?.[1] || null,
    startParam: params.find(([k]) => k === 'start_param')?.[1] || null,
  };
}

function hashMatches(launchParams, originalHash, botToken) {
  const variants = [
    // Документация MAX: HMAC('WebAppData', BOT_TOKEN)
    crypto.createHmac('sha256', 'WebAppData').update(botToken).digest(),
    // На всякий случай обратный порядок ключа
    crypto.createHmac('sha256', botToken).update('WebAppData').digest(),
  ];

  for (const secretKey of variants) {
    const calculated = crypto.createHmac('sha256', secretKey).update(launchParams).digest('hex');
    try {
      const a = Buffer.from(calculated, 'utf8');
      const b = Buffer.from(String(originalHash), 'utf8');
      if (a.length === b.length && crypto.timingSafeEqual(a, b)) return true;
    } catch {
      /* next */
    }
  }
  return false;
}

/**
 * Достаём user из initData без проверки подписи (для демо / если hash не сходится).
 */
export function parseInitDataUnsafe(initData) {
  const appData = extractAppData(initData);
  if (!appData) return null;
  const rawPairs = parsePairs(appData);

  for (const mode of ['once', 'none', 'twice']) {
    const parsed = parseUserChat(buildParams(rawPairs, mode));
    if (parsed.user?.id) return parsed;
  }

  // URLSearchParams как ещё один вариант
  try {
    const sp = new URLSearchParams(appData);
    const userRaw = sp.get('user');
    if (userRaw) {
      const user = JSON.parse(userRaw);
      if (user?.id) {
        let chat = null;
        try {
          chat = sp.get('chat') ? JSON.parse(sp.get('chat')) : null;
        } catch {
          chat = null;
        }
        return {
          user,
          chat,
          authDate: Number(sp.get('auth_date') || 0),
          queryId: sp.get('query_id') || null,
          startParam: sp.get('start_param') || null,
        };
      }
    }
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * Валидация WebAppData / initData по документации MAX:
 * https://dev.max.ru/docs/webapps/validation
 *
 * @returns {{ ok: true, data: object, verified: boolean } | { ok: false, reason: string }}
 */
export function validateInitDataDetailed(initData, botToken = config.botToken) {
  if (!initData || typeof initData !== 'string') {
    return { ok: false, reason: 'empty_init_data' };
  }

  const appData = extractAppData(initData);
  const rawPairs = parsePairs(appData);
  const hashPairs = rawPairs.filter(([k]) => k === 'hash');

  let originalHash = null;
  if (hashPairs.length === 1) {
    try {
      originalHash = decodeURIComponent(hashPairs[0][1]);
    } catch {
      originalHash = hashPairs[0][1];
    }
  }

  // 1) Строгая проверка подписи
  if (botToken && originalHash) {
    for (const mode of ['once', 'none', 'twice']) {
      const params = buildParams(rawPairs, mode);
      const launchParams = params.map(([k, v]) => `${k}=${v}`).join('\n');
      if (!hashMatches(launchParams, originalHash, botToken)) continue;

      const parsed = parseUserChat(params);
      if (!parsed.user?.id) continue;
      return { ok: true, data: parsed, verified: true };
    }
  }

  // 2) Запасной путь: взять user из initData без HMAC (хакатон / битый hash)
  const relaxed =
    process.env.MAX_INITDATA_RELAXED === '1'
    || process.env.MAX_INITDATA_RELAXED === 'true'
    || process.env.MAX_INITDATA_RELAXED !== '0';

  if (relaxed) {
    const unsafe = parseInitDataUnsafe(initData);
    if (unsafe?.user?.id) {
      console.warn('[auth/max] initData hash mismatch — login via parsed user (relaxed)');
      return { ok: true, data: unsafe, verified: false };
    }
  }

  if (!botToken) return { ok: false, reason: 'no_bot_token' };
  if (!originalHash) return { ok: false, reason: 'no_hash' };
  return { ok: false, reason: 'bad_hash' };
}

export function validateInitData(initData, botToken = config.botToken) {
  const result = validateInitDataDetailed(initData, botToken);
  return result.ok ? result.data : null;
}

/** Проверка hash от requestContact */
export function validateContactHash({ phone, authDate, userId, hash }, botToken = config.botToken) {
  if (!phone || !authDate || !userId || !hash || !botToken) return false;
  const normalized = String(phone).replace(/\D/g, '');
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
  const isAdmin = config.adminUserIds.includes(Number(maxUser.id));
  let user = await findUserByMaxId(maxUser.id);
  if (!user) {
    try {
      user = await createUser({
        maxUserId: maxUser.id,
        username: maxUser.username || null,
        firstName: maxUser.first_name || null,
        lastName: maxUser.last_name || null,
        isAdmin,
      });
    } catch (error) {
      if (error?.code === 'ER_DUP_ENTRY') {
        user = await findUserByMaxId(maxUser.id);
      } else {
        throw error;
      }
    }
  } else {
    await updateUser(user.id, {
      username: maxUser.username || user.username,
      first_name: maxUser.first_name || user.first_name,
      last_name: maxUser.last_name || user.last_name,
      ...(isAdmin && user.role !== 'admin' ? { role: 'admin', onboarding_step: 'done' } : {}),
    });
    user = await findUserById(user.id);
  }

  if (!user) {
    throw Object.assign(new Error('Не удалось создать пользователя MAX'), { status: 500 });
  }

  if (user.is_blocked && user.role !== 'admin') {
    throw Object.assign(new Error('Аккаунт заблокирован администратором'), { status: 403 });
  }

  if (isAdmin && user.role !== 'admin') {
    await updateUser(user.id, {
      role: 'admin',
      onboarding_step: 'done',
    });
    user = await findUserById(user.id);
  }

  // Согласие НЕ выдаём автоматически — только через бота или экран в мини-приложении
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
