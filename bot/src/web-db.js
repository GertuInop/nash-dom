import crypto from 'node:crypto';
import { pool, updateUser } from './db.js';
import { createRequest, getRequestById, listResidentRequests, listCompanyRequests, updateRequestStatus } from './tickets-db.js';

const HOUSE_SEED = [];

const WORK_SEED = [];

/** Старые демо-дома из сидов — удаляем при старте */
const DEMO_HOUSE_IDS = [
  'h-ural', 'h-sov', 'h-vol', 'h-len', 'h-shi',
  'h-msk-arb', 'h-msk-twr', 'h-msk-len',
  'h-spb-nv', 'h-spb-vas',
  'h-kzn-bm', 'h-kzn-pr',
  'h-nsk-kr', 'h-ekb-ml', 'h-nch-mr', 'h-krd-kr',
];

/** УК, созданные сидами домов (не через бота) */
const DEMO_UK_NAMES = [
  'УК «Балтийский дом»',
  'УК «Центральная»',
  'УК «Преголя»',
  'УК «Городские кварталы»',
  'УК «Зелёный берег»',
  'УК «Арбат Сервис»',
  'УК «Столица»',
  'УК «Юго-Запад»',
  'УК «Невский дом»',
  'УК «Василеостровская»',
  'УК «Казанский двор»',
  'УК «Победа»',
  'УК «Сибирь Жилсервис»',
  'УК «УралДом»',
  'УК «ЧелныСервис»',
  'УК «Кубань Дом»',
  'УК (демо)',
];

async function columnExists(table, column) {
  const [rows] = await pool.execute(
    `SELECT COUNT(*) AS cnt FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table AND COLUMN_NAME = :column`,
    { table, column },
  );
  return Number(rows[0]?.cnt) > 0;
}

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  if (!stored || !stored.includes(':')) return false;
  const [salt, hash] = stored.split(':');
  const check = crypto.scryptSync(password, salt, 64).toString('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(check, 'hex'));
  } catch {
    return false;
  }
}

export function digitsPhone(phone) {
  return String(phone || '').replace(/\D/g, '');
}

function cityToSlug(city) {
  return String(city || '')
    .trim()
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/\s+/g, '_')
    .replace(/[^a-zа-я0-9_]/gi, '');
}

