/**
 * SQLite database for Service Booking Web Console
 */
import Database from 'better-sqlite3';
import { mkdirSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';
import { STUDIO_SERVICES } from './studioServicesData.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

let db;

export function initDatabase(dbPath = null) {
  // Для продакшн-деплоя обязательно выносите DB_PATH на постоянное хранилище (volume/диск),
  // иначе при пересоздании контейнера/инстанса данные будут потеряны.
  const path =
    dbPath ||
    process.env.DB_PATH ||
    join(__dirname, '..', 'data', 'service_booking.db');
  const dataDir = dirname(path);
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }

  db = new Database(path);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf8');
  db.exec(schema);

  // Миграция: добавить selected_car_id в clients если нет
  try {
    db.exec('ALTER TABLE clients ADD COLUMN selected_car_id TEXT');
  } catch (_) {}

  // Миграция: добавить loyalty_points в clients если нет
  try {
    db.exec('ALTER TABLE clients ADD COLUMN loyalty_points INTEGER NOT NULL DEFAULT 0');
  } catch (_) {}

  // Миграция: добавить phone_norm в clients если нет
  try {
    db.exec('ALTER TABLE clients ADD COLUMN phone_norm TEXT');
  } catch (_) {}

  // Индекс для быстрого поиска клиента по телефону
  try {
    db.exec('CREATE INDEX IF NOT EXISTS idx_clients_phone_norm ON clients(phone_norm)');
  } catch (_) {}

  // Backfill phone_norm для существующих клиентов (чтобы слияние по телефону работало сразу после обновления)
  try {
    const rows = db
      .prepare("SELECT id, phone FROM clients WHERE (phone_norm IS NULL OR phone_norm = '') AND phone IS NOT NULL AND phone <> ''")
      .all();
    const upd = db.prepare("UPDATE clients SET phone_norm = ? WHERE id = ?");
    for (const r of rows) {
      const raw = String(r.phone || "").trim();
      if (!raw || raw.toLowerCase().startsWith("device:")) continue;
      const norm = raw.replace(/\\D/g, "");
      if (norm.length < 6) continue;
      upd.run(norm, r.id);
    }
  } catch (_) {}

  // Миграция: добавить rating и rating_comment в bookings если нет
  try {
    db.exec('ALTER TABLE bookings ADD COLUMN rating INTEGER');
  } catch (_) {}
  try {
    db.exec('ALTER TABLE bookings ADD COLUMN rating_comment TEXT');
  } catch (_) {}

  try {
    db.exec('ALTER TABLE bookings ADD COLUMN booking_source TEXT');
  } catch (_) {}
  try {
    db.exec('ALTER TABLE bookings ADD COLUMN booking_snapshot_first_name TEXT');
  } catch (_) {}
  try {
    db.exec('ALTER TABLE bookings ADD COLUMN booking_snapshot_phone TEXT');
  } catch (_) {}

  // Миграция: добавить news_id в notifications если нет
  try {
    db.exec('ALTER TABLE notifications ADD COLUMN news_id TEXT');
  } catch (_) {}

  // Миграция: APNs device token для push-уведомлений
  try {
    db.exec('ALTER TABLE clients ADD COLUMN apns_device_token TEXT');
  } catch (_) {}

  seedInitialData();
  syncMissingStudioServices();
  return db;
}

/** Добавить в БД строки каталога из studioServicesData, если таких id ещё нет (не трогаем существующие). */
function syncMissingStudioServices() {
  const now = new Date().toISOString();
  const ins = db.prepare(
    'INSERT OR IGNORE INTO services (id, name, description, price, duration, category, image_url, is_active, created_at) VALUES (?,?,?,?,?,?,?,?,?)'
  );
  for (const s of STUDIO_SERVICES) {
    ins.run(s.id, s.name, s.description, s.price, s.duration, s.category, s.image_url, 1, now);
  }
}

function seedInitialData() {
  const count = db.prepare('SELECT COUNT(*) as c FROM services').get();
  if (count.c > 0) return;

  const now = new Date().toISOString();

  // Услуги студии «Другое место» (как на сайте: описания, картинки /site-assets/)
  const insService = db.prepare(
    'INSERT INTO services (id, name, description, price, duration, category, image_url, is_active, created_at) VALUES (?,?,?,?,?,?,?,?,?)'
  );
  for (const s of STUDIO_SERVICES) {
    insService.run(s.id, s.name, s.description, s.price, s.duration, s.category, s.image_url, 1, now);
  }

  // Посты
  const posts = [
    ['post_1', 'Пост 1', 1, 0, '09:00', '18:00', 30, now],
    ['post_2', 'Пост 2', 1, 0, '09:00', '18:00', 30, now],
  ];
  const insPost = db.prepare('INSERT INTO posts (id, name, is_enabled, use_custom_hours, start_time, end_time, interval_minutes, created_at) VALUES (?,?,?,?,?,?,?,?)');
  for (const p of posts) insPost.run(...p);

  // Папки автомобилей (демо)
  const carCount = db.prepare('SELECT COUNT(*) as c FROM car_folders').get();
  if (carCount.c === 0) {
    const cars = [
      ['car_1', 'Седан', null, 0, now],
      ['car_2', 'Кроссовер', null, 1, now],
      ['car_3', 'Хэтчбек', null, 2, now],
      ['car_4', 'Внедорожник', null, 3, now],
    ];
    const insCar = db.prepare('INSERT INTO car_folders (id, name, image_url, sort_order, created_at) VALUES (?,?,?,?,?)');
    for (const c of cars) insCar.run(...c);
  }

  // Товары/услуги за баллы (демо)
  try {
    const rewardCount = db.prepare('SELECT COUNT(*) as c FROM loyalty_rewards').get();
    if (rewardCount.c === 0) {
      const rewards = [
        ['r1', 'Скидка 10% на следующую услугу', 'Один раз при записи', 50, null, 1, 0, now],
        ['r2', 'Бесплатная мойка кузова', 'Мойка кузова в подарок', 100, null, 1, 1, now],
        ['r3', 'Чай/кофе в зоне ожидания', 'Напиток при визите', 20, null, 1, 2, now],
      ];
      const ins = db.prepare('INSERT INTO loyalty_rewards (id, name, description, points_cost, image_url, is_active, sort_order, created_at) VALUES (?,?,?,?,?,?,?,?)');
      for (const r of rewards) ins.run(...r);
    }
  } catch (_) {}

  db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('api_base_url', '')").run();
}

export function getDb() {
  if (!db) throw new Error('Database not initialized');
  return db;
}
