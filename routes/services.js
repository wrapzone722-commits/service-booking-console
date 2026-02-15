/**
 * GET /services - список активных услуг
 * GET /services/:id - детали услуги
 */
import { getDb } from '../db/index.js';

export function listServices(req, res) {
  const db = getDb();
  const activeOnly = req.query.active !== 'false';
  let rows;
  if (activeOnly) {
    rows = db.prepare('SELECT * FROM services WHERE is_active = 1 ORDER BY category, name').all();
  } else {
    rows = db.prepare('SELECT * FROM services ORDER BY category, name').all();
  }

  const services = rows.map(toServiceJSON);
  res.json(services);
}

export function getService(req, res) {
  const db = getDb();
  const row = db.prepare('SELECT * FROM services WHERE id = ?').get(req.params.id);
  if (!row) {
    return res.status(404).json({ error: 'Услуга не найдена' });
  }
  res.json(toServiceJSON(row));
}

function toServiceJSON(row) {
  return {
    _id: row.id,
    name: row.name,
    description: row.description || '',
    price: row.price,
    duration: row.duration,
    category: row.category || '',
    image_url: row.image_url,
    is_active: !!row.is_active,
  };
}
