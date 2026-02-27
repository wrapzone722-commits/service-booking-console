/**
 * GET /slots?service_id=...&date=...&post_id=...
 * Свободные слоты на дату для услуги и поста
 */
import { getDb } from '../db/index.js';

export function getSlots(req, res) {
  const { service_id, date, post_id } = req.query;
  if (!service_id || !date) {
    return res.status(400).json({ error: 'service_id и date обязательны' });
  }

  const db = getDb();
  const service = db.prepare('SELECT duration FROM services WHERE id = ?').get(service_id);
  if (!service) {
    return res.status(404).json({ error: 'Услуга не найдена' });
  }

  const postId = post_id || 'post_1';
  const post = db.prepare('SELECT * FROM posts WHERE id = ? AND is_enabled = 1').get(postId);
  if (!post) {
    return res.status(400).json({ error: 'Пост недоступен' });
  }

  const [startH, startM] = (post.start_time || '09:00').split(':').map(Number);
  const [endH, endM] = (post.end_time || '18:00').split(':').map(Number);
  const interval = post.interval_minutes || 30;

  const parts = String(date).split('-').map(Number);
  const y = parts[0], m = parts[1], d = parts[2];
  if (!y || !m || !d) {
    return res.status(400).json({ error: 'Некорректная дата' });
  }

  // Слоты должны начинаться с 09:00 по "времени сервиса", независимо от таймзоны сервера.
  // SERVICE_TZ_OFFSET_MINUTES: минуты смещения относительно UTC (например для UTC+5: 300).
  // Если не задано — используем таймзону сервера.
  const serviceOffsetMin = getServiceOffsetMinutes();

  const slots = [];
  let currentMs = Date.UTC(y, m - 1, d, startH, startM, 0) - serviceOffsetMin * 60 * 1000;
  const dayEndMs = Date.UTC(y, m - 1, d, endH, endM, 0) - serviceOffsetMin * 60 * 1000;

  while (currentMs < dayEndMs) {
    const slotTime = new Date(currentMs).toISOString();
    const isAvailable = isSlotAvailable(db, slotTime, service.duration, postId);
    slots.push({ time: slotTime, is_available: isAvailable });
    currentMs += interval * 60 * 1000;
  }

  res.json(slots);
}

function getServiceOffsetMinutes() {
  const raw = process.env.SERVICE_TZ_OFFSET_MINUTES;
  const n = raw == null ? NaN : Number(raw);
  if (Number.isFinite(n)) return n;
  // JS offset: minutes behind UTC (e.g. UTC+5 => -300). Нам нужен "минуты вперед" (e.g. +300).
  return -new Date().getTimezoneOffset();
}

function isSlotAvailable(db, slotStartISO, duration, postId) {
  const slotStart = new Date(slotStartISO);
  const slotEnd = new Date(slotStart.getTime() + duration * 60 * 1000);
  const dateStr = slotStartISO.slice(0, 10);

  const bookings = db.prepare(`
    SELECT date_time, duration FROM bookings
    WHERE post_id = ? AND status NOT IN ('cancelled')
    AND date(date_time) = date(?)
  `).all(postId, dateStr);

  for (const b of bookings) {
    const bStart = new Date(b.date_time);
    const bEnd = new Date(bStart.getTime() + b.duration * 60 * 1000);
    if (slotStart < bEnd && slotEnd > bStart) return false;
  }
  return true;
}
