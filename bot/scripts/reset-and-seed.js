/**
 * Полная очистка бизнес-данных MySQL и загрузка test-data.json.
 *
 * Локально (из корня, MySQL на хосте):
 *   node bot/scripts/reset-and-seed.js
 *
 * В Docker:
 *   docker compose exec bot node scripts/reset-and-seed.js
 *
 * Путь к JSON (по приоритету):
 *   TEST_DATA_PATH env → /app/test-data.json → ../../test-data.json → ../test-data.json
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import '../src/load-env.js';
import { pool, ensureSchema, updateUser } from '../src/db.js';
import { ensureWebSchema, hashPassword, ensureHouseChats } from '../src/web-db.js';
import { ensureTicketsSchema } from '../src/tickets-db.js';
import { toCitySlug } from '../src/cities.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function resolveDataFile() {
  const candidates = [
    process.env.TEST_DATA_PATH,
    '/app/test-data.json',
    path.resolve(__dirname, '../../test-data.json'),
    path.resolve(process.cwd(), 'test-data.json'),
    path.resolve(__dirname, '../test-data.json'),
  ].filter(Boolean);
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error(`test-data.json не найден. Искали:\n${candidates.join('\n')}`);
}

async function wipeAll() {
  await pool.execute('SET FOREIGN_KEY_CHECKS = 0');
  const tables = [
    'request_messages',
    'requests',
    'announcements',
    'messages',
    'topics',
    'chats',
    'parking_spots',
    'entrance_works',
    'web_sessions',
    'resident_uk_requests',
    'notification_settings',
    'addresses',
    'houses',
    'management_companies',
    'users',
    'cities',
  ];
  for (const table of tables) {
    try {
      await pool.execute(`TRUNCATE TABLE \`${table}\``);
      console.log(`  truncated ${table}`);
    } catch (e) {
      // таблицы может ещё не быть
      console.warn(`  skip ${table}:`, e?.message || e);
    }
  }
  await pool.execute('SET FOREIGN_KEY_CHECKS = 1');
}

async function seed(data) {
  for (const city of data.cities || []) {
    await pool.execute(
      `INSERT INTO cities (slug, display_name) VALUES (:slug, :name)
       ON DUPLICATE KEY UPDATE display_name = VALUES(display_name)`,
      { slug: city.slug || toCitySlug(city.displayName), name: city.displayName },
    );
  }

  const company = data.company;
  const citySlug = toCitySlug(company.city);
  const [compIns] = await pool.execute(
    `INSERT INTO management_companies
      (name, city_slug, phone, email, address, status)
     VALUES (:name, :slug, :phone, :email, :address, :status)`,
    {
      name: company.name,
      slug: citySlug,
      phone: company.phone || null,
      email: company.email || null,
      address: company.address || null,
      status: company.status || 'approved',
    },
  );
  const companyId = compIns.insertId;

  const house = data.house;
  await pool.execute(
    `INSERT INTO houses (id, city, address, uk_name, company_id, floors, entrances)
     VALUES (:id, :city, :address, :uk, :cid, :floors, :entrances)`,
    {
      id: house.id,
      city: house.city,
      address: house.address,
      uk: house.uk || company.name,
      cid: companyId,
      floors: house.floors || 5,
      entrances: house.entrances || 2,
    },
  );
  await ensureHouseChats(house.id);

  const parkingCount = Number(data.parkingSpots) || 12;
  const cols = 6;
  for (let n = 1; n <= parkingCount; n += 1) {
    const rowIdx = Math.floor((n - 1) / cols);
    const colIdx = (n - 1) % cols;
    await pool.execute(
      `INSERT INTO parking_spots
       (id, house_id, label, row_idx, col_idx, active, occupied, occupied_at)
       VALUES (:id, :houseId, :label, :rowIdx, :colIdx, 1, 0, NULL)`,
      {
        id: `${house.id}-p${n}`,
        houseId: house.id,
        label: `P${n}`,
        rowIdx,
        colIdx,
      },
    );
  }

  for (const w of data.works || []) {
    await pool.execute(
      `INSERT INTO entrance_works (id, house_id, entrance, floor, title, detail, status)
       VALUES (:id, :houseId, :entrance, :floor, :title, :detail, :status)`,
      {
        id: w.id,
        houseId: house.id,
        entrance: w.entrance,
        floor: w.floor,
        title: w.title,
        detail: w.detail,
        status: w.status || 'todo',
      },
    );
  }

  let ukUserId = null;
  let residentUserId = null;

  for (const acc of data.accounts || []) {
    const passwordHash = hashPassword(acc.password || '1234');
    const role = acc.role;
    const slug = toCitySlug(acc.city || company.city);
    const [ins] = await pool.execute(
      `INSERT INTO users (
        max_user_id, first_name, last_name, phone, password_hash, role, uk_name,
        consent_accepted, consent_accepted_at, onboarding_step, uk_status, city_slug,
        company_id, house_id, street, entrance, flat, skipped_address, registration_address
      ) VALUES (
        NULL, :firstName, :lastName, :phone, :passwordHash, :role, :ukName,
        1, NOW(), 'done', :ukStatus, :citySlug,
        :companyId, :houseId, :street, :entrance, :flat, 1, :regAddress
      )`,
      {
        firstName: acc.firstName || 'Тест',
        lastName: acc.lastName || null,
        phone: acc.phone,
        passwordHash,
        role,
        ukName: role === 'uk' ? (acc.ukName || company.name) : null,
        ukStatus: role === 'uk' ? 'approved' : 'none',
        citySlug: slug,
        companyId: role === 'uk' || role === 'resident' ? companyId : null,
        houseId: house.id,
        street: acc.street || null,
        entrance: acc.entrance || null,
        flat: acc.flat || null,
        regAddress: [acc.street, acc.entrance && `подъезд ${acc.entrance}`, acc.flat && `кв. ${acc.flat}`]
          .filter(Boolean)
          .join(', ') || null,
      },
    );
    const userId = ins.insertId;
    await pool.execute(
      `INSERT INTO notification_settings (user_id) VALUES (:userId)
       ON DUPLICATE KEY UPDATE user_id = user_id`,
      { userId },
    );

    if (role === 'uk') {
      ukUserId = userId;
      await pool.execute(
        `UPDATE management_companies SET requested_by_user_id = :uid WHERE id = :cid`,
        { uid: userId, cid: companyId },
      );
    }
    if (role === 'resident') {
      residentUserId = userId;
      await pool.execute(
        `INSERT INTO resident_uk_requests (user_id, company_id, status)
         VALUES (:userId, :companyId, 'approved')`,
        { userId, companyId },
      );
    }
    console.log(`  user ${acc.phone} (${role}) id=${userId}`);
  }

  if (data.ticket && residentUserId) {
    const publicNumber = `ND-TEST-${Date.now().toString(36).toUpperCase()}`;
    const title = data.ticket.title;
    const description = [
      data.ticket.scope === 'entrance' ? `Область: подъезд ${data.ticket.entrance}` : null,
      title,
      data.ticket.description,
    ]
      .filter(Boolean)
      .join('\n\n');
    const [reqIns] = await pool.execute(
      `INSERT INTO requests (
        public_number, user_id, company_id, type, category, address_text, description, status,
        house_id, web_category, title, request_scope, request_entrance
      ) VALUES (
        :publicNumber, :userId, :companyId, 'emergency', 'other', :address, :description, :status,
        :houseId, :webCategory, :title, :scope, :entrance
      )`,
      {
        publicNumber,
        userId: residentUserId,
        companyId,
        address: `${house.city}, ${house.address} · подъезд ${data.ticket.entrance || 1}`,
        description,
        status: data.ticket.status || 'new',
        houseId: house.id,
        webCategory: data.ticket.category || 'accident',
        title,
        scope: data.ticket.scope || 'entrance',
        entrance: data.ticket.entrance || 1,
      },
    );
    console.log(`  ticket #${reqIns.insertId} ${publicNumber}`);
  }

  if (ukUserId) {
    await updateUser(ukUserId, { company_id: companyId, house_id: house.id });
  }

  return { companyId, houseId: house.id, ukUserId, residentUserId };
}

async function main() {
  const dataPath = resolveDataFile();
  console.log(`[seed] data file: ${dataPath}`);
  const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

  console.log('[seed] ensure schema…');
  await ensureSchema();
  await ensureTicketsSchema();
  await ensureWebSchema();

  console.log('[seed] wipe…');
  await wipeAll();

  // города снова (wipe удалил)
  console.log('[seed] load test data…');
  const result = await seed(data);

  console.log('[seed] done', result);
  console.log('\nТестовые аккаунты:');
  for (const a of data.accounts || []) {
    console.log(`  ${a.role}: ${a.phone} / ${a.password}`);
  }
  await pool.end();
}

main().catch(async (err) => {
  console.error('[seed] failed', err);
  try {
    await pool.end();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
