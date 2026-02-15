/**
 * API для iOS: GET/POST/DELETE bookings
 * Клиент работает со своими записями (по api_key)
 */
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/index.js';

export function listBookings(req, res) {
  const db = getDb();
  const rows = db.prepare(`
    SELECT b.*, s.name as service_name
    FROM bookings b
    JOIN services s ON s.id = b.service_id
    WHERE b.user_id = ?
    ORDER BY b.date_time DESC
  `).all(req.clientId);

  res.json(rows.map(r => toBookingJSON(r)));
}

export function createBooking(req, res) {
  const { service_id, date_time, post_id, notes } = req.body || {};
  if (!service_id || !date_time) {
    return res.status(400).json({ error: 'service_id и date_time обязательны' });
  }

  const db = getDb();
  const service = db.prepare('SELECT * FROM services WHERE id = ? AND is_active = 1').get(service_id);
  if (!service) {
    return res.status(404).json({ error: 'Услуга не найдена или неактивна' });
  }

  const postId = post_id || 'post_1';
  const post = db.prepare('SELECT id FROM posts WHERE id = ? AND is_enabled = 1').get(postId);
  if (!post) {
    return res.status(400).json({ error: 'Пост недоступен' });
  }

  const date = new Date(date_time);
  if (isNaN(date.getTime())) {
    return res.status(400).json({ error: 'Некорректная дата' });
  }

  const id = uuidv4();
  const now = new Date().toISOString();
  const dtStr = date.toISOString();

  db.prepare(`
    INSERT INTO bookings (id, service_id, user_id, date_time, status, price, duration, notes, post_id, created_at)
    VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?)
  `).run(id, service_id, req.clientId, dtStr, service.price, service.duration, notes || null, postId, now);

  const row = db.prepare('SELECT b.*, s.name as service_name FROM bookings b JOIN services s ON s.id = b.service_id WHERE b.id = ?').get(id);
  res.status(201).json(toBookingJSON(row));
}

export function cancelBooking(req, res) {
  const db = getDb();
  const row = db.prepare('SELECT * FROM bookings WHERE id = ? AND user_id = ?').get(req.params.id, req.clientId);
  if (!row) {
    return res.status(404).json({ error: 'Запись не найдена' });
  }
  if (row.status === 'cancelled') {
    return res.status(400).json({ error: 'Запись уже отменена' });
  }
  if (row.status === 'completed') {
    return res.status(400).json({ error: 'Нельзя отменить завершённую запись' });
  }

  db.prepare("UPDATE bookings SET status = 'cancelled' WHERE id = ?").run(req.params.id);
  res.status(204).send();
}

export function submitRating(req, res) {
  const { rating, comment } = req.body || {};
  const bookingId = req.params.id;

  if (rating == null || typeof rating !== 'number' || rating < 1 || rating > 5) {
    return res.status(400).json({ error: 'rating обязателен, число 1–5' });
  }

  const db = getDb();
  const row = db.prepare('SELECT * FROM bookings WHERE id = ? AND user_id = ?').get(bookingId, req.clientId);
  if (!row) {
    return res.status(404).json({ error: 'Запись не найдена' });
  }

  db.prepare('UPDATE bookings SET rating = ?, rating_comment = ? WHERE id = ?').run(
    Math.round(rating),
    typeof comment === 'string' ? comment.trim() || null : null,
    bookingId
  );
  res.status(200).json({ rating: Math.round(rating), rating_comment: comment || null });
}

function toBookingJSON(row) {
  return {
    _id: row.id,
    service_id: row.service_id,
    service_name: row.service_name || '',
    user_id: row.user_id,
    date_time: row.date_time,
    status: row.status,
    price: row.price,
    duration: row.duration,
    notes: row.notes,
    created_at: row.created_at,
    in_progress_started_at: row.in_progress_started_at,
  };
}
