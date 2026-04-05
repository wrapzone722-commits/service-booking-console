/**
 * API для iOS: GET/POST/DELETE bookings
 * Клиент работает со своими записями (по api_key)
 */
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/index.js';
import { applyBookingContactFromBookingBody } from './profile.js';
import { normalizeInviteCode } from './invites.js';

/** Нормализация источника записи: тело запроса + платформа клиента при регистрации */
function resolveBookingSource(bodySource, clientPlatform) {
  const s = typeof bodySource === 'string' ? bodySource.trim().toLowerCase() : '';
  if (s === 'web' || s === 'site' || s === 'widget') return 'web';
  if (s === 'ios' || s === 'iphone' || s === 'ipad') return 'ios';
  if (s === 'android') return 'android';
  const p = (clientPlatform || '').toLowerCase();
  if (p.includes('web')) return 'web';
  if (p.startsWith('ios') || p.includes('iphone') || p.includes('ipad')) return 'ios';
  if (p.startsWith('android') || p.includes('android')) return 'android';
  return null;
}

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
  const { service_id, date_time, post_id, notes, first_name, phone, source, invite_code } = req.body || {};
  if (!service_id || !date_time) {
    return res.status(400).json({ error: 'service_id и date_time обязательны' });
  }

  const db = getDb();
  const clientRow = db.prepare('SELECT platform FROM clients WHERE id = ?').get(req.clientId);
  const service = db.prepare('SELECT * FROM services WHERE id = ? AND is_active = 1').get(service_id);
  if (!service) {
    return res.status(404).json({ error: 'Услуга не найдена или неактивна' });
  }

  const codeNorm = normalizeInviteCode(
    typeof invite_code === 'string' ? invite_code : invite_code != null ? String(invite_code) : null
  );

  let inviteRow = null;
  if (codeNorm) {
    inviteRow = db
      .prepare(
        `
      SELECT ic.* FROM invite_codes ic
      JOIN services s ON s.id = ic.service_id AND s.is_active = 1
      WHERE ic.code = ? AND ic.active = 1
    `
      )
      .get(codeNorm);

    if (!inviteRow) {
      return res.status(400).json({ error: 'Неверный или неактивный код приглашения' });
    }
    if (inviteRow.service_id !== service_id) {
      return res.status(400).json({ error: 'Код не относится к выбранной услуге' });
    }
    if (inviteRow.expires_at) {
      const ex = new Date(inviteRow.expires_at);
      if (!isNaN(ex.getTime()) && ex.getTime() < Date.now()) {
        return res.status(400).json({ error: 'Срок действия кода истёк' });
      }
    }
    const used = db
      .prepare('SELECT COUNT(*) as c FROM invite_redemptions WHERE invite_code_id = ?')
      .get(inviteRow.id).c;
    if (used >= inviteRow.max_uses) {
      return res.status(400).json({ error: 'Лимит активаций кода исчерпан' });
    }
    const already = db
      .prepare('SELECT 1 FROM invite_redemptions WHERE invite_code_id = ? AND client_id = ?')
      .get(inviteRow.id, req.clientId);
    if (already) {
      return res.status(400).json({ error: 'Вы уже использовали этот код' });
    }
  }

  const postId = inviteRow ? inviteRow.post_id || 'post_1' : post_id || 'post_1';
  if (inviteRow && post_id && String(post_id).trim() && String(post_id).trim() !== postId) {
    return res.status(400).json({ error: 'Для этого кода выберите указанный в приглашении пост' });
  }

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

  const contactPatch =
    typeof first_name === 'string' || typeof phone === 'string'
      ? {
          ...(typeof first_name === 'string' ? { first_name } : {}),
          ...(typeof phone === 'string' ? { phone } : {}),
        }
      : null;

  const snapFirst =
    typeof first_name === 'string' && first_name.trim() ? first_name.trim() : null;
  const snapPhone = typeof phone === 'string' && phone.trim() ? phone.trim() : null;
  const bookingSource = resolveBookingSource(source, clientRow?.platform);

  const finalPrice = inviteRow ? 0 : service.price;
  const inviteCodeId = inviteRow ? inviteRow.id : null;
  const redemptionId = inviteRow ? uuidv4() : null;

  const tx = db.transaction(() => {
    if (contactPatch) {
      applyBookingContactFromBookingBody(req.clientId, contactPatch);
    }
    db.prepare(`
    INSERT INTO bookings (id, service_id, user_id, date_time, status, price, duration, notes, post_id, created_at,
      booking_source, booking_snapshot_first_name, booking_snapshot_phone, invite_code_id)
    VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
      id,
      service_id,
      req.clientId,
      dtStr,
      finalPrice,
      service.duration,
      notes || null,
      postId,
      now,
      bookingSource,
      snapFirst,
      snapPhone,
      inviteCodeId
    );
    if (inviteRow) {
      db.prepare(
        `
        INSERT INTO invite_redemptions (id, invite_code_id, client_id, booking_id, redeemed_at)
        VALUES (?, ?, ?, ?, ?)
      `
      ).run(redemptionId, inviteRow.id, req.clientId, id, now);
    }
  });

  try {
    tx();
  } catch (e) {
    console.error('createBooking tx:', e);
    if (String(e.message || e).includes('UNIQUE')) {
      return res.status(400).json({ error: 'Вы уже использовали этот код' });
    }
    return res.status(500).json({ error: 'Не удалось создать запись' });
  }

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
    invite_applied: !!row.invite_code_id,
  };
}
