#!/usr/bin/env node
/**
 * Импорт/обновление каталога услуг с сайта (studioServicesData.js).
 * Запуск из каталога web-console:
 *   node scripts/import-studio-services.mjs
 * С путём к БД:
 *   DB_PATH=/data/service_booking.db node scripts/import-studio-services.mjs
 *
 * Для строк с тем же id обновляются название, описание, цена, длительность, категория, картинка.
 * Существующие записи с другими id не удаляются.
 */
import Database from 'better-sqlite3';
import { readFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { STUDIO_SERVICES } from '../db/studioServicesData.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const dbPath = process.env.DB_PATH || join(root, 'data', 'service_booking.db');
const dataDir = dirname(dbPath);
if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });

const db = new Database(dbPath);
const hasServices = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='services'").get();
if (!hasServices) {
  const schema = readFileSync(join(root, 'db', 'schema.sql'), 'utf8');
  db.exec(schema);
}

const now = new Date().toISOString();
const upsert = db.prepare(`
INSERT INTO services (id, name, description, price, duration, category, image_url, is_active, created_at)
VALUES (@id, @name, @description, @price, @duration, @category, @image_url, 1, @created_at)
ON CONFLICT(id) DO UPDATE SET
  name = excluded.name,
  description = excluded.description,
  price = excluded.price,
  duration = excluded.duration,
  category = excluded.category,
  image_url = excluded.image_url,
  is_active = excluded.is_active
`);
/* created_at при обновлении не трогаем — сохраняем дату первой записи */

const run = db.transaction(() => {
  for (const s of STUDIO_SERVICES) {
    upsert.run({ ...s, created_at: now });
  }
});
run();

console.log(`OK: импортировано/обновлено услуг: ${STUDIO_SERVICES.length} → ${dbPath}`);
db.close();
