import mysql from 'mysql2/promise';
import { config } from './config.js';
import { formatCityDisplay, toCitySlug } from './cities.js';

export const pool = mysql.createPool({
  host: config.mysql.host,
  port: config.mysql.port,
  user: config.mysql.user,
  password: config.mysql.password,
  database: config.mysql.database,
  waitForConnections: true,
  connectionLimit: 10,
  namedPlaceholders: true,
});

async function columnExists(table, column) {
  const [rows] = await pool.execute(
    `SELECT COUNT(*) AS cnt
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = :table
       AND COLUMN_NAME = :column`,
    { table, column },
  );
  return Number(rows[0]?.cnt) > 0;
}

async function tableExists(table) {
  const [rows] = await pool.execute(
    `SELECT COUNT(*) AS cnt
     FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = :table`,
    { table },
  );
  return Number(rows[0]?.cnt) > 0;
}

/** Мягкая миграция для уже существующего Docker volume */
export async function ensureSchema() {
  if (!(await tableExists('cities'))) {
    await pool.execute(`
      CREATE TABLE cities (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        slug VARCHAR(128) NOT NULL,
        display_name VARCHAR(255) NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_cities_slug (slug)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  const userColumns = [
    ['phone', 'VARCHAR(32) NULL'],
    ['city_slug', 'VARCHAR(128) NULL'],
    ['pending_city_slug', 'VARCHAR(128) NULL'],
    ['pending_city_display', 'VARCHAR(255) NULL'],
    ['flow_step', 'VARCHAR(64) NULL'],
    ['flow_json', 'TEXT NULL'],
  ];
  for (const [name, def] of userColumns) {
    if (!(await columnExists('users', name))) {
      await pool.execute(`ALTER TABLE users ADD COLUMN ${name} ${def}`);
    }
  }

  if (!(await columnExists('management_companies', 'city_slug'))) {
    await pool.execute(
      'ALTER TABLE management_companies ADD COLUMN city_slug VARCHAR(128) NULL',
    );
  }
  if (!(await columnExists('management_companies', 'phone'))) {
    await pool.execute(
      'ALTER TABLE management_companies ADD COLUMN phone VARCHAR(32) NULL',
    );
  }
  if (!(await columnExists('management_companies', 'email'))) {
    await pool.execute(
      'ALTER TABLE management_companies ADD COLUMN email VARCHAR(255) NULL',
    );
  }

  await seedDefaultCities();

  const { ensureTicketsSchema } = await import('./tickets-db.js');
  await ensureTicketsSchema();
  await ensureResidentJoinSchema();

  const { ensureWebSchema } = await import('./web-db.js');
  await ensureWebSchema();

  const { ensureAdminSchema } = await import('./admin-db.js');
  await ensureAdminSchema();

  // На текущем этапе хакатона: без ручных одобрений
  await autoApproveAllPendingAccess();
}

async function ensureResidentJoinSchema() {
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS resident_uk_requests (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      user_id BIGINT UNSIGNED NOT NULL,
      company_id BIGINT UNSIGNED NOT NULL,
      status ENUM('pending', 'approved', 'rejected', 'cancelled') NOT NULL DEFAULT 'pending',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_rur_user (user_id),
      KEY idx_rur_company (company_id),
      KEY idx_rur_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

async function seedDefaultCities() {
  const cities = [
    ['москва', 'Москва'],
    ['санкт_петербург', 'Санкт-Петербург'],
    ['набережные_челны', 'Набережные Челны'],
    ['казань', 'Казань'],
    ['новосибирск', 'Новосибирск'],
    ['екатеринбург', 'Екатеринбург'],
    ['нижний_новгород', 'Нижний Новгород'],
    ['самара', 'Самара'],
    ['омск', 'Омск'],
    ['ростов_на_дону', 'Ростов-на-Дону'],
    ['уфа', 'Уфа'],
    ['красноярск', 'Красноярск'],
    ['воронеж', 'Воронеж'],
    ['пермь', 'Пермь'],
    ['волгоград', 'Волгоград'],
    ['краснодар', 'Краснодар'],
    ['саратов', 'Саратов'],
    ['тюмень', 'Тюмень'],
    ['тольятти', 'Тольятти'],
    ['ижевск', 'Ижевск'],
    ['барнаул', 'Барнаул'],
    ['ульяновск', 'Ульяновск'],
    ['иркутск', 'Иркутск'],
    ['хабаровск', 'Хабаровск'],
    ['ярославль', 'Ярославль'],
    ['владивосток', 'Владивосток'],
    ['махачкала', 'Махачкала'],
    ['томск', 'Томск'],
    ['оренбург', 'Оренбург'],
    ['кемерово', 'Кемерово'],
    ['новокузнецк', 'Новокузнецк'],
    ['рязань', 'Рязань'],
    ['астрахань', 'Астрахань'],
    ['пенза', 'Пенза'],
    ['липецк', 'Липецк'],
    ['киров', 'Киров'],
    ['чебоксары', 'Чебоксары'],
    ['калининград', 'Калининград'],
    ['тула', 'Тула'],
    ['курск', 'Курск'],
    ['сочи', 'Сочи'],
    ['ставрополь', 'Ставрополь'],
    ['тверь', 'Тверь'],
    ['магнитогорск', 'Магнитогорск'],
    ['иваново', 'Иваново'],
    ['брянск', 'Брянск'],
    ['белгород', 'Белгород'],
    ['сургут', 'Сургут'],
    ['владимир', 'Владимир'],
    ['архангельск', 'Архангельск'],
    ['калуга', 'Калуга'],
    ['смоленск', 'Смоленск'],
    ['чита', 'Чита'],
    ['саранск', 'Саранск'],
    ['вологда', 'Вологда'],
    ['якутск', 'Якутск'],
    ['грозный', 'Грозный'],
    ['таганрог', 'Таганрог'],
    ['стерлитамак', 'Стерлитамак'],
    ['кострома', 'Кострома'],
    ['петрозаводск', 'Петрозаводск'],
    ['нижнекамск', 'Нижнекамск'],
    ['йошкар_ола', 'Йошкар-Ола'],
    ['новороссийск', 'Новороссийск'],
    ['химки', 'Химки'],
    ['балашиха', 'Балашиха'],
    ['подольск', 'Подольск'],
    ['мытищи', 'Мытищи'],
    ['королев', 'Королёв'],
    ['люберцы', 'Люберцы'],
  ];

  for (const [slug, displayName] of cities) {
    await pool.execute(
      `INSERT INTO cities (slug, display_name) VALUES (:slug, :displayName)
       ON DUPLICATE KEY UPDATE display_name = VALUES(display_name)`,
      { slug, displayName },
    );
  }
}

export async function pingDb() {
  const connection = await pool.getConnection();
  try {
    await connection.ping();
  } finally {
    connection.release();
  }
}

export async function findUserByMaxId(maxUserId) {
  const [rows] = await pool.execute(
    'SELECT * FROM users WHERE max_user_id = :maxUserId LIMIT 1',
    { maxUserId },
  );
  return rows[0] || null;
}

export async function createUser({ maxUserId, username, firstName, lastName, isAdmin }) {
  const [result] = await pool.execute(
    `INSERT INTO users (
      max_user_id, username, first_name, last_name, role, onboarding_step
    ) VALUES (
      :maxUserId, :username, :firstName, :lastName, :role, :step
    )`,
    {
      maxUserId,
      username: username || null,
      firstName: firstName || null,
      lastName: lastName || null,
      role: isAdmin ? 'admin' : null,
      step: isAdmin ? 'done' : 'welcome',
    },
  );

  if (isAdmin) {
    await pool.execute(
      `INSERT INTO notification_settings (user_id) VALUES (:userId)
       ON DUPLICATE KEY UPDATE user_id = user_id`,
      { userId: result.insertId },
    );
  }

  return findUserByMaxId(maxUserId);
}

export async function ensureUser(ctxUser) {
  const existing = await findUserByMaxId(ctxUser.user_id);
  if (existing) {
    const isAdmin = config.adminUserIds.includes(ctxUser.user_id);
    if (isAdmin && existing.role !== 'admin') {
      await pool.execute(
        `UPDATE users
         SET role = 'admin', onboarding_step = 'done', consent_accepted = 1,
             consent_accepted_at = COALESCE(consent_accepted_at, NOW())
         WHERE id = :id`,
        { id: existing.id },
      );
      return findUserByMaxId(ctxUser.user_id);
    }
    return existing;
  }

  try {
    return await createUser({
      maxUserId: ctxUser.user_id,
      username: ctxUser.username,
      firstName: ctxUser.first_name,
      lastName: ctxUser.last_name,
      isAdmin: config.adminUserIds.includes(ctxUser.user_id),
    });
  } catch (error) {
    if (error?.code === 'ER_DUP_ENTRY') {
      return findUserByMaxId(ctxUser.user_id);
    }
    throw error;
  }
}

export async function updateUser(userId, fields) {
  const allowed = [
    'role',
    'consent_accepted',
    'consent_accepted_at',
    'onboarding_step',
    'full_name',
    'phone',
    'personal_account',
    'city_slug',
    'pending_city_slug',
    'pending_city_display',
    'flow_step',
    'flow_json',
    'registration_address',
    'company_id',
    'uk_status',
    'username',
    'first_name',
    'last_name',
    'password_hash',
    'house_id',
    'street',
    'entrance',
    'flat',
    'skipped_address',
    'uk_name',
    'is_blocked',
  ];

  const entries = Object.entries(fields).filter(([key]) => allowed.includes(key));
  if (!entries.length) return;

  const sets = entries.map(([key]) => `${key} = :${key}`).join(', ');
  const params = Object.fromEntries(entries);
  params.id = userId;

  await pool.execute(`UPDATE users SET ${sets} WHERE id = :id`, params);
}

export async function acceptConsent(userId) {
  await pool.execute(
    `UPDATE users
     SET consent_accepted = 1,
         consent_accepted_at = NOW(),
         onboarding_step = 'role'
     WHERE id = :userId`,
    { userId },
  );
}

export async function setRoleResident(userId) {
  await updateUser(userId, {
    role: 'resident',
    uk_status: 'none',
    onboarding_step: 'city',
  });
}

export async function setRoleUk(userId) {
  await updateUser(userId, {
    role: 'uk',
    uk_status: 'pending',
    onboarding_step: 'city',
  });
}

export async function listCities() {
  const [rows] = await pool.execute(
    'SELECT slug, display_name FROM cities ORDER BY display_name ASC',
  );
  return rows;
}

export async function upsertCity(slug, displayName) {
  const normalized = toCitySlug(slug);
  const name = displayName || formatCityDisplay(normalized);
  await pool.execute(
    `INSERT INTO cities (slug, display_name) VALUES (:slug, :displayName)
     ON DUPLICATE KEY UPDATE display_name = VALUES(display_name)`,
    { slug: normalized, displayName: name },
  );
  return { slug: normalized, display_name: name };
}

export async function setPendingCity(userId, slug, displayName) {
  await updateUser(userId, {
    pending_city_slug: slug,
    pending_city_display: displayName,
    onboarding_step: 'city_confirm',
  });
}

export async function clearPendingCity(userId, nextStep = 'city') {
  await updateUser(userId, {
    pending_city_slug: null,
    pending_city_display: null,
    onboarding_step: nextStep,
  });
}

export async function confirmCityForResident(userId, slug) {
  await updateUser(userId, {
    city_slug: slug,
    pending_city_slug: null,
    pending_city_display: null,
    onboarding_step: 'phone',
  });
}

export async function confirmCityForUk(userId, slug) {
  await updateUser(userId, {
    city_slug: slug,
    pending_city_slug: null,
    pending_city_display: null,
    onboarding_step: 'uk_name',
  });
}

export async function saveResidentPhone(userId, phone) {
  await updateUser(userId, {
    phone,
    onboarding_step: 'personal_account',
  });
}

export async function saveResidentPersonalAccount(userId, personalAccount) {
  await updateUser(userId, {
    personal_account: personalAccount,
    onboarding_step: 'address',
  });
}

export async function saveResidentAddress(userId, addressText) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute(
      `UPDATE users
       SET registration_address = :addressText, onboarding_step = 'uk_search'
       WHERE id = :userId`,
      { userId, addressText },
    );
    await connection.execute(
      'UPDATE addresses SET is_primary = 0 WHERE user_id = :userId',
      { userId },
    );
    await connection.execute(
      `INSERT INTO addresses (user_id, address_text, is_primary)
       VALUES (:userId, :addressText, 1)`,
      { userId, addressText },
    );
    await connection.execute(
      `INSERT INTO notification_settings (user_id) VALUES (:userId)
       ON DUPLICATE KEY UPDATE user_id = user_id`,
      { userId },
    );
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/** Поиск УК в городе по фрагменту названия (для 100+/1000+ компаний) */
export async function searchCompaniesInCity(citySlug, query, limit = 8) {
  const q = String(query || '').trim().replace(/[%_\\]/g, '');
  if (!citySlug || q.length < 2) {
    return { total: 0, items: [] };
  }

  const like = `%${q}%`;

  const [countRows] = await pool.execute(
    `SELECT COUNT(*) AS total
     FROM management_companies
     WHERE city_slug = :citySlug
       AND status = 'approved'
       AND name LIKE :like`,
    { citySlug, like },
  );

  const safeLimit = Math.min(Math.max(Number(limit) || 8, 1), 20);
  const [items] = await pool.execute(
    `SELECT id, name, city_slug, phone, email, address, status
     FROM management_companies
     WHERE city_slug = :citySlug
       AND status = 'approved'
       AND name LIKE :like
     ORDER BY name ASC
     LIMIT ${safeLimit}`,
    { citySlug, like },
  );

  return { total: Number(countRows[0]?.total || 0), items };
}

export async function countCompaniesInCity(citySlug) {
  if (!citySlug) return 0;
  const [rows] = await pool.execute(
    `SELECT COUNT(*) AS total
     FROM management_companies
     WHERE city_slug = :citySlug
       AND status IN ('approved', 'pending')`,
    { citySlug },
  );
  return Number(rows[0]?.total || 0);
}

export async function bindResidentCompany(userId, companyId) {
  await updateUser(userId, {
    company_id: companyId,
    onboarding_step: 'done',
  });
}

export async function unlinkResidentCompany(userId) {
  await pool.execute(
    `UPDATE resident_uk_requests
     SET status = 'cancelled'
     WHERE user_id = :userId AND status = 'pending'`,
    { userId },
  );
  await updateUser(userId, {
    company_id: null,
  });
}

export async function createResidentUkRequest(userId, companyId) {
  await pool.execute(
    `UPDATE resident_uk_requests
     SET status = 'cancelled'
     WHERE user_id = :userId AND status = 'pending'`,
    { userId },
  );

  // Отвязать текущую УК, пока ждём новую
  await updateUser(userId, {
    company_id: null,
    onboarding_step: 'done',
  });

  const [result] = await pool.execute(
    `INSERT INTO resident_uk_requests (user_id, company_id, status)
     VALUES (:userId, :companyId, 'pending')`,
    { userId, companyId },
  );
  return getResidentUkRequestById(result.insertId);
}

/** Сразу подключить жителя к УК (без ожидания одобрения руководителя). */
export async function joinResidentToCompany(userId, companyId) {
  await pool.execute(
    `UPDATE resident_uk_requests
     SET status = 'cancelled'
     WHERE user_id = :userId AND status = 'pending'`,
    { userId },
  );

  const [result] = await pool.execute(
    `INSERT INTO resident_uk_requests (user_id, company_id, status)
     VALUES (:userId, :companyId, 'approved')`,
    { userId, companyId },
  );

  await updateUser(userId, {
    company_id: companyId,
    onboarding_step: 'done',
    flow_step: null,
    flow_json: null,
  });

  return getResidentUkRequestById(result.insertId);
}

/** Жители + сотрудники, привязанные к УК (для кабинета руководителя). */
export async function listCompanyUsers(companyId) {
  const [rows] = await pool.execute(
    `SELECT u.id, u.max_user_id, u.username, u.first_name, u.last_name, u.phone,
            u.role, u.city_slug, u.registration_address, u.personal_account,
            u.street, u.entrance, u.flat, u.created_at
     FROM users u
     WHERE u.company_id = :companyId
     ORDER BY
       CASE u.role WHEN 'uk' THEN 0 ELSE 1 END,
       u.first_name ASC, u.last_name ASC`,
    { companyId },
  );
  return rows;
}

/** Принудительно активировать УК пользователя (хакатон: без админ-одобрения). */
export async function activateUkCompany(userId, companyId) {
  if (!companyId) return;
  await pool.execute(
    `UPDATE management_companies SET status = 'approved' WHERE id = :id`,
    { id: companyId },
  );
  await updateUser(userId, { uk_status: 'approved', onboarding_step: 'done' });
}

/** Одноразово / при старте: одобрить всё, что висело в pending. */
export async function autoApproveAllPendingAccess() {
  await pool.execute(
    `UPDATE management_companies SET status = 'approved' WHERE status = 'pending'`,
  );
  await pool.execute(
    `UPDATE users SET uk_status = 'approved' WHERE role = 'uk' AND uk_status = 'pending'`,
  );

  const [pendingJoins] = await pool.execute(
    `SELECT id, user_id, company_id FROM resident_uk_requests WHERE status = 'pending'`,
  );
  for (const row of pendingJoins) {
    await pool.execute(
      `UPDATE resident_uk_requests SET status = 'approved' WHERE id = :id`,
      { id: row.id },
    );
    await updateUser(row.user_id, {
      company_id: row.company_id,
      onboarding_step: 'done',
    });
  }
}

export async function getResidentUkRequestById(id) {
  const [rows] = await pool.execute(
    `SELECT r.*,
            u.max_user_id, u.first_name, u.last_name, u.username, u.phone,
            u.city_slug, u.registration_address, u.personal_account,
            mc.name AS company_name, mc.city_slug AS company_city
     FROM resident_uk_requests r
     JOIN users u ON u.id = r.user_id
     JOIN management_companies mc ON mc.id = r.company_id
     WHERE r.id = :id
     LIMIT 1`,
    { id },
  );
  return rows[0] || null;
}

export async function getPendingResidentUkRequest(userId) {
  const [rows] = await pool.execute(
    `SELECT r.*, mc.name AS company_name
     FROM resident_uk_requests r
     JOIN management_companies mc ON mc.id = r.company_id
     WHERE r.user_id = :userId AND r.status = 'pending'
     ORDER BY r.created_at DESC
     LIMIT 1`,
    { userId },
  );
  return rows[0] || null;
}

export async function listPendingResidentUkRequests(companyId) {
  const [rows] = await pool.execute(
    `SELECT r.*,
            u.max_user_id, u.first_name, u.last_name, u.username, u.phone,
            u.city_slug, u.registration_address, u.personal_account
     FROM resident_uk_requests r
     JOIN users u ON u.id = r.user_id
     WHERE r.company_id = :companyId AND r.status = 'pending'
     ORDER BY r.created_at ASC`,
    { companyId },
  );
  return rows;
}

export async function decideResidentUkRequest(requestId, status, companyId) {
  const item = await getResidentUkRequestById(requestId);
  if (!item || item.company_id !== companyId || item.status !== 'pending') {
    return null;
  }

  await pool.execute(
    `UPDATE resident_uk_requests SET status = :status WHERE id = :requestId`,
    { status, requestId },
  );

  if (status === 'approved') {
    await updateUser(item.user_id, { company_id: companyId });
  }

  return getResidentUkRequestById(requestId);
}

export async function cancelPendingResidentUkRequest(userId) {
  await pool.execute(
    `UPDATE resident_uk_requests
     SET status = 'cancelled'
     WHERE user_id = :userId AND status = 'pending'`,
    { userId },
  );
}

export async function skipResidentUkSearch(userId) {
  await updateUser(userId, {
    onboarding_step: 'done',
    flow_step: null,
    flow_json: null,
  });
}

export async function startResidentUkSearch(userId, { duringOnboarding = false } = {}) {
  if (duringOnboarding) {
    await updateUser(userId, { onboarding_step: 'uk_search' });
    return;
  }
  await updateUser(userId, { flow_step: 'uk_search' });
}

export async function listUkManagerMaxIds(companyId) {
  const [rows] = await pool.execute(
    `SELECT max_user_id FROM users
     WHERE company_id = :companyId
       AND role = 'uk'
       AND uk_status = 'approved'`,
    { companyId },
  );
  return rows.map((r) => r.max_user_id).filter(Boolean);
}

export async function saveResidentAddressOnly(userId, addressText) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute(
      `UPDATE users SET registration_address = :addressText WHERE id = :userId`,
      { userId, addressText },
    );
    await connection.execute(
      'UPDATE addresses SET is_primary = 0 WHERE user_id = :userId',
      { userId },
    );
    await connection.execute(
      `INSERT INTO addresses (user_id, address_text, is_primary)
       VALUES (:userId, :addressText, 1)`,
      { userId, addressText },
    );
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function changeResidentCity(userId, citySlug) {
  await unlinkResidentCompany(userId);
  await updateUser(userId, {
    city_slug: citySlug,
    pending_city_slug: null,
    pending_city_display: null,
  });
}


export async function saveUkName(userId, name) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [users] = await connection.execute(
      'SELECT city_slug FROM users WHERE id = :userId LIMIT 1',
      { userId },
    );
    const citySlug = users[0]?.city_slug || null;

    const [result] = await connection.execute(
      `INSERT INTO management_companies (name, city_slug, status, requested_by_user_id)
       VALUES (:name, :citySlug, 'pending', :userId)`,
      { name, citySlug, userId },
    );

    await connection.execute(
      `UPDATE users
       SET company_id = :companyId, onboarding_step = 'uk_phone', uk_status = 'pending'
       WHERE id = :userId`,
      { companyId: result.insertId, userId },
    );

    await connection.commit();
    return result.insertId;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function saveUkPhone(userId, companyId, phone) {
  await pool.execute(
    'UPDATE management_companies SET phone = :phone WHERE id = :companyId',
    { phone, companyId },
  );
  await updateUser(userId, { onboarding_step: 'uk_email' });
}

export async function saveUkEmail(userId, companyId, email) {
  await pool.execute(
    'UPDATE management_companies SET email = :email WHERE id = :companyId',
    { email, companyId },
  );
  await updateUser(userId, { onboarding_step: 'uk_address' });
}

export async function saveUkAddress(userId, companyId, address) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute(
      `UPDATE management_companies
       SET address = :address, status = 'approved'
       WHERE id = :companyId`,
      { address, companyId },
    );
    await connection.execute(
      `UPDATE users
       SET onboarding_step = 'done', uk_status = 'approved'
       WHERE id = :userId`,
      { userId },
    );
    await connection.execute(
      `INSERT INTO notification_settings (user_id) VALUES (:userId)
       ON DUPLICATE KEY UPDATE user_id = user_id`,
      { userId },
    );
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function getCompanyById(companyId) {
  if (!companyId) return null;
  const [rows] = await pool.execute(
    'SELECT * FROM management_companies WHERE id = :companyId LIMIT 1',
    { companyId },
  );
  return rows[0] || null;
}

export async function getCompanyWithManager(companyId) {
  const [rows] = await pool.execute(
    `SELECT
       mc.*,
       u.id AS manager_user_id,
       u.max_user_id AS manager_max_user_id,
       u.username AS manager_username,
       u.first_name AS manager_first_name,
       u.last_name AS manager_last_name,
       u.phone AS manager_phone,
       u.city_slug AS manager_city_slug,
       u.created_at AS manager_created_at
     FROM management_companies mc
     LEFT JOIN users u ON u.id = mc.requested_by_user_id
     WHERE mc.id = :companyId
     LIMIT 1`,
    { companyId },
  );
  return rows[0] || null;
}

export async function listPendingUkRequests() {
  const [rows] = await pool.execute(
    `SELECT
       mc.*,
       u.max_user_id,
       u.first_name,
       u.last_name,
       u.username,
       u.phone AS manager_phone
     FROM management_companies mc
     LEFT JOIN users u ON u.id = mc.requested_by_user_id
     WHERE mc.status = 'pending'
     ORDER BY mc.created_at ASC`,
  );
  return rows;
}

export async function setUkRequestStatus(companyId, status, adminUserId) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    await connection.execute(
      `UPDATE management_companies
       SET status = :status, approved_by_user_id = :adminUserId
       WHERE id = :companyId`,
      { status, adminUserId, companyId },
    );

    const ukStatus = status === 'approved' ? 'approved' : 'rejected';
    await connection.execute(
      `UPDATE users
       SET uk_status = :ukStatus
       WHERE company_id = :companyId AND role = 'uk'`,
      { ukStatus, companyId },
    );

    await connection.commit();

    const [rows] = await connection.execute(
      `SELECT u.max_user_id, mc.name
       FROM users u
       JOIN management_companies mc ON mc.id = u.company_id
       WHERE u.company_id = :companyId AND u.role = 'uk'
       LIMIT 1`,
      { companyId },
    );
    return rows[0] || null;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function getPrimaryAddress(userId) {
  const [rows] = await pool.execute(
    `SELECT * FROM addresses
     WHERE user_id = :userId
     ORDER BY is_primary DESC, id DESC
     LIMIT 1`,
    { userId },
  );
  return rows[0] || null;
}
