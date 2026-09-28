import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../config.js';
import {
  addMessage,
  bootstrapForUser,
  createSession,
  createTopic,
  createWebUser,
  deleteSession,
  digitsPhone,
  findUserByPhone,
  getSessionUser,
  listChats,
  listHouses,
  listMessages,
  listTicketsForUser,
  listTopics,
  listWorks,
  savePrivateAddress,
  selectUserHouse,
  serializeUserFixed,
  setTicketStatus,
  setWorkStatus,
  skipPrivateAddress,
  verifyPassword,
} from '../web-db.js';
import {
  attachPhoneFromMax,
  loginWithMaxUser,
  validateContactHash,
  validateInitData,
} from '../max-auth.js';
import { updateUser } from '../db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const miniappDir = path.resolve(__dirname, '../../miniapp');

function moderateMessage(text) {
  const t = String(text || '').trim();
  if (!t) return { allowed: false, reason: 'Пустое сообщение' };
  if (t.length > 2000) return { allowed: false, reason: 'Слишком длинное сообщение' };
  if (/(https?:\/\/|www\.)/i.test(t)) return { allowed: false, reason: 'Ссылки запрещены' };
  const letters = t.replace(/[^a-zA-Zа-яА-ЯёЁ]/g, '');
  if (letters.length >= 8 && letters === letters.toUpperCase()) {
    return { allowed: false, reason: 'Не используйте капс' };
  }
  const bad = /(хуй|пизд|ебан|ёбан|бляд|сука|мудил|долбоёб|долбоеб)/i;
  if (bad.test(t)) return { allowed: false, reason: 'Ненормативная лексика' };
  return { allowed: true };
}

function authHeader(req) {
  const h = req.headers.authorization || '';
  if (h.startsWith('Bearer ')) return h.slice(7).trim();
  return req.headers['x-session-token'] || null;
}

async function requireAuth(req, res, next) {
  try {
    const token = authHeader(req);
    const user = await getSessionUser(token);
    if (!user) {
      res.status(401).json({ error: 'Нужна авторизация' });
      return;
    }
    req.user = user;
    req.token = token;
    next();
  } catch (error) {
    next(error);
  }
}

