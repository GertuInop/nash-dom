import crypto from 'node:crypto';
import { findUserByMaxId, createUser, updateUser } from './db.js';
import { createSession, bootstrapForUser, findUserById } from './web-db.js';
import { config } from './config.js';

/**
 * Валидация WebAppData / initData по документации MAX:
 * https://dev.max.ru/docs/webapps/validation
 *
 * @returns {{ ok: true, data: object } | { ok: false, reason: string }}
 */
export function validateInitDataDetailed(initData, botToken = config.botToken) {
  if (!botToken) return { ok: false, reason: 'no_bot_token' };
  if (!initData || typeof initData !== 'string') {
    return { ok: false, reason: 'empty_init_data' };
  }

  let appData = initData.trim();

  // Иногда приходит весь hash-фрагмент с WebAppData=...
  if (appData.includes('WebAppData=')) {
    try {
      const fragment = appData.startsWith('#') ? appData.slice(1) : appData;
      const outer = new URLSearchParams(fragment);
      const nested = outer.get('WebAppData');
      if (nested) appData = nested;
    } catch {
      /* оставляем как есть */
    }
  }

  const rawPairs = appData.split('&').filter(Boolean).map((pair) => {
    const eq = pair.indexOf('=');
    if (eq === -1) return [pair, ''];
    return [pair.slice(0, eq), pair.slice(eq + 1)];
  });

  const hashPairs = rawPairs.filter(([k]) => k === 'hash');
  if (hashPairs.length !== 1) {
    return { ok: false, reason: hashPairs.length === 0 ? 'no_hash' : 'duplicate_hash' };
  }

  let originalHash;
  try {
    originalHash = decodeURIComponent(hashPairs[0][1]);
  } catch {
    originalHash = hashPairs[0][1];
  }
  if (!originalHash) return { ok: false, reason: 'no_hash' };

  const decodeModes = ['once', 'none', 'twice'];
  let matched = null;
  let lastReason = 'bad_hash';

  for (const mode of decodeModes) {
    const params = [];
    for (const [key, rawValue] of rawPairs) {
      if (key === 'hash') continue;
      params.push([key, decodeValue(rawValue, mode)]);
    }
    params.sort((a, b) => a[0].localeCompare(b[0]));
    const launchParams = params.map(([k, v]) => `${k}=${v}`).join('\n');

    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
    const calculated = crypto.createHmac('sha256', secretKey).update(launchParams).digest('hex');

    let hashOk = false;
    try {
      const a = Buffer.from(calculated, 'utf8');
      const b = Buffer.from(String(originalHash), 'utf8');
      hashOk = a.length === b.length && crypto.timingSafeEqual(a, b);
    } catch {
      hashOk = false;
    }
    if (!hashOk) continue;

    const authDate = Number(params.find(([k]) => k === 'auth_date')?.[1] || 0);
    if (!authDate) {
      lastReason = 'no_auth_date';
      continue;
    }
    const skew = Math.abs(Date.now() / 1000 - authDate);
    if (skew > 86400) {
      lastReason = 'expired';
      continue;
    }

    let user = null;
    const userRaw = params.find(([k]) => k === 'user')?.[1];
    try {
      user = userRaw ? JSON.parse(userRaw) : null;
    } catch {
      user = null;
    }
    if (!user?.id) {
      lastReason = 'no_user';
      continue;
    }

    let chat = null;
    const chatRaw = params.find(([k]) => k === 'chat')?.[1];
    try {
      chat = chatRaw ? JSON.parse(chatRaw) : null;
    } catch {
      chat = null;
    }

    matched = {
      user,
      chat,
      authDate,
      queryId: params.find(([k]) => k === 'query_id')?.[1] || null,
      startParam: params.find(([k]) => k === 'start_param')?.[1] || null,
    };
    break;
  }

  if (!matched) return { ok: false, reason: lastReason };

  return { ok: true, data: matched };
}

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
