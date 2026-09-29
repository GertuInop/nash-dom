import { pool, updateUser, getCompanyById, getCompanyWithManager, listPendingUkRequests, setUkRequestStatus } from './db.js';
import { findUserById } from './web-db.js';

export { listPendingUkRequests, setUkRequestStatus, getCompanyWithManager };

export async function ensureAdminSchema() {
  if (!(await columnExists('users', 'is_blocked'))) {
    await pool.execute(
      'ALTER TABLE users ADD COLUMN is_blocked TINYINT(1) NOT NULL DEFAULT 0',
    );
  }

  // Расширяем статусы УК: blocked
  await pool.execute(`
    ALTER TABLE management_companies
    MODIFY status ENUM('pending', 'approved', 'rejected', 'blocked')
    NOT NULL DEFAULT 'pending'
  `).catch(() => {});
}

async function columnExists(table, column) {
  const [rows] = await pool.execute(
    `SELECT COUNT(*) AS cnt FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table AND COLUMN_NAME = :column`,
    { table, column },
  );
  return Number(rows[0]?.cnt) > 0;
}

function maxProfileFields(maxUserId, username) {
  const id = maxUserId ? String(maxUserId) : null;
  const uname = username ? String(username).replace(/^@/, '') : null;
  return {
    maxUserId: id,
    username: uname,
    maxProfileUrl: id ? `max://user/${id}` : null,
    maxPublicUrl: uname ? `https://max.ru/${uname}` : null,
  };
}

function mapUserRow(u) {
  if (!u) return null;
  const profile = maxProfileFields(u.max_user_id, u.username);
  return {
    id: String(u.id),
    ...profile,
    name: [u.first_name, u.last_name].filter(Boolean).join(' ') || u.full_name || 'Пользователь',
    phone: u.phone || '',
    role: u.role || 'resident',
    companyId: u.company_id ? String(u.company_id) : null,
    companyName: u.company_name || u.uk_name || null,
    city: u.city_slug || '',
    houseId: u.house_id || null,
    blocked: Boolean(u.is_blocked),
    ukStatus: u.uk_status || 'none',
  };
}

function mapCompanyRow(c, residents = []) {
  return {
    id: String(c.id),
    name: c.name,
    city: c.city_slug || '',
    phone: c.phone || '',
    email: c.email || '',
    address: c.address || '',
    status: c.status,
    createdAt: c.created_at,
    manager: {
      userId: c.manager_user_id ? String(c.manager_user_id) : null,
      name: [c.manager_first_name, c.manager_last_name].filter(Boolean).join(' ')
        || c.manager_username
        || '—',
      phone: c.manager_phone || '',
      ...maxProfileFields(c.manager_max_user_id, c.manager_username),
    },
    residentsCount: residents.length,
    residents,
  };
}

export async function listAllCompanies() {
  const [rows] = await pool.execute(
    `SELECT
       mc.*,
       u.id AS manager_user_id,
       u.max_user_id AS manager_max_user_id,
       u.username AS manager_username,
       u.first_name AS manager_first_name,
       u.last_name AS manager_last_name,
       u.phone AS manager_phone
     FROM management_companies mc
     LEFT JOIN users u ON u.id = mc.requested_by_user_id
     ORDER BY
       FIELD(mc.status, 'pending', 'approved', 'blocked', 'rejected'),
       mc.created_at DESC`,
  );

  const result = [];
  for (const c of rows) {
    const residents = await listCompanyMembers(c.id);
    result.push(mapCompanyRow(c, residents));
  }
  return result;
}

export async function listCompanyMembers(companyId) {
  const [rows] = await pool.execute(
    `SELECT u.*, mc.name AS company_name
     FROM users u
     LEFT JOIN management_companies mc ON mc.id = u.company_id
     WHERE u.company_id = :companyId
     ORDER BY u.role DESC, u.first_name ASC`,
    { companyId },
  );
  return rows.map(mapUserRow);
}

export async function getAdminCompany(companyId) {
  const c = await getCompanyWithManager(companyId);
  if (!c) return null;
  const residents = await listCompanyMembers(companyId);
  return mapCompanyRow(c, residents);
}

export async function listPendingUkForAdmin() {
  const rows = await listPendingUkRequests();
  return rows.map((item) => ({
    id: String(item.id),
    name: item.name,
    city: item.city_slug || '',
    phone: item.phone || '',
    email: item.email || '',
    address: item.address || '',
    status: item.status,
    createdAt: item.created_at,
    manager: {
      name: [item.first_name, item.last_name].filter(Boolean).join(' ')
        || item.username
        || '—',
      phone: item.manager_phone || '',
      ...maxProfileFields(item.max_user_id, item.username),
    },
  }));
}

