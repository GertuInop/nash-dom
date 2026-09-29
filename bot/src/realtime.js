import { WebSocketServer } from 'ws';
import { getSessionUser } from './web-db.js';
import { pool } from './db.js';

/** @type {Set<import('ws').WebSocket>} */
const clients = new Set();

function send(ws, payload) {
  if (ws.readyState !== 1) return;
  try {
    ws.send(JSON.stringify(payload));
  } catch {
    /* ignore */
  }
}

function roomMatch(ws, { houseId, companyId, userId }) {
  if (userId && String(ws.userId) === String(userId)) return true;
  if (houseId && ws.houseId && String(ws.houseId) === String(houseId)) return true;
  if (companyId && ws.companyId && String(ws.companyId) === String(companyId)) return true;
  return false;
}

/**
 * Рассылка события подписанным клиентам.
 * @param {{ houseId?: string|number|null, companyId?: string|number|null, userId?: string|number|null, excludeUserId?: string|number|null }} target
 * @param {object} payload
 */
export function broadcast(target, payload) {
  const msg = { ...payload, at: Date.now() };
  for (const ws of clients) {
    if (target.excludeUserId && String(ws.userId) === String(target.excludeUserId)) continue;
    if (!roomMatch(ws, target)) continue;
    send(ws, msg);
  }
}

export function broadcastChatMessage({ houseId, message, chats, excludeUserId }) {
  if (!houseId || !message) return;
  broadcast(
    { houseId, excludeUserId },
    { type: 'chat.message', message, chats: chats || null, houseId: String(houseId) },
  );
}

export function broadcastTicket(ticket, { excludeUserId, eventType } = {}) {
  if (!ticket) return;
  const type = eventType === 'created' ? 'ticket.created' : 'ticket.updated';
  broadcast(
    {
      companyId: ticket.companyId,
      userId: ticket.authorId,
      houseId: ticket.houseId,
      excludeUserId,
    },
    { type, ticket },
  );
}

export function broadcastParking({ houseId, parking, excludeUserId }) {
  if (!houseId) return;
  broadcast(
    { houseId, excludeUserId },
    { type: 'parking.updated', houseId: String(houseId), parking },
  );
}

export function broadcastWorks({ houseId, works, excludeUserId }) {
  if (!houseId) return;
  broadcast(
    { houseId, excludeUserId },
    { type: 'works.updated', houseId: String(houseId), works },
  );
}

export function broadcastResidents({ companyId, residents, excludeUserId }) {
  if (!companyId) return;
  broadcast(
    { companyId, excludeUserId },
    { type: 'residents.updated', companyId: String(companyId), residents },
  );
}

export function broadcastTopic({ houseId, topic, chats, excludeUserId }) {
  if (!houseId) return;
  broadcast(
    { houseId, excludeUserId },
    { type: 'topic.created', houseId: String(houseId), topic, chats: chats || null },
  );
}

export async function getChatHouseId(chatId) {
  if (!chatId) return null;
  const [rows] = await pool.execute(
    'SELECT house_id FROM chats WHERE id = :id LIMIT 1',
    { id: chatId },
  );
  return rows[0]?.house_id || null;
}

/**
 * @param {import('node:http').Server} server
 */
export function attachRealtime(server) {
  const wss = new WebSocketServer({ server, path: '/server/ws' });

  wss.on('connection', async (ws, req) => {
    try {
      const host = req.headers.host || 'localhost';
      const url = new URL(req.url || '/', `http://${host}`);
      const token = url.searchParams.get('token') || '';
      const user = await getSessionUser(token);
      if (!user) {
        send(ws, { type: 'error', error: 'unauthorized' });
        ws.close(4401, 'unauthorized');
        return;
      }

      ws.userId = String(user.id);
      ws.houseId = user.house_id || null;
      ws.companyId = user.company_id ? String(user.company_id) : null;
      ws.role = user.role || 'resident';
      clients.add(ws);

      send(ws, {
        type: 'hello',
        userId: ws.userId,
        houseId: ws.houseId,
        companyId: ws.companyId,
      });

      ws.on('message', (raw) => {
        let data;
        try {
          data = JSON.parse(String(raw));
        } catch {
          return;
        }
        if (data?.type === 'ping') {
          send(ws, { type: 'pong', at: Date.now() });
        }
        // Клиент может обновить rooms после смены дома/УК
        if (data?.type === 'sync' && data.houseId != null) {
          ws.houseId = data.houseId || null;
          ws.companyId = data.companyId ? String(data.companyId) : ws.companyId;
        }
      });

      ws.on('close', () => {
        clients.delete(ws);
      });
      ws.on('error', () => {
        clients.delete(ws);
      });
    } catch (error) {
      console.warn('[realtime] connection error:', error?.message || error);
      try {
        ws.close();
      } catch {
        /* ignore */
      }
    }
  });

  console.log('✅ WebSocket: /server/ws');
  return wss;
}

export function realtimeClientCount() {
  return clients.size;
}
