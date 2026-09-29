import { pool, updateUser, getPrimaryAddress } from './db.js';
import { categoryTitle, typeTitle, REQUEST_STATUS } from './catalog.js';

export async function ensureTicketsSchema() {
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS requests (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      public_number VARCHAR(32) NOT NULL,
      user_id BIGINT UNSIGNED NOT NULL,
      company_id BIGINT UNSIGNED NULL,
      type ENUM('emergency', 'regular') NOT NULL,
      category VARCHAR(128) NOT NULL,
      address_text VARCHAR(512) NOT NULL,
      description TEXT NULL,
      photo_token VARCHAR(512) NULL,
      status ENUM('new', 'in_progress', 'done', 'rejected') NOT NULL DEFAULT 'new',
      uk_comment TEXT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_requests_public_number (public_number),
      KEY idx_requests_user (user_id),
      KEY idx_requests_company (company_id),
      KEY idx_requests_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS announcements (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      company_id BIGINT UNSIGNED NOT NULL,
      author_user_id BIGINT UNSIGNED NULL,
      title VARCHAR(255) NULL,
      body TEXT NOT NULL,
      recipients_count INT NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_announcements_company (company_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS request_messages (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      request_id BIGINT UNSIGNED NOT NULL,
      author_user_id BIGINT UNSIGNED NULL,
      author_role ENUM('uk', 'resident') NOT NULL,
      body TEXT NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_rm_request (request_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

export async function getFlow(user) {
  if (!user.flow_json) return {};
  try {
    return JSON.parse(user.flow_json);
  } catch {
    return {};
  }
}

export async function setFlow(userId, flowStep, payload = {}) {
  await updateUser(userId, {
    flow_step: flowStep,
    flow_json: JSON.stringify(payload),
  });
}

export async function clearFlow(userId) {
  await updateUser(userId, {
    flow_step: null,
    flow_json: null,
  });
}

function makePublicNumber() {
  const stamp = Date.now().toString(36).toUpperCase();
  const rnd = Math.floor(Math.random() * 900 + 100);
  return `ND-${stamp}-${rnd}`;
}

export async function createRequest({
  userId,
  companyId,
  type,
  category,
  addressText,
  description,
}) {
  const publicNumber = makePublicNumber();
  const [result] = await pool.execute(
    `INSERT INTO requests (
      public_number, user_id, company_id, type, category, address_text, description, status
    ) VALUES (
      :publicNumber, :userId, :companyId, :type, :category, :addressText, :description, 'new'
    )`,
    {
      publicNumber,
      userId,
      companyId: companyId || null,
      type,
      category,
      addressText,
      description: description || null,
    },
  );
  return getRequestById(result.insertId);
}

export async function getRequestById(id) {
  const [rows] = await pool.execute(
    `SELECT r.*,
            u.max_user_id AS resident_max_user_id,
            u.first_name AS resident_first_name,
            u.last_name AS resident_last_name,
            u.phone AS resident_phone,
            u.username AS resident_username,
            mc.name AS company_name
     FROM requests r
     JOIN users u ON u.id = r.user_id
     LEFT JOIN management_companies mc ON mc.id = r.company_id
     WHERE r.id = :id
     LIMIT 1`,
    { id },
  );
  return rows[0] || null;
}

export async function listResidentRequests(userId, limit = 10) {
  const safeLimit = Math.min(Math.max(Number(limit) || 10, 1), 30);
  const [rows] = await pool.execute(
    `SELECT * FROM requests
     WHERE user_id = :userId
     ORDER BY created_at DESC
     LIMIT ${safeLimit}`,
    { userId },
  );
  return rows;
}

export async function listCompanyRequests(companyId, limit = 15) {
  const safeLimit = Math.min(Math.max(Number(limit) || 15, 1), 40);
  const [rows] = await pool.execute(
    `SELECT r.*,
            u.first_name, u.last_name, u.phone, u.max_user_id
     FROM requests r
     JOIN users u ON u.id = r.user_id
     WHERE r.company_id = :companyId
     ORDER BY
       CASE r.status
         WHEN 'new' THEN 0
         WHEN 'in_progress' THEN 1
         ELSE 2
       END,
       r.created_at DESC
     LIMIT ${safeLimit}`,
    { companyId },
  );
  return rows;
}

export async function updateRequestStatus(requestId, status, ukComment = null) {
  await pool.execute(
    `UPDATE requests
     SET status = :status,
         uk_comment = COALESCE(:ukComment, uk_comment)
     WHERE id = :requestId`,
    { status, ukComment, requestId },
  );
  return getRequestById(requestId);
}

export async function setRequestComment(requestId, ukComment) {
  await pool.execute(
    'UPDATE requests SET uk_comment = :ukComment WHERE id = :requestId',
    { ukComment, requestId },
  );
  return getRequestById(requestId);
}

export async function addRequestMessage({ requestId, authorUserId, authorRole, body }) {
  await pool.execute(
    `INSERT INTO request_messages (request_id, author_user_id, author_role, body)
     VALUES (:requestId, :authorUserId, :authorRole, :body)`,
    { requestId, authorUserId, authorRole, body },
  );
  if (authorRole === 'uk') {
    await pool.execute(
      'UPDATE requests SET uk_comment = :body WHERE id = :requestId',
      { body, requestId },
    );
  }
  return listRequestMessages(requestId);
}

export async function listRequestMessages(requestId, limit = 20) {
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 50);
  const [rows] = await pool.execute(
    `SELECT * FROM request_messages
     WHERE request_id = :requestId
     ORDER BY created_at ASC
     LIMIT ${safeLimit}`,
    { requestId },
  );
  return rows;
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function formatRequestCard(request, { forUk = false } = {}) {
  const residentName = [request.resident_first_name || request.first_name, request.resident_last_name || request.last_name]
    .filter(Boolean)
    .join(' ') || 'житель';
  const lines = [
    `${request.type === 'emergency' ? '🚨' : '📝'} *${typeTitle(request.type)} №${request.public_number}*`,
    `*Категория:* ${categoryTitle(request.type, request.category)}`,
    `*Статус:* ${REQUEST_STATUS[request.status] || request.status}`,
    `*Адрес:* ${request.address_text}`,
    `*Описание:* ${request.description || '—'}`,
  ];
  if (forUk) {
    lines.push(`*Житель:* ${residentName}`);
    if (request.phone || request.resident_phone) {
      lines.push(`*Телефон:* ${request.phone || request.resident_phone}`);
    }
  }
  if (request.uk_comment) {
    lines.push(`*Комментарий УК:* ${request.uk_comment}`);
  }
  return lines.join('\n');
}

/** HTML-карточка для УК со ссылкой на профиль жильца */
export function formatRequestCardHtml(request, messages = []) {
  const residentName = [request.resident_first_name || request.first_name, request.resident_last_name || request.last_name]
    .filter(Boolean)
    .join(' ') || 'Житель';
  const maxId = request.resident_max_user_id || request.max_user_id;
  const username = request.resident_username || request.username;
  const uname = username ? String(username).replace(/^@/, '').trim() : '';
  const profileUrl = uname ? `https://max.ru/${encodeURIComponent(uname)}` : (maxId ? `https://max.ru/id${maxId}` : null);
  const profile = profileUrl
    ? `<a href="${escapeHtml(profileUrl)}">${escapeHtml(residentName)}</a>`
    : escapeHtml(residentName);

  let html = `${request.type === 'emergency' ? '🚨' : '📝'} <b>${escapeHtml(typeTitle(request.type))} №${escapeHtml(request.public_number)}</b>\n`
    + `<b>Категория:</b> ${escapeHtml(categoryTitle(request.type, request.category))}\n`
    + `<b>Статус:</b> ${escapeHtml(REQUEST_STATUS[request.status] || request.status)}\n`
    + `<b>Адрес:</b> ${escapeHtml(request.address_text)}\n`
    + `<b>Описание:</b> ${escapeHtml(request.description || '—')}\n`
    + `<b>Житель:</b> ${profile}`;

  if (request.phone || request.resident_phone) {
    html += `\n<b>Телефон:</b> ${escapeHtml(request.phone || request.resident_phone)}`;
  }

  if (messages.length) {
    html += '\n\n<b>Переписка:</b>';
    for (const msg of messages.slice(-8)) {
      const who = msg.author_role === 'uk' ? 'УК' : 'Житель';
      html += `\n• <b>${who}:</b> ${escapeHtml(msg.body)}`;
    }
  } else if (request.uk_comment) {
    html += `\n<b>Комментарий УК:</b> ${escapeHtml(request.uk_comment)}`;
  }

  return html;
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

export async function listResidentMaxIdsByCompany(companyId) {
  const [rows] = await pool.execute(
    `SELECT max_user_id FROM users
     WHERE company_id = :companyId
       AND role = 'resident'
       AND onboarding_step = 'done'`,
    { companyId },
  );
  return rows.map((r) => r.max_user_id).filter(Boolean);
}

export async function createAnnouncement({ companyId, authorUserId, body, recipientsCount }) {
  const [result] = await pool.execute(
    `INSERT INTO announcements (company_id, author_user_id, body, recipients_count)
     VALUES (:companyId, :authorUserId, :body, :recipientsCount)`,
    { companyId, authorUserId, body, recipientsCount },
  );
  return result.insertId;
}

export async function resolveDefaultAddress(user) {
  const primary = await getPrimaryAddress(user.id);
  return primary?.address_text || user.registration_address || null;
}