export async function listAllUsers({ q } = {}) {
  const like = q ? `%${String(q).trim()}%` : null;
  const [rows] = await pool.execute(
    like
      ? `SELECT u.*, mc.name AS company_name
         FROM users u
         LEFT JOIN management_companies mc ON mc.id = u.company_id
         WHERE u.first_name LIKE :like
            OR u.last_name LIKE :like
            OR u.phone LIKE :like
            OR u.username LIKE :like
            OR mc.name LIKE :like
         ORDER BY u.created_at DESC
         LIMIT 200`
      : `SELECT u.*, mc.name AS company_name
         FROM users u
         LEFT JOIN management_companies mc ON mc.id = u.company_id
         ORDER BY u.created_at DESC
         LIMIT 200`,
    like ? { like } : {},
  );
  return rows.map(mapUserRow);
}

export async function setUserBlocked(userId, blocked) {
  await pool.execute(
    'UPDATE users SET is_blocked = :blocked WHERE id = :id',
    { id: userId, blocked: blocked ? 1 : 0 },
  );
  return mapUserRow(await findUserById(userId));
}

export async function moveUserToCompany(userId, companyId) {
  const user = await findUserById(userId);
  if (!user) throw Object.assign(new Error('Пользователь не найден'), { status: 404 });
  if (user.role === 'admin') {
    throw Object.assign(new Error('Нельзя переносить администратора'), { status: 400 });
  }

  if (!companyId) {
    await updateUser(userId, {
      company_id: null,
      house_id: null,
      uk_name: null,
    });
    return mapUserRow(await findUserById(userId));
  }

  const company = await getCompanyById(companyId);
  if (!company) throw Object.assign(new Error('УК не найдена'), { status: 404 });
  if (company.status === 'blocked') {
    throw Object.assign(new Error('УК заблокирована'), { status: 400 });
  }

  await updateUser(userId, {
    company_id: company.id,
    uk_name: company.name,
    city_slug: company.city_slug || user.city_slug,
  });
  return mapUserRow(await findUserById(userId));
}

/**
 * Блокировка УК: status=blocked, отвязка жителей, уведомления.
 * @returns {{ company, managerMaxId, residentMaxIds: number[] }}
 */
export async function blockCompany(companyId, adminUserId) {
  const company = await getCompanyWithManager(companyId);
  if (!company) throw Object.assign(new Error('УК не найдена'), { status: 404 });

  const [members] = await pool.execute(
    `SELECT id, max_user_id, role FROM users WHERE company_id = :cid`,
    { cid: companyId },
  );

  await pool.execute(
    `UPDATE management_companies
     SET status = 'blocked', approved_by_user_id = COALESCE(approved_by_user_id, :adminId)
     WHERE id = :id`,
    { id: companyId, adminId: adminUserId },
  );

  await pool.execute(
    `UPDATE users
     SET company_id = NULL, house_id = NULL, uk_name = NULL
     WHERE company_id = :cid AND role != 'uk'`,
    { cid: companyId },
  );

  // Руководителей УК оставляем привязанными, но статус rejected/blocked
  await pool.execute(
    `UPDATE users SET uk_status = 'rejected' WHERE company_id = :cid AND role = 'uk'`,
    { cid: companyId },
  );

  const residentMaxIds = members
    .filter((m) => m.role !== 'uk' && m.max_user_id)
    .map((m) => Number(m.max_user_id));
  const managerMaxId = company.manager_max_user_id
    ? Number(company.manager_max_user_id)
    : members.find((m) => m.role === 'uk' && m.max_user_id)?.max_user_id || null;

  return {
    company: await getAdminCompany(companyId),
    companyName: company.name,
    managerMaxId: managerMaxId ? Number(managerMaxId) : null,
    residentMaxIds,
  };
}

export async function unblockCompany(companyId) {
  const company = await getCompanyById(companyId);
  if (!company) throw Object.assign(new Error('УК не найдена'), { status: 404 });

  await pool.execute(
    `UPDATE management_companies SET status = 'approved' WHERE id = :id`,
    { id: companyId },
  );
  await pool.execute(
    `UPDATE users SET uk_status = 'approved' WHERE company_id = :cid AND role = 'uk'`,
    { cid: companyId },
  );
  return getAdminCompany(companyId);
}

export async function adminDecideUkRequest(companyId, decision, adminUserId) {
  const status = decision === 'approve' ? 'approved' : 'rejected';
  const result = await setUkRequestStatus(companyId, status, adminUserId);
  return {
    status,
    notifyMaxId: result?.max_user_id ? Number(result.max_user_id) : null,
    companyName: result?.name || null,
    company: await getAdminCompany(companyId),
  };
}
