import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../config.js';
import {
  addMessage,
  bootstrapForUser,
  claimParkingSpot,
  createSession,
  createTopic,
  createWebTicket,
  createWebUser,
  deleteSession,
  digitsPhone,
  findUserByPhone,
  getSessionUser,
  listChats,
  listApprovedCompanies,
  listHouses,
  listMessages,
  listParking,
  listTicketsForUser,
  listTopics,
  listWorks,
  appealParkingSpot,
  releaseParkingSpot,
  savePrivateAddress,
  selectUserCompany,
  selectUserHouse,
  serializeUserFixed,
  setParkingActive,
  setTicketStatus,
  setWorkStatus,
  skipPrivateAddress,
  verifyPassword,
} from '../web-db.js';
import {
  attachPhoneFromMax,
  loginWithMaxUser,
  validateContactHash,
  validateInitDataDetailed,
} from '../max-auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const docsDir = path.resolve(__dirname, '../../docs');

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

function createServerRouter() {
  const api = express.Router();
  api.use(express.json({ limit: '1mb' }));

  api.get('/health', (_req, res) => {
    res.json({ ok: true, service: 'nash-dom-api' });
  });

  api.get('/status', (_req, res) => {
    res.json({
      ok: true,
      service: 'nash-dom-api',
      status: 'up',
      time: new Date().toISOString(),
    });
  });

  api.get('/openapi.yaml', (_req, res) => {
    const file = path.join(docsDir, 'openapi.yaml');
    if (!fs.existsSync(file)) {
      res.status(404).json({ error: 'openapi.yaml не найден' });
      return;
    }
    res.type('text/yaml').send(fs.readFileSync(file, 'utf8'));
  });

  api.get('/DATA-API.yaml', (_req, res) => {
    const file = path.join(docsDir, 'DATA-API.yaml');
    if (!fs.existsSync(file)) {
      res.status(404).json({ error: 'DATA-API.yaml не найден' });
      return;
    }
    res.type('text/yaml').send(fs.readFileSync(file, 'utf8'));
  });

  api.post(
    '/auth/max',
    asyncHandler(async (req, res) => {
      const initData = String(req.body?.initData || '');
      const bodyUser = req.body?.user;
      let parsed = validateInitDataDetailed(initData);

      // Запас: user из Bridge initDataUnsafe
      if (!parsed.ok && bodyUser?.id) {
        console.warn('[auth/max] fallback to body.user from Bridge');
        parsed = {
          ok: true,
          verified: false,
          data: {
            user: {
              id: bodyUser.id,
              first_name: bodyUser.first_name || bodyUser.firstName || null,
              last_name: bodyUser.last_name || bodyUser.lastName || null,
              username: bodyUser.username || null,
              language_code: bodyUser.language_code || bodyUser.languageCode || null,
              photo_url: bodyUser.photo_url || bodyUser.photoUrl || null,
            },
            chat: null,
            authDate: 0,
            queryId: null,
            startParam: null,
          },
        };
      }

      if (!parsed.ok) {
        const hints = {
          no_bot_token: 'На сервере не задан BOT_TOKEN',
          empty_init_data: 'Клиент не передал initData',
          no_hash: 'В initData нет hash',
          duplicate_hash: 'В initData несколько hash',
          bad_hash: 'Подпись initData не совпала — проверьте BOT_TOKEN',
          no_auth_date: 'В initData нет auth_date',
          expired: 'initData устарел (auth_date)',
          no_user: 'В initData нет user.id',
        };
        console.warn('[auth/max] initData rejected:', parsed.reason);
        res.status(401).json({
          error: 'Невалидные данные MAX (initData)',
          reason: parsed.reason,
          hint: hints[parsed.reason] || null,
        });
        return;
      }
      const result = await loginWithMaxUser(parsed.data.user);
      res.json({
        ...result,
        startParam: parsed.data.startParam,
        platform: req.body?.platform || null,
        verified: parsed.verified !== false,
      });
    }),
  );

  api.post(
    '/auth/max/phone',
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

  api.post(
    '/auth/register',
    asyncHandler(async (req, res) => {
      const { name, phone, password, role, ukName, city } = req.body || {};
      if (!phone) {
        res.status(400).json({ error: 'Укажите телефон' });
        return;
      }
      const existing = await findUserByPhone(phone);
      if (existing) {
        const token = await createSession(existing.id);
        const data = await bootstrapForUser(existing);
        res.json({ token, ...data });
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

      const citySlug = city
        ? String(city)
            .trim()
            .toLowerCase()
            .replace(/ё/g, 'е')
            .replace(/\s+/g, '_')
        : undefined;

      const user = await createWebUser({
        name: String(name || (userRole === 'uk' ? 'Сотрудник УК' : 'Житель')).trim(),
        phone: String(phone).trim(),
        password: password ? String(password) : undefined,
        role: userRole,
        ukName: ukName ? String(ukName).trim() : undefined,
        citySlug,
      });

      const token = await createSession(user.id);
      const data = await bootstrapForUser(user);
      res.json({ token, ...data });
    }),
  );

  api.post(
    '/auth/login',
    asyncHandler(async (req, res) => {
      const { phone, password, name, role, ukName } = req.body || {};
      if (!phone) {
        res.status(400).json({ error: 'Укажите телефон' });
        return;
      }

      let user = await findUserByPhone(phone);
      if (!user) {
        const d = digitsPhone(phone);
        const userRole = role === 'uk' || (!role && d.endsWith('1')) ? 'uk' : 'resident';
        user = await createWebUser({
          name: name || (userRole === 'uk' ? 'Сотрудник УК' : 'Житель'),
          phone: String(phone).trim(),
          password: password ? String(password) : undefined,
          role: userRole,
          ukName: ukName || (userRole === 'uk' ? 'УК (демо)' : undefined),
        });
      } else if (password && user.password_hash && !verifyPassword(String(password), user.password_hash)) {
        // Пароль в мини-приложении MAX не обязателен; проверяем только если передан
        res.status(401).json({ error: 'Неверный пароль' });
        return;
      }

      const token = await createSession(user.id);
      const data = await bootstrapForUser(user);
      res.json({ token, ...data });
    }),
  );

  api.post(
    '/auth/logout',
    requireAuth,
    asyncHandler(async (req, res) => {
      await deleteSession(req.token);
      res.json({ ok: true });
    }),
  );

  api.get(
    '/me',
    requireAuth,
    asyncHandler(async (req, res) => {
      res.json(await bootstrapForUser(req.user));
    }),
  );

  api.get(
    '/houses',
    requireAuth,
    asyncHandler(async (_req, res) => {
      res.json({ houses: await listHouses() });
    }),
  );

  api.get(
    '/companies',
    requireAuth,
    asyncHandler(async (_req, res) => {
      res.json({ companies: await listApprovedCompanies() });
    }),
  );

  api.post(
    '/me/company',
    requireAuth,
    asyncHandler(async (req, res) => {
      const companyId = req.body?.companyId;
      if (!companyId) {
        res.status(400).json({ error: 'companyId обязателен' });
        return;
      }
      const user = await selectUserCompany(req.user.id, companyId);
      res.json(await bootstrapForUser(user));
    }),
  );

  api.post(
    '/me/house',
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

  api.post(
    '/me/address',
    requireAuth,
    asyncHandler(async (req, res) => {
      const { street, entrance, flat, skip } = req.body || {};
      const user = skip
        ? await skipPrivateAddress(req.user.id)
        : await savePrivateAddress(req.user.id, { street, entrance, flat });
      res.json({ user: serializeUserFixed(user) });
    }),
  );

  api.get(
    '/chats',
    requireAuth,
    asyncHandler(async (req, res) => {
      if (!req.user.house_id) {
        res.json({ chats: [] });
        return;
      }
      res.json({ chats: await listChats(req.user.house_id) });
    }),
  );

  api.get(
    '/chats/:chatId/messages',
    requireAuth,
    asyncHandler(async (req, res) => {
      res.json({ messages: await listMessages(req.params.chatId) });
    }),
  );

  api.post(
    '/chats/:chatId/messages',
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

  api.get(
    '/topics',
    requireAuth,
    asyncHandler(async (req, res) => {
      if (!req.user.house_id) {
        res.json({ topics: [] });
        return;
      }
      res.json({ topics: await listTopics(req.user.house_id) });
    }),
  );

  api.post(
    '/topics',
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

  api.get(
    '/tickets',
    requireAuth,
    asyncHandler(async (req, res) => {
      res.json({ tickets: await listTicketsForUser(req.user) });
    }),
  );

  api.post(
    '/tickets',
    requireAuth,
    asyncHandler(async (req, res) => {
      if (req.user.role === 'uk') {
        res.status(400).json({ error: 'Заявки создают жители' });
        return;
      }
      const title = String(req.body?.title || '').trim();
      const description = String(req.body?.description || '').trim();
      const category = String(req.body?.category || 'other');
      if (!title || !description) {
        res.status(400).json({ error: 'Укажите заголовок и описание' });
        return;
      }
      const ticket = await createWebTicket(req.user, { title, description, category });
      res.status(201).json({ ticket, tickets: await listTicketsForUser(req.user) });
    }),
  );

  api.patch(
    '/tickets/:id',
    requireAuth,
    asyncHandler(async (req, res) => {
      const ticket = await setTicketStatus(req.user, req.params.id, req.body?.status);
      res.json({ ticket });
    }),
  );

  api.get(
    '/parking',
    requireAuth,
    asyncHandler(async (req, res) => {
      const houseId = req.query.houseId || req.user.house_id;
      if (!houseId) {
        res.json({ parking: [] });
        return;
      }
      res.json({ parking: await listParking(houseId) });
    }),
  );

  api.post(
    '/parking/:id/claim',
    requireAuth,
    asyncHandler(async (req, res) => {
      const parking = await claimParkingSpot(req.user, req.params.id);
      res.json({ parking });
    }),
  );

  api.post(
    '/parking/:id/release',
    requireAuth,
    asyncHandler(async (req, res) => {
      const parking = await releaseParkingSpot(req.user, req.params.id);
      res.json({ parking });
    }),
  );

  api.post(
    '/parking/:id/appeal',
    requireAuth,
    asyncHandler(async (req, res) => {
      const result = await appealParkingSpot(req.user, req.params.id);
      res.status(201).json(result);
    }),
  );

  api.patch(
    '/parking/:id',
    requireAuth,
    asyncHandler(async (req, res) => {
      const parking = await setParkingActive(req.user, req.params.id, Boolean(req.body?.active));
      res.json({ parking });
    }),
  );

  api.get(
    '/works',
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

  api.patch(
    '/works/:id',
    requireAuth,
    asyncHandler(async (req, res) => {
      const work = await setWorkStatus(req.user, req.params.id, req.body?.status);
      res.json({ work });
    }),
  );

  return api;
}

/**
 * @param {{ webhookHandler?: (req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse) => void }} [options]
 */
export function createApiApp(options = {}) {
  const app = express();
  app.use(cors({ origin: true, credentials: true }));

  // /bot — webhook MAX (сырое тело, без express.json)
  if (options.webhookHandler) {
    app.post('/bot', (req, res) => {
      options.webhookHandler(req, res);
    });
  }
  app.get('/bot', (_req, res) => {
    res.json({ ok: true, service: 'nash-dom-bot', mode: config.botMode });
  });

  // /server — REST API для фронта
  app.use('/server', createServerRouter());

  app.use((err, _req, res, _next) => {
    const status = err.status || 500;
    if (status >= 500) console.error('API error:', err);
    res.status(status).json({ error: err.message || 'Ошибка сервера' });
  });

  return app;
}

export function startApiServer(options = {}) {
  const app = createApiApp(options);
  const port = config.apiPort;
  return new Promise((resolve) => {
    const server = app.listen(port, () => {
      console.log(`✅ HTTP на порту ${port}`);
      console.log(`   Webhook MAX:  POST /bot`);
      console.log(`   API фронта:   /server/*`);
      resolve(server);
    });
  });
}
