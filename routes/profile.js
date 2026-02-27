/**
 * GET /profile - профиль текущего клиента
 * PUT /profile - обновить профиль
 */
import { getDb } from '../db/index.js';

export function getProfile(req, res) {
  const db = getDb();
  const row = db.prepare('SELECT * FROM clients WHERE id = ?').get(req.clientId);
  if (!row) {
    return res.status(404).json({ error: 'Клиент не найден' });
  }
  res.json(toUserJSON(row));
}

export function updateProfile(req, res) {
  const db = getDb();
  const { first_name, last_name, phone, email, social_links } = req.body || {};

  const updates = [];
  const values = [];
  if (first_name !== undefined) { updates.push('first_name = ?'); values.push(first_name); }
  if (last_name !== undefined) { updates.push('last_name = ?'); values.push(last_name); }
  if (phone !== undefined) {
    updates.push('phone = ?');
    values.push(phone || '');
    const norm = normalizePhone(phone);
    updates.push('phone_norm = ?');
    values.push(isRealPhone(phone) ? norm : null);
  }
  if (email !== undefined) { updates.push('email = ?'); values.push(email); }
  if (req.body && 'selected_car_id' in req.body) {
    updates.push('selected_car_id = ?');
    values.push(req.body.selected_car_id || null);
  }
  if (social_links !== undefined) {
    updates.push('social_links = ?');
    values.push(typeof social_links === 'object' ? JSON.stringify(social_links) : social_links);
  }

  // Если указали реальный телефон и уже есть другой клиент с тем же телефоном —
  // переносим баллы/историю на текущий device_id (чтобы после переустановки баллы не пропадали).
  if (isRealPhone(phone)) {
    const norm = normalizePhone(phone);
    const other = db
      .prepare("SELECT id, loyalty_points FROM clients WHERE phone_norm = ? AND id <> ? LIMIT 1")
      .get(norm, req.clientId);
    if (other && other.id) {
      const current = db.prepare("SELECT id, loyalty_points FROM clients WHERE id = ?").get(req.clientId);
      const tx = db.transaction(() => {
        // Перепривязать данные к текущему клиенту
        db.prepare("UPDATE bookings SET user_id = ? WHERE user_id = ?").run(req.clientId, other.id);
        db.prepare("UPDATE notifications SET client_id = ? WHERE client_id = ?").run(req.clientId, other.id);

        const a = Number(current?.loyalty_points ?? 0) || 0;
        const b = Number(other?.loyalty_points ?? 0) || 0;
        db.prepare("UPDATE clients SET loyalty_points = ? WHERE id = ?").run(Math.max(0, Math.trunc(a + b)), req.clientId);

        // Удалить старый дубль (старое устройство)
        db.prepare("DELETE FROM clients WHERE id = ?").run(other.id);
      });
      try {
        tx();
      } catch (e) {
        console.error("Failed to merge clients by phone:", e);
      }
    }
  }

  if (updates.length === 0) {
    const row = db.prepare('SELECT * FROM clients WHERE id = ?').get(req.clientId);
    if (!row) return res.status(404).json({ error: 'Клиент не найден' });
    return res.json(toUserJSON(row));
  }

  values.push(req.clientId);
  db.prepare(`UPDATE clients SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  const row = db.prepare('SELECT * FROM clients WHERE id = ?').get(req.clientId);
  if (!row) return res.status(404).json({ error: 'Клиент не найден' });
  res.json(toUserJSON(row));
}

function toUserJSON(row) {
  const db = getDb();
  let social = {};
  if (row.social_links) {
    try {
      social = JSON.parse(row.social_links);
    } catch (_) {}
  }
  let avatarUrl = row.avatar_url || null;
  const selectedCarId = row.selected_car_id || null;
  if (selectedCarId) {
    const car = db.prepare('SELECT image_url FROM car_folders WHERE id = ?').get(selectedCarId);
    if (car && car.image_url) avatarUrl = car.image_url;
  }
  return {
    _id: row.id,
    first_name: row.first_name || '',
    last_name: row.last_name || '',
    phone: row.phone || '',
    email: row.email || null,
    avatar_url: avatarUrl,
    selected_car_id: selectedCarId,
    social_links: {
      telegram: social.telegram || null,
      whatsapp: social.whatsapp || null,
      instagram: social.instagram || null,
      vk: social.vk || null,
    },
    created_at: row.created_at,
    loyalty_points: Number(row.loyalty_points || 0) || 0,
  };
}

function normalizePhone(value) {
  return String(value || "").replace(/\D/g, "");
}

function isRealPhone(value) {
  const p = String(value || "").trim();
  if (!p) return false;
  if (p.toLowerCase().startsWith("device:")) return false;
  return normalizePhone(p).length >= 6;
}