export async function ensureWebSchema() {
  // max_user_id может быть NULL у веб-пользователей (MySQL UNIQUE допускает много NULL)
  await pool.execute(`
    ALTER TABLE users MODIFY max_user_id BIGINT NULL
  `).catch(() => {});

  const cols = [
    ['password_hash', 'VARCHAR(255) NULL'],
    ['house_id', 'VARCHAR(64) NULL'],
    ['street', 'VARCHAR(255) NULL'],
    ['entrance', 'VARCHAR(32) NULL'],
    ['flat', 'VARCHAR(32) NULL'],
    ['skipped_address', 'TINYINT(1) NOT NULL DEFAULT 0'],
    ['uk_name', 'VARCHAR(255) NULL'],
    ['is_blocked', 'TINYINT(1) NOT NULL DEFAULT 0'],
  ];
  for (const [name, def] of cols) {
    if (!(await columnExists('users', name))) {
      await pool.execute(`ALTER TABLE users ADD COLUMN ${name} ${def}`);
    }
  }

  if (!(await columnExists('requests', 'house_id'))) {
    await pool.execute('ALTER TABLE requests ADD COLUMN house_id VARCHAR(64) NULL');
  }
  if (!(await columnExists('requests', 'web_category'))) {
    await pool.execute('ALTER TABLE requests ADD COLUMN web_category VARCHAR(64) NULL');
  }
  if (!(await columnExists('requests', 'title'))) {
    await pool.execute('ALTER TABLE requests ADD COLUMN title VARCHAR(255) NULL');
  }

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS houses (
      id VARCHAR(64) NOT NULL,
      city VARCHAR(128) NOT NULL,
      address VARCHAR(512) NOT NULL,
      uk_name VARCHAR(255) NOT NULL,
      company_id BIGINT UNSIGNED NULL,
      floors INT NULL,
      entrances INT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_houses_company (company_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS web_sessions (
      token CHAR(64) NOT NULL,
      user_id BIGINT UNSIGNED NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME NOT NULL,
      PRIMARY KEY (token),
      KEY idx_ws_user (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS chats (
      id VARCHAR(64) NOT NULL,
      house_id VARCHAR(64) NOT NULL,
      name VARCHAR(255) NOT NULL,
      type ENUM('general', 'uk', 'topic') NOT NULL,
      topic_id VARCHAR(64) NULL,
      last_message VARCHAR(512) NULL,
      last_time VARCHAR(32) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_chats_house (house_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS messages (
      id VARCHAR(64) NOT NULL,
      chat_id VARCHAR(64) NOT NULL,
      text TEXT NOT NULL,
      sender_user_id BIGINT UNSIGNED NULL,
      sender_name VARCHAR(255) NOT NULL,
      time_label VARCHAR(32) NOT NULL,
      hidden TINYINT(1) NOT NULL DEFAULT 0,
      is_system TINYINT(1) NOT NULL DEFAULT 0,
      photo_label VARCHAR(255) NULL,
      photo_url VARCHAR(512) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_messages_chat (chat_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS topics (
      id VARCHAR(64) NOT NULL,
      house_id VARCHAR(64) NOT NULL,
      chat_id VARCHAR(64) NOT NULL,
      category VARCHAR(64) NOT NULL,
      title VARCHAR(255) NOT NULL,
      description TEXT NOT NULL,
      author_user_id BIGINT UNSIGNED NOT NULL,
      author_name VARCHAR(255) NOT NULL,
      comments_count INT NOT NULL DEFAULT 0,
      time_label VARCHAR(32) NOT NULL,
      photo_label VARCHAR(255) NULL,
      photo_url VARCHAR(512) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_topics_house (house_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS entrance_works (
      id VARCHAR(64) NOT NULL,
      house_id VARCHAR(64) NOT NULL,
      entrance INT NOT NULL,
      floor INT NULL,
      title VARCHAR(255) NOT NULL,
      detail TEXT NOT NULL,
      status ENUM('todo', 'in_progress', 'done') NOT NULL DEFAULT 'todo',
      PRIMARY KEY (id),
      KEY idx_works_house (house_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS parking_spots (
      id VARCHAR(64) NOT NULL,
      house_id VARCHAR(64) NOT NULL,
      label VARCHAR(32) NOT NULL,
      row_idx INT NOT NULL DEFAULT 0,
      col_idx INT NOT NULL DEFAULT 0,
      active TINYINT(1) NOT NULL DEFAULT 1,
      occupied TINYINT(1) NOT NULL DEFAULT 0,
      occupied_by_user_id BIGINT UNSIGNED NULL,
      occupied_at DATETIME NULL,
      PRIMARY KEY (id),
      KEY idx_parking_house (house_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await seedHousesAndWorks();
  await cleanupDemoHouses();
  await seedParkingSpots();
}

async function seedHousesAndWorks() {
  for (const h of HOUSE_SEED) {
    const [existing] = await pool.execute('SELECT id, company_id FROM houses WHERE id = :id', { id: h.id });
    if (!existing.length) {
      let companyId = null;
      const [mc] = await pool.execute(
        `SELECT id FROM management_companies WHERE name = :name AND (city_slug = :slug OR city_slug IS NULL) LIMIT 1`,
        { name: h.uk, slug: cityToSlug(h.city) },
      );
      if (mc.length) {
        companyId = mc[0].id;
      } else {
        const [ins] = await pool.execute(
          `INSERT INTO management_companies (name, city_slug, status, address)
           VALUES (:name, :slug, 'approved', :address)`,
          { name: h.uk, slug: cityToSlug(h.city), address: `${h.city}, ${h.address}` },
        );
        companyId = ins.insertId;
      }
      await pool.execute(
        `INSERT INTO houses (id, city, address, uk_name, company_id, floors, entrances)
         VALUES (:id, :city, :address, :uk, :companyId, :floors, :entrances)`,
        { id: h.id, city: h.city, address: h.address, uk: h.uk, companyId, floors: h.floors, entrances: h.entrances },
      );
    } else {
      await pool.execute(
        `UPDATE houses
         SET city = :city, address = :address, uk_name = :uk,
             floors = :floors, entrances = :entrances
         WHERE id = :id`,
        { id: h.id, city: h.city, address: h.address, uk: h.uk, floors: h.floors, entrances: h.entrances },
      );
      if (!existing[0].company_id) {
        const [mc] = await pool.execute(
          `SELECT id FROM management_companies WHERE name = :name LIMIT 1`,
          { name: h.uk },
        );
        if (mc.length) {
          await pool.execute('UPDATE houses SET company_id = :cid WHERE id = :id', {
            cid: mc[0].id,
            id: h.id,
          });
        }
      }
    }
  }

  const [workCount] = await pool.execute('SELECT COUNT(*) AS cnt FROM entrance_works');
  if (Number(workCount[0].cnt) === 0) {
    let n = 0;
    for (const [houseId, entrance, floor, title, detail, status] of WORK_SEED) {
      n += 1;
      const id = `${houseId}-e${entrance}-${n}`;
      await pool.execute(
        `INSERT INTO entrance_works (id, house_id, entrance, floor, title, detail, status)
         VALUES (:id, :houseId, :entrance, :floor, :title, :detail, :status)`,
        { id, houseId, entrance, floor, title, detail, status },
      );
    }
  }
}

async function cleanupDemoHouses() {
  if (!DEMO_HOUSE_IDS.length) return;
  const placeholders = DEMO_HOUSE_IDS.map(() => '?').join(',');

  let linkedCompanyIds = [];
  try {
    const [rows] = await pool.execute(
      `SELECT DISTINCT company_id AS id FROM houses
       WHERE id IN (${placeholders}) AND company_id IS NOT NULL`,
      DEMO_HOUSE_IDS,
    );
    linkedCompanyIds = rows.map((r) => r.id).filter(Boolean);
  } catch {
    linkedCompanyIds = [];
  }

  await pool.execute(
    `DELETE FROM parking_spots WHERE house_id IN (${placeholders})`,
    DEMO_HOUSE_IDS,
  ).catch(() => {});
  await pool.execute(
    `DELETE FROM entrance_works WHERE house_id IN (${placeholders})`,
    DEMO_HOUSE_IDS,
  ).catch(() => {});
  await pool.execute(
    `UPDATE users SET house_id = NULL WHERE house_id IN (${placeholders})`,
    DEMO_HOUSE_IDS,
  ).catch(() => {});
  await pool.execute(
    `DELETE FROM houses WHERE id IN (${placeholders})`,
    DEMO_HOUSE_IDS,
  ).catch(() => {});

  // Сидовые УК без заявки через бота
  if (DEMO_UK_NAMES.length) {
    const namePh = DEMO_UK_NAMES.map(() => '?').join(',');
    await pool.execute(
      `UPDATE users u
       INNER JOIN management_companies mc ON mc.id = u.company_id
       SET u.company_id = NULL
       WHERE mc.name IN (${namePh}) AND mc.requested_by_user_id IS NULL`,
      DEMO_UK_NAMES,
    ).catch(() => {});
    await pool.execute(
      `DELETE FROM management_companies
       WHERE name IN (${namePh}) AND requested_by_user_id IS NULL`,
      DEMO_UK_NAMES,
    ).catch(() => {});
  }

  if (linkedCompanyIds.length) {
    const cidPh = linkedCompanyIds.map(() => '?').join(',');
    await pool.execute(
      `DELETE FROM management_companies
       WHERE id IN (${cidPh}) AND requested_by_user_id IS NULL`,
      linkedCompanyIds,
    ).catch(() => {});
  }

  // Веб-демо без привязки к MAX (логин по телефону)
  await pool.execute(
    `DELETE FROM web_sessions WHERE user_id IN (SELECT id FROM (SELECT id FROM users WHERE max_user_id IS NULL) t)`,
  ).catch(() => {});
  await pool.execute(
    `DELETE FROM notification_settings WHERE user_id IN (SELECT id FROM (SELECT id FROM users WHERE max_user_id IS NULL) t)`,
  ).catch(() => {});
  await pool.execute(`DELETE FROM users WHERE max_user_id IS NULL`).catch(() => {});
}

async function seedParkingSpots() {
  const [houses] = await pool.execute('SELECT id FROM houses');
  for (const h of houses) {
    const [cnt] = await pool.execute(
      'SELECT COUNT(*) AS c FROM parking_spots WHERE house_id = :id',
      { id: h.id },
    );
    if (Number(cnt[0].c) > 0) continue;
    const rows = 3;
    const cols = 6;
    let n = 0;
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        n += 1;
        const id = `${h.id}-p${n}`;
        const occupied = n % 5 === 0 ? 1 : 0;
        await pool.execute(
          `INSERT INTO parking_spots
           (id, house_id, label, row_idx, col_idx, active, occupied, occupied_at)
           VALUES (:id, :houseId, :label, :rowIdx, :colIdx, 1, :occupied, :occupiedAt)`,
          {
            id,
            houseId: h.id,
            label: `P${n}`,
            rowIdx: r,
            colIdx: c,
            occupied,
            occupiedAt: occupied ? new Date() : null,
          },
        );
      }
    }
  }
}

export async function findUserByPhone(phone) {
  const d = digitsPhone(phone);
  if (!d) return null;
  const [rows] = await pool.execute(
    `SELECT * FROM users WHERE phone IS NOT NULL AND phone != '' LIMIT 500`,
  );
  return rows.find((u) => digitsPhone(u.phone) === d) || null;
}

export async function findUserById(id) {
  const [rows] = await pool.execute('SELECT * FROM users WHERE id = :id LIMIT 1', { id });
  return rows[0] || null;
}

export async function createWebUser({ name, phone, password, role, ukName, citySlug }) {
  const passwordHash = hashPassword(password || crypto.randomBytes(12).toString('hex'));
  const slug = citySlug || 'калининград';
  const [result] = await pool.execute(
    `INSERT INTO users (
      max_user_id, first_name, phone, password_hash, role, uk_name,
      consent_accepted, consent_accepted_at, onboarding_step, uk_status, city_slug
    ) VALUES (
      NULL, :name, :phone, :passwordHash, :role, :ukName,
      1, NOW(), 'done', :ukStatus, :citySlug
    )`,
    {
      name,
      phone,
      passwordHash,
      role,
      ukName: ukName || null,
      ukStatus: role === 'uk' ? 'approved' : 'none',
      citySlug: slug,
    },
  );

  let companyId = null;
  if (role === 'uk' && ukName) {
    const [ins] = await pool.execute(
      `INSERT INTO management_companies (name, city_slug, status, requested_by_user_id, phone)
       VALUES (:name, :slug, 'approved', :userId, :phone)`,
      { name: ukName, slug, userId: result.insertId, phone },
    );
    companyId = ins.insertId;
    await updateUser(result.insertId, { company_id: companyId });
  }

  await pool.execute(
    `INSERT INTO notification_settings (user_id) VALUES (:userId)
     ON DUPLICATE KEY UPDATE user_id = user_id`,
    { userId: result.insertId },
  );

  return findUserById(result.insertId);
}

export async function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  await pool.execute(
    `INSERT INTO web_sessions (token, user_id, expires_at)
     VALUES (:token, :userId, DATE_ADD(NOW(), INTERVAL 30 DAY))`,
    { token, userId },
  );
  return token;
}

export async function getSessionUser(token) {
  if (!token) return null;
  const [rows] = await pool.execute(
    `SELECT u.* FROM web_sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token = :token AND s.expires_at > NOW()
     LIMIT 1`,
    { token },
  );
  return rows[0] || null;
}

export async function deleteSession(token) {
  if (!token) return;
  await pool.execute('DELETE FROM web_sessions WHERE token = :token', { token });
}

export function serializeUserFixed(user) {
  if (!user) return null;
  let role = 'resident';
  if (user.role === 'admin') role = 'admin';
  else if (user.role === 'uk') role = 'uk';

  const name = [user.first_name, user.last_name].filter(Boolean).join(' ')
    || user.full_name
    || 'Пользователь';
  return {
    id: String(user.id),
    name,
    phone: user.phone || '',
    role,
    houseId: user.house_id || undefined,
    ukName: user.uk_name || undefined,
    street: user.street || undefined,
    entrance: user.entrance || undefined,
    flat: user.flat || undefined,
    skippedAddress: Boolean(user.skipped_address) || role === 'uk' || role === 'admin',
    companyId: user.company_id ? String(user.company_id) : undefined,
    blocked: Boolean(user.is_blocked),
    maxUserId: user.max_user_id ? String(user.max_user_id) : undefined,
    username: user.username || undefined,
  };
}

export async function listHouses() {
  const [rows] = await pool.execute(
    `SELECT id, city, address, uk_name AS uk, company_id, floors, entrances
     FROM houses ORDER BY address ASC`,
  );
  return rows.map((r) => ({
    id: r.id,
    city: r.city,
    address: r.address,
    uk: r.uk,
    companyId: r.company_id ? String(r.company_id) : undefined,
    floors: Number(r.floors) || 5,
    entrances: Number(r.entrances) || 2,
  }));
}

function cityLabelFromSlug(slug) {
  if (!slug) return 'Город';
  return String(slug)
    .replace(/_/g, ' ')
    .replace(/(^|\s)\S/g, (m) => m.toUpperCase());
}

export async function listApprovedCompanies() {
  const [rows] = await pool.execute(
    `SELECT id, name, city_slug, phone, email, address, status
     FROM management_companies
     WHERE status = 'approved'
     ORDER BY city_slug ASC, name ASC`,
  );
  return rows.map((r) => ({
    id: String(r.id),
    name: r.name,
    city: cityLabelFromSlug(r.city_slug),
    citySlug: r.city_slug || '',
    phone: r.phone || '',
    email: r.email || '',
    address: r.address || '',
    status: r.status,
  }));
}

export async function ensureHouseForCompany(company) {
  if (!company?.id) return null;
  const [existing] = await pool.execute(
    'SELECT * FROM houses WHERE company_id = :cid ORDER BY id ASC LIMIT 1',
    { cid: company.id },
  );
  if (existing[0]) return existing[0];

  const id = `c-${company.id}`;
  const city = cityLabelFromSlug(company.city_slug);
  const address = company.address || company.name;
  await pool.execute(
    `INSERT INTO houses (id, city, address, uk_name, company_id, floors, entrances)
     VALUES (:id, :city, :address, :uk, :cid, 5, 2)
     ON DUPLICATE KEY UPDATE
       city = VALUES(city), address = VALUES(address), uk_name = VALUES(uk_name),
       company_id = VALUES(company_id)`,
    { id, city, address, uk: company.name, cid: company.id },
  );
  await ensureHouseChats(id);

  const [cnt] = await pool.execute(
    'SELECT COUNT(*) AS c FROM parking_spots WHERE house_id = :id',
    { id },
  );
  if (Number(cnt[0].c) === 0) {
    let n = 0;
    for (let r = 0; r < 3; r += 1) {
      for (let c = 0; c < 6; c += 1) {
        n += 1;
        await pool.execute(
          `INSERT INTO parking_spots
           (id, house_id, label, row_idx, col_idx, active, occupied, occupied_at)
           VALUES (:pid, :houseId, :label, :rowIdx, :colIdx, 1, 0, NULL)`,
          { pid: `${id}-p${n}`, houseId: id, label: `P${n}`, rowIdx: r, colIdx: c },
        );
      }
    }
  }

  return getHouse(id);
}

export async function selectUserCompany(userId, companyId) {
  const [rows] = await pool.execute(
    `SELECT * FROM management_companies WHERE id = :id AND status = 'approved' LIMIT 1`,
    { id: companyId },
  );
  const company = rows[0];
  if (!company) throw Object.assign(new Error('УК не найдена'), { status: 404 });

  const house = await ensureHouseForCompany(company);
  const user = await findUserById(userId);
  await updateUser(userId, {
    company_id: company.id,
    house_id: house.id,
    uk_name: company.name,
    city_slug: company.city_slug || user.city_slug,
    skipped_address: user.role === 'uk' ? 1 : user.skipped_address || 0,
  });
  return findUserById(userId);
}

/** Если у пользователя уже есть УК из бота — привязать дом */
export async function ensureUserHouseFromCompany(user) {
  if (!user?.company_id || user.house_id) return user;
  const [rows] = await pool.execute(
    'SELECT * FROM management_companies WHERE id = :id LIMIT 1',
    { id: user.company_id },
  );
  const company = rows[0];
  if (!company) return user;
  const house = await ensureHouseForCompany(company);
  await updateUser(user.id, { house_id: house.id, uk_name: user.uk_name || company.name });
  return findUserById(user.id);
}

export async function getHouse(houseId) {
  const [rows] = await pool.execute('SELECT * FROM houses WHERE id = :id LIMIT 1', { id: houseId });
  return rows[0] || null;
}

export async function selectUserHouse(userId, houseId) {
  const house = await getHouse(houseId);
  if (!house) throw Object.assign(new Error('Дом не найден'), { status: 404 });

  const user = await findUserById(userId);
  const fields = {
    house_id: houseId,
    skipped_address: user.role === 'uk' ? 1 : 0,
  };
  if (user.role === 'resident' && house.company_id) {
    fields.company_id = house.company_id;
  }
  if (user.role === 'uk' && !user.company_id && house.company_id) {
    fields.company_id = house.company_id;
  }
  await updateUser(userId, fields);
  await ensureHouseChats(houseId);
  return findUserById(userId);
}

export async function savePrivateAddress(userId, { street, entrance, flat }) {
  await updateUser(userId, {
    street: street || null,
    entrance: entrance || null,
    flat: flat || null,
    skipped_address: 1,
    registration_address: [street, entrance && `подъезд ${entrance}`, flat && `кв. ${flat}`]
      .filter(Boolean)
      .join(', ') || null,
  });
  return findUserById(userId);
}

export async function skipPrivateAddress(userId) {
  await updateUser(userId, { skipped_address: 1 });
  return findUserById(userId);
}

function newId(prefix) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function clock() {
  return new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

export async function ensureHouseChats(houseId) {
  const [existing] = await pool.execute(
    'SELECT type FROM chats WHERE house_id = :houseId AND type IN (\'general\', \'uk\')',
    { houseId },
  );
  const types = new Set(existing.map((r) => r.type));
  if (!types.has('general')) {
    await pool.execute(
      `INSERT INTO chats (id, house_id, name, type, last_message, last_time)
       VALUES (:id, :houseId, 'Общий чат дома', 'general', 'Пока нет сообщений', '')`,
      { id: newId('c'), houseId },
    );
  }
  if (!types.has('uk')) {
    await pool.execute(
      `INSERT INTO chats (id, house_id, name, type, last_message, last_time)
       VALUES (:id, :houseId, 'Чат с УК', 'uk', 'Пока нет сообщений', '')`,
      { id: newId('c'), houseId },
    );
  }
}

export async function listChats(houseId) {
  await ensureHouseChats(houseId);
  const [rows] = await pool.execute(
    `SELECT * FROM chats WHERE house_id = :houseId ORDER BY
      FIELD(type, 'general', 'uk', 'topic'), created_at DESC`,
    { houseId },
  );
  return rows.map(serializeChat);
}

function serializeChat(c) {
  return {
    id: c.id,
    houseId: c.house_id,
    name: c.name,
    type: c.type,
    lastMessage: c.last_message || '',
    time: c.last_time || '',
    unread: 0,
    topicId: c.topic_id || undefined,
  };
}

export async function listMessages(chatId) {
  const [rows] = await pool.execute(
    `SELECT * FROM messages WHERE chat_id = :chatId ORDER BY created_at ASC LIMIT 200`,
    { chatId },
  );
  return rows.map((m) => ({
    id: m.id,
    chatId: m.chat_id,
    text: m.text,
    senderId: m.sender_user_id != null ? String(m.sender_user_id) : 'system',
    senderName: m.sender_name,
    time: m.time_label,
    hidden: Boolean(m.hidden),
    system: Boolean(m.is_system),
    photoLabel: m.photo_label || undefined,
    photoUrl: m.photo_url || undefined,
  }));
}

export async function addMessage({ chatId, user, text, hidden = false, system = false, photoLabel, photoUrl }) {
  const id = newId('m');
  const time = clock();
  await pool.execute(
    `INSERT INTO messages (id, chat_id, text, sender_user_id, sender_name, time_label, hidden, is_system, photo_label, photo_url)
     VALUES (:id, :chatId, :text, :senderId, :senderName, :time, :hidden, :system, :photoLabel, :photoUrl)`,
    {
      id,
      chatId,
      text,
      senderId: system ? null : user.id,
      senderName: system ? 'Модерация' : user.first_name || 'Пользователь',
      time,
      hidden: hidden ? 1 : 0,
      system: system ? 1 : 0,
      photoLabel: photoLabel || null,
      photoUrl: photoUrl || null,
    },
  );
  await pool.execute(
    `UPDATE chats SET last_message = :text, last_time = :time WHERE id = :chatId`,
    { text: hidden ? 'Сообщение скрыто модерацией' : text.slice(0, 500), time, chatId },
  );
  const [topics] = await pool.execute('SELECT id FROM topics WHERE chat_id = :chatId LIMIT 1', { chatId });
  if (topics.length && !hidden) {
    await pool.execute(
      'UPDATE topics SET comments_count = comments_count + 1 WHERE id = :id',
      { id: topics[0].id },
    );
  }
  return (await listMessages(chatId)).find((m) => m.id === id);
}

export async function listTopics(houseId) {
  const [rows] = await pool.execute(
    `SELECT * FROM topics WHERE house_id = :houseId ORDER BY created_at DESC`,
    { houseId },
  );
  return rows.map((t) => ({
    id: t.id,
    houseId: t.house_id,
    chatId: t.chat_id,
    category: t.category,
    title: t.title,
    description: t.description,
    authorId: String(t.author_user_id),
    author: t.author_name,
    comments: t.comments_count,
    time: t.time_label,
    photoLabel: t.photo_label || undefined,
    photoUrl: t.photo_url || undefined,
  }));
}

const TICKET_CATEGORIES = new Set(['accident', 'quality']);

export async function createTopic(user, input) {
  if (!user.house_id) throw Object.assign(new Error('Сначала выберите дом'), { status: 400 });

  const chatId = newId('c');
  const topicId = newId('t');
  const time = clock();
  const title = String(input.title || '').trim();
  const description = String(input.description || '').trim();

  await pool.execute(
    `INSERT INTO chats (id, house_id, name, type, topic_id, last_message, last_time)
     VALUES (:chatId, :houseId, :title, 'topic', :topicId, :description, :time)`,
    { chatId, houseId: user.house_id, title, topicId, description, time },
  );
  await pool.execute(
    `INSERT INTO topics (id, house_id, chat_id, category, title, description, author_user_id, author_name, comments_count, time_label, photo_label, photo_url)
     VALUES (:topicId, :houseId, :chatId, :category, :title, :description, :authorId, :authorName, 0, :time, :photoLabel, :photoUrl)`,
    {
      topicId,
      houseId: user.house_id,
      chatId,
      category: input.category,
      title,
      description,
      authorId: user.id,
      authorName: user.first_name || 'Житель',
      time,
      photoLabel: input.photoLabel || null,
      photoUrl: input.photoUrl || null,
    },
  );
  await addMessage({
    chatId,
    user,
    text: description,
    photoLabel: input.photoLabel,
    photoUrl: input.photoUrl,
  });

  let ticket = null;
  if (TICKET_CATEGORIES.has(input.category)) {
    ticket = await createWebTicket(user, {
      title,
      description,
      category: input.category,
    });
  }

  const topics = await listTopics(user.house_id);
  return { topic: topics.find((t) => t.id === topicId), chatId, ticket };
}

function mapWebCategoryToRequest(category) {
  if (category === 'accident') return { type: 'emergency', category: 'other' };
  return { type: 'regular', category: 'other' };
}

export async function createWebTicket(user, { title, description, category }) {
  const house = user.house_id ? await getHouse(user.house_id) : null;
  const addressText = house
    ? `${house.city}, ${house.address}`
    : user.registration_address || 'Адрес не указан';
  const mapped = mapWebCategoryToRequest(category);
  const request = await createRequest({
    userId: user.id,
    companyId: user.company_id || house?.company_id || null,
    type: mapped.type,
    category: mapped.category,
    addressText,
    description,
  });
  await pool.execute(
    `UPDATE requests SET house_id = :houseId, web_category = :webCategory, title = :title WHERE id = :id`,
    {
      houseId: user.house_id || null,
      webCategory: category,
      title: title || null,
      id: request.id,
    },
  );
  return serializeTicket(await getRequestById(request.id));
}

function serializeTicket(r) {
  const status = r.status === 'rejected' ? 'done' : r.status;
  return {
    id: String(r.id),
    publicNumber: r.public_number,
    houseId: r.house_id || undefined,
    title: r.title || r.description?.slice(0, 80) || r.public_number,
    description: r.description || '',
    category: r.web_category || r.category,
    status: status === 'in_progress' || status === 'new' || status === 'done' ? status : 'new',
    address: r.address_text,
    createdAt: r.created_at
      ? new Date(r.created_at).toLocaleString('ru-RU')
      : '',
    authorId: String(r.user_id),
    author: [r.resident_first_name || r.first_name, r.resident_last_name || r.last_name]
      .filter(Boolean)
      .join(' ') || 'Житель',
  };
}

export async function listTicketsForUser(user) {
  let rows;
  if (user.role === 'uk' || user.role === 'admin') {
    if (!user.company_id) return [];
    rows = await listCompanyRequests(user.company_id, 50);
  } else {
    rows = await listResidentRequests(user.id, 50);
  }
  return rows.map((r) => serializeTicket(r));
}

export async function setTicketStatus(user, ticketId, status) {
  if (user.role !== 'uk' && user.role !== 'admin') {
    throw Object.assign(new Error('Только УК'), { status: 403 });
  }
  const request = await getRequestById(Number(ticketId));
  if (!request || request.company_id !== user.company_id) {
    throw Object.assign(new Error('Заявка не найдена'), { status: 404 });
  }
  const allowed = ['new', 'in_progress', 'done', 'rejected'];
  if (!allowed.includes(status)) {
    throw Object.assign(new Error('Неверный статус'), { status: 400 });
  }
  const updated = await updateRequestStatus(request.id, status);
  return serializeTicket(updated);
}

export async function listWorks(houseId) {
  const [rows] = await pool.execute(
    `SELECT * FROM entrance_works WHERE house_id = :houseId ORDER BY entrance, id`,
    { houseId },
  );
  return rows.map((w) => ({
    id: w.id,
    houseId: w.house_id,
    entrance: w.entrance,
    floor: w.floor,
    title: w.title,
    detail: w.detail,
    status: w.status,
  }));
}

export async function setWorkStatus(user, workId, status) {
  if (user.role !== 'uk' && user.role !== 'admin') {
    throw Object.assign(new Error('Только УК'), { status: 403 });
  }
  const allowed = ['todo', 'in_progress', 'done'];
  if (!allowed.includes(status)) {
    throw Object.assign(new Error('Неверный статус'), { status: 400 });
  }
  await pool.execute('UPDATE entrance_works SET status = :status WHERE id = :id', {
    status,
    id: workId,
  });
  const [rows] = await pool.execute('SELECT * FROM entrance_works WHERE id = :id', { id: workId });
  const w = rows[0];
  if (!w) throw Object.assign(new Error('Не найдено'), { status: 404 });
  return {
    id: w.id,
    houseId: w.house_id,
    entrance: w.entrance,
    floor: w.floor,
    title: w.title,
    detail: w.detail,
    status: w.status,
  };
}

function serializeParking(row) {
  return {
    id: row.id,
    houseId: row.house_id,
    label: row.label,
    row: row.row_idx,
    col: row.col_idx,
    active: Boolean(row.active),
    occupied: Boolean(row.occupied),
    occupiedByUserId: row.occupied_by_user_id ? String(row.occupied_by_user_id) : null,
    occupiedAt: row.occupied_at
      ? new Date(row.occupied_at).toLocaleString('ru-RU')
      : null,
  };
}

export async function listParking(houseId) {
  const [rows] = await pool.execute(
    `SELECT * FROM parking_spots WHERE house_id = :houseId
     ORDER BY row_idx, col_idx, label`,
    { houseId },
  );
  return rows.map(serializeParking);
}

export async function claimParkingSpot(user, spotId) {
  const [rows] = await pool.execute('SELECT * FROM parking_spots WHERE id = :id LIMIT 1', {
    id: spotId,
  });
  const spot = rows[0];
  if (!spot) throw Object.assign(new Error('Место не найдено'), { status: 404 });
  if (user.house_id && spot.house_id !== user.house_id) {
    throw Object.assign(new Error('Чужой дом'), { status: 403 });
  }
  if (!spot.active) throw Object.assign(new Error('Место отключено УК'), { status: 400 });
  if (spot.occupied) throw Object.assign(new Error('Место занято'), { status: 409 });

  // освободить предыдущее место жителя
  await pool.execute(
    `UPDATE parking_spots
     SET occupied = 0, occupied_by_user_id = NULL, occupied_at = NULL
     WHERE occupied_by_user_id = :uid`,
    { uid: user.id },
  );
  await pool.execute(
    `UPDATE parking_spots
     SET occupied = 1, occupied_by_user_id = :uid, occupied_at = NOW()
     WHERE id = :id AND occupied = 0 AND active = 1`,
    { uid: user.id, id: spotId },
  );
  const [fresh] = await pool.execute('SELECT * FROM parking_spots WHERE id = :id', { id: spotId });
  if (!fresh[0]?.occupied) {
    throw Object.assign(new Error('Не удалось занять место'), { status: 409 });
  }
  return listParking(spot.house_id);
}

export async function releaseParkingSpot(user, spotId) {
  const [rows] = await pool.execute('SELECT * FROM parking_spots WHERE id = :id LIMIT 1', {
    id: spotId,
  });
  const spot = rows[0];
  if (!spot) throw Object.assign(new Error('Место не найдено'), { status: 404 });
  const isOwner = Number(spot.occupied_by_user_id) === Number(user.id);
  const isUk = user.role === 'uk' || user.role === 'admin';
  if (!isOwner && !isUk) {
    throw Object.assign(new Error('Нельзя освободить чужое место'), { status: 403 });
  }
  await pool.execute(
    `UPDATE parking_spots
     SET occupied = 0, occupied_by_user_id = NULL, occupied_at = NULL
     WHERE id = :id`,
    { id: spotId },
  );
  return listParking(spot.house_id);
}

export async function setParkingActive(user, spotId, active) {
  if (user.role !== 'uk' && user.role !== 'admin') {
    throw Object.assign(new Error('Только УК'), { status: 403 });
  }
  const [rows] = await pool.execute('SELECT * FROM parking_spots WHERE id = :id LIMIT 1', {
    id: spotId,
  });
  const spot = rows[0];
  if (!spot) throw Object.assign(new Error('Место не найдено'), { status: 404 });
  await pool.execute(
    `UPDATE parking_spots SET active = :active
     ${active ? '' : ', occupied = 0, occupied_by_user_id = NULL, occupied_at = NULL'}
     WHERE id = :id`,
    { active: active ? 1 : 0, id: spotId },
  );
  return listParking(spot.house_id);
}

export async function appealParkingSpot(user, spotId) {
  const [rows] = await pool.execute('SELECT * FROM parking_spots WHERE id = :id LIMIT 1', {
    id: spotId,
  });
  const spot = rows[0];
  if (!spot) throw Object.assign(new Error('Место не найдено'), { status: 404 });
  if (!spot.occupied && spot.active) {
    throw Object.assign(new Error('Место свободно — обжалование не нужно'), { status: 400 });
  }
  const ticket = await createWebTicket(user, {
    title: `Обжалование парковки ${spot.label}`,
    description: `Житель сообщает, что место ${spot.label} отмечено занятым/недоступным ошибочно. Просьба проверить и освободить при необходимости.`,
    category: 'parking',
  });
  return { ticket, parking: await listParking(spot.house_id) };
}

export async function bootstrapForUser(user) {
  user = await ensureUserHouseFromCompany(user);
  const houses = await listHouses();
  const companies = await listApprovedCompanies();
  let chats = [];
  let messages = [];
  let topics = [];
  let works = [];
  let parking = [];
  if (user.house_id) {
    chats = await listChats(user.house_id);
    topics = await listTopics(user.house_id);
    works = await listWorks(user.house_id);
    parking = await listParking(user.house_id);
    const messageLists = await Promise.all(chats.map((c) => listMessages(c.id)));
    messages = messageLists.flat();
  }
  const tickets = await listTicketsForUser(user);
  return {
    user: serializeUserFixed(user),
    houses,
    companies,
    chats,
    messages,
    topics,
    tickets,
    works,
    parking,
  };
}
