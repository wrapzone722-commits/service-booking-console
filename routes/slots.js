/**
 * GET /slots?service_id=...&date=...&post_id=...
 * Свободные слоты на дату для услуги и поста
 */
import { getDb } from '../db/index.js';

const STUDIO_OFFSET_HOURS = parseInt(process.env.STUDIO_TZ_OFFSET_HOURS || '5', 10);

function settingGet(db, key, fallback) {
  const r = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  const v = r && r.value != null ? String(r.value).trim() : '';
  return v || fallback;
}

/** Общие часы слотов, если у поста выключено «своё расписание» */
function getStudioSlotDefaults(db) {
  const intervalRaw = parseInt(settingGet(db, 'studio_slot_interval_minutes', '30'), 10);
  return {
    start: settingGet(db, 'studio_slot_start', '09:00'),
    end: settingGet(db, 'studio_slot_end', '18:00'),
    interval: Number.isFinite(intervalRaw) && intervalRaw > 0 ? intervalRaw : 30,
  };
}

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

  const studio = getStudioSlotDefaults(db);
  const useOwn = !!post.use_custom_hours;
  const startStr = useOwn ? post.start_time || studio.start : studio.start;
  const endStr = useOwn ? post.end_time || studio.end : studio.end;
  const interval = useOwn ? post.interval_minutes || studio.interval : studio.interval;

  const [startH, startM] = String(startStr || '09:00').split(':').map(Number);
  const [endH, endM] = String(endStr || '18:00').split(':').map(Number);

  const parts = String(date).split('-').map(Number);
  const y = parts[0], m = parts[1], d = parts[2];
  if (!y || !m || !d) {
    return res.status(400).json({ error: 'Некорректная дата' });
  }

  const offsetMin = STUDIO_OFFSET_HOURS * 60;
  const offsetSign = offsetMin >= 0 ? '+' : '-';
  const absH = String(Math.floor(Math.abs(offsetMin) / 60)).padStart(2, '0');
  const absM = String(Math.abs(offsetMin) % 60).padStart(2, '0');
  const tzSuffix = offsetSign + absH + ':' + absM;

  const slots = [];
  let h = startH, mi = startM;

  while (h < endH || (h === endH && mi < endM)) {
    const hh = String(h).padStart(2, '0');
    const mm = String(mi).padStart(2, '0');
    const displayTime = hh + ':' + mm;

    const isoWithTz = `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}T${hh}:${mm}:00${tzSuffix}`;

    const slotDateUTC = new Date(isoWithTz);
    const isoUTC = slotDateUTC.toISOString();

    const isAvailable = isSlotAvailable(db, isoUTC, service.duration, postId);
    slots.push({
      time: isoUTC,
      display_time: displayTime,
      is_available: isAvailable,
    });

    mi += interval;
    while (mi >= 60) { mi -= 60; h++; }
  }

  res.json(slots);
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
