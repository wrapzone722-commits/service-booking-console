/**
 * SQLite database for Service Booking Web Console
 */
import Database from 'better-sqlite3';
import { mkdirSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

let db;

export function initDatabase(dbPath = null) {
  const path = dbPath || join(__dirname, '..', 'data', 'service_booking.db');
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

  // Миграция: добавить rating и rating_comment в bookings если нет
  try {
    db.exec('ALTER TABLE bookings ADD COLUMN rating INTEGER');
  } catch (_) {}
  try {
    db.exec('ALTER TABLE bookings ADD COLUMN rating_comment TEXT');
  } catch (_) {}

  seedInitialData();
  return db;
}

function seedInitialData() {
  const count = db.prepare('SELECT COUNT(*) as c FROM services').get();
  if (count.c > 0) return;

  const now = new Date().toISOString();

  // Демо-услуги
  const services = [
    ['1', 'Химчистка салона', 'Полная химчистка салона автомобиля', 5000, 180, 'Автоуслуги', null, 1, now],
    ['2', 'Мойка кузова', 'Бесконтактная мойка с воском', 800, 30, 'Автоуслуги', null, 1, now],
    ['3', 'Полировка', 'Профессиональная полировка кузова', 8000, 240, 'Автоуслуги', null, 1, now],
    ['4', 'Полировка фар', 'Восстановление прозрачности оптики', 1500, 45, 'Детейлинг', null, 1, now],
    ['5', 'Чистка дисков', 'Мойка и полировка дисков', 2000, 60, 'Детейлинг', null, 1, now],
  ];
  const insService = db.prepare('INSERT INTO services (id, name, description, price, duration, category, image_url, is_active, created_at) VALUES (?,?,?,?,?,?,?,?,?)');
  for (const s of services) insService.run(...s);

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

  db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('api_base_url', '')").run();
  db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('admin_password', 'admin123')").run();
}

export function getDb() {
  if (!db) throw new Error('Database not initialized');
  return db;
}