function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export function createApiApp() {
  const app = express();
  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use(express.static(miniappDir, { index: 'index.html', extensions: ['html'] }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'nash-dom-api' });
  });

  app.post(
    '/api/auth/max',
    asyncHandler(async (req, res) => {
      const initData = String(req.body?.initData || '');
      const parsed = validateInitData(initData);
      if (!parsed) {
        res.status(401).json({ error: 'Невалидные данные MAX (initData)' });
        return;
      }
      const result = await loginWithMaxUser(parsed.user);
      res.json({
        ...result,
        startParam: parsed.startParam,
        platform: req.body?.platform || null,
      });
    }),
  );

  app.post(
    '/api/auth/max/phone',
    requireAuth,
    asyncHandler(async (req, res) => {
      const { phone, authDate, hash } = req.body || {};
      const maxId = req.user.max_user_id;
      if (!maxId) {
        res.status(400).json({ error: 'Аккаунт не связан с MAX' });
        return;
      }
      if (hash) {
        const ok = validateContactHash({ phone, authDate, userId: maxId, hash });
        if (!ok) {
          res.status(401).json({ error: 'Невалидный hash телефона' });
          return;
        }
      }
      const user = await attachPhoneFromMax(req.user.id, phone);
      res.json({ user: serializeUserFixed(user) });
    }),
  );

  app.post(
    '/api/auth/register',
    asyncHandler(async (req, res) => {
      const { name, phone, password, role, ukName } = req.body || {};
      if (!phone || !password || String(password).length < 4) {
        res.status(400).json({ error: 'Телефон и пароль (от 4 символов) обязательны' });
        return;
      }
      const existing = await findUserByPhone(phone);
      if (existing?.password_hash) {
        res.status(409).json({ error: 'Этот телефон уже зарегистрирован' });
        return;
      }
      const userRole = role === 'uk' ? 'uk' : 'resident';
      if (userRole === 'uk' && !String(ukName || '').trim()) {
        res.status(400).json({ error: 'Укажите название УК' });
        return;
      }
      if (userRole === 'resident' && !String(name || '').trim()) {
        res.status(400).json({ error: 'Укажите имя' });
        return;
      }

      let user;
      if (existing && !existing.password_hash) {
        const { hashPassword } = await import('../web-db.js');
        await updateUser(existing.id, {
          password_hash: hashPassword(password),
          first_name: name || existing.first_name,
          uk_name: ukName || existing.uk_name,
          role: existing.role || userRole,
          onboarding_step: existing.onboarding_step === 'done' ? 'done' : existing.onboarding_step,
        });
        user = await findUserByPhone(phone);
      } else {
        user = await createWebUser({
          name: String(name || (userRole === 'uk' ? 'Сотрудник УК' : 'Житель')).trim(),
          phone: String(phone).trim(),
          password: String(password),
          role: userRole,
          ukName: ukName ? String(ukName).trim() : undefined,
        });
      }

      const token = await createSession(user.id);
      const data = await bootstrapForUser(user);
      res.json({ token, ...data });
    }),
  );

  app.post(
    '/api/auth/login',
    asyncHandler(async (req, res) => {
      const { phone, password } = req.body || {};
      if (!phone || !password) {
        res.status(400).json({ error: 'Укажите телефон и пароль' });
        return;
      }

      let user = await findUserByPhone(phone);
      if (!user) {
        const d = digitsPhone(phone);
        const role = d.endsWith('1') ? 'uk' : 'resident';
        user = await createWebUser({
          name: role === 'uk' ? 'Сотрудник УК' : 'Житель',
          phone: String(phone).trim(),
          password: String(password),
          role,
          ukName: role === 'uk' ? 'УК (демо)' : undefined,
        });
      } else if (!user.password_hash) {
        const { hashPassword } = await import('../web-db.js');
        await updateUser(user.id, { password_hash: hashPassword(password) });
        user = await findUserByPhone(phone);
      } else if (!verifyPassword(String(password), user.password_hash)) {
        res.status(401).json({ error: 'Неверный пароль' });
        return;
      }

      const token = await createSession(user.id);
      const data = await bootstrapForUser(user);
      res.json({ token, ...data });
    }),
  );

  app.post(
    '/api/auth/logout',
    requireAuth,
    asyncHandler(async (req, res) => {
      await deleteSession(req.token);
      res.json({ ok: true });
    }),
  );

  app.get(
    '/api/me',
    requireAuth,
    asyncHandler(async (req, res) => {
      res.json(await bootstrapForUser(req.user));
    }),
  );

  app.get(
    '/api/houses',
    requireAuth,
    asyncHandler(async (_req, res) => {
      res.json({ houses: await listHouses() });
    }),
  );

  app.post(
    '/api/me/house',
    requireAuth,
    asyncHandler(async (req, res) => {
      const houseId = req.body?.houseId;
      if (!houseId) {
        res.status(400).json({ error: 'houseId обязателен' });
        return;
      }
      const user = await selectUserHouse(req.user.id, houseId);
      res.json(await bootstrapForUser(user));
    }),
  );

  app.post(
    '/api/me/address',
    requireAuth,
    asyncHandler(async (req, res) => {
      const { street, entrance, flat, skip } = req.body || {};
      const user = skip
        ? await skipPrivateAddress(req.user.id)
        : await savePrivateAddress(req.user.id, { street, entrance, flat });
      res.json({ user: serializeUserFixed(user) });
    }),
  );

  app.get(
    '/api/chats',
    requireAuth,
    asyncHandler(async (req, res) => {
      if (!req.user.house_id) {
        res.json({ chats: [] });
        return;
      }
      res.json({ chats: await listChats(req.user.house_id) });
    }),
  );

  app.get(
    '/api/chats/:chatId/messages',
    requireAuth,
    asyncHandler(async (req, res) => {
      res.json({ messages: await listMessages(req.params.chatId) });
    }),
  );

  app.post(
    '/api/chats/:chatId/messages',
    requireAuth,
    asyncHandler(async (req, res) => {
      const text = String(req.body?.text || '').trim();
      const check = moderateMessage(text);
      if (!check.allowed) {
        const msg = await addMessage({
          chatId: req.params.chatId,
          user: req.user,
          text: 'Сообщение скрыто модерацией',
          hidden: true,
          system: true,
        });
        res.status(422).json({ error: check.reason, message: msg });
        return;
      }
      const message = await addMessage({ chatId: req.params.chatId, user: req.user, text });
      const chats = req.user.house_id ? await listChats(req.user.house_id) : [];
      res.json({ message, chats });
    }),
  );

  app.get(
    '/api/topics',
    requireAuth,
    asyncHandler(async (req, res) => {
      if (!req.user.house_id) {
        res.json({ topics: [] });
        return;
      }
      res.json({ topics: await listTopics(req.user.house_id) });
    }),
  );

  app.post(
    '/api/topics',
    requireAuth,
    asyncHandler(async (req, res) => {
      const titleCheck = moderateMessage(req.body?.title);
      if (!titleCheck.allowed) {
        res.status(422).json({ error: titleCheck.reason || 'Заголовок отклонён' });
        return;
      }
      const descCheck = moderateMessage(req.body?.description);
      if (!descCheck.allowed) {
        res.status(422).json({ error: descCheck.reason || 'Описание отклонено' });
        return;
      }
      const result = await createTopic(req.user, req.body || {});
      const refreshed = await getSessionUser(req.token);
      const data = await bootstrapForUser(refreshed || req.user);
      res.status(201).json({ ...result, ...data });
    }),
  );

  app.get(
    '/api/tickets',
    requireAuth,
    asyncHandler(async (req, res) => {
      res.json({ tickets: await listTicketsForUser(req.user) });
    }),
  );

  app.patch(
    '/api/tickets/:id',
    requireAuth,
    asyncHandler(async (req, res) => {
      const ticket = await setTicketStatus(req.user, req.params.id, req.body?.status);
      res.json({ ticket });
    }),
  );

  app.get(
    '/api/works',
    requireAuth,
    asyncHandler(async (req, res) => {
      const houseId = req.query.houseId || req.user.house_id;
      if (!houseId) {
        res.json({ works: [] });
        return;
      }
      res.json({ works: await listWorks(houseId) });
    }),
  );

  app.patch(
    '/api/works/:id',
    requireAuth,
    asyncHandler(async (req, res) => {
      const work = await setWorkStatus(req.user, req.params.id, req.body?.status);
      res.json({ work });
    }),
  );

  app.get(/^(?!\/api).*/, (req, res, next) => {
    res.sendFile(path.join(miniappDir, 'index.html'), (err) => {
      if (err) next();
    });
  });

  app.use((err, _req, res, _next) => {
    const status = err.status || 500;
    if (status >= 500) console.error('API error:', err);
    res.status(status).json({ error: err.message || 'Ошибка сервера' });
  });

  return app;
}

export function startApiServer() {
  const app = createApiApp();
  const port = config.apiPort;
  return new Promise((resolve) => {
    const server = app.listen(port, () => {
      console.log(`✅ HTTP API + мини-приложение на порту ${port}`);
      console.log(`   Локально: http://127.0.0.1:${port}/  (для MAX нужен https URL в настройках бота)`);
      resolve(server);
    });
  });
}
