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
  const { first_name, last_name, email, social_links } = req.body || {};

  const updates = [];
  const values = [];
  if (first_name !== undefined) { updates.push('first_name = ?'); values.push(first_name); }
  if (last_name !== undefined) { updates.push('last_name = ?'); values.push(last_name); }
  if (email !== undefined) { updates.push('email = ?'); values.push(email); }
  if (req.body && 'selected_car_id' in req.body) {
    updates.push('selected_car_id = ?');
    values.push(req.body.selected_car_id || null);
  }
  if (social_links !== undefined) {
    updates.push('social_links = ?');
    values.push(typeof social_links === 'object' ? JSON.stringify(social_links) : social_links);
  }

  if (updates.length === 0) {
    const row = db.prepare('SELECT * FROM clients WHERE id = ?').get(req.clientId);
    return res.json(toUserJSON(row));
  }

  values.push(req.clientId);
  db.prepare(`UPDATE clients SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  const row = db.prepare('SELECT * FROM clients WHERE id = ?').get(req.clientId);
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
  };
}
