/**
 * GET /services - список активных услуг
 * GET /services/:id - детали услуги
 */
import { getDb } from '../db/index.js';

function isWashServiceLike(row) {
  const cat = String(row.category || '').toLowerCase();
  const name = String(row.name || '').toLowerCase();
  const id = String(row.id || '').toLowerCase();
  return cat.includes('мойк') || name.includes('мойк') || id.includes('wash') || id.includes('moy');
}

function sortServiceRowsWashFirst(rows) {
  return [...rows].sort((a, b) => {
    const wa = isWashServiceLike(a);
    const wb = isWashServiceLike(b);
    if (wa !== wb) return wa ? -1 : 1;
    const c = String(a.category || '').localeCompare(String(b.category || ''), 'ru');
    if (c !== 0) return c;
    return String(a.name || '').localeCompare(String(b.name || ''), 'ru');
  });
}

export function listServices(req, res) {
  const db = getDb();
  const activeOnly = req.query.active !== 'false';
  let rows;
  if (activeOnly) {
    rows = db.prepare('SELECT * FROM services WHERE is_active = 1').all();
  } else {
    rows = db.prepare('SELECT * FROM services').all();
  }

  const services = sortServiceRowsWashFirst(rows).map(toServiceJSON);
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
