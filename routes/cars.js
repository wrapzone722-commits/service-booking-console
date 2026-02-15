/**
 * GET /cars — список папок автомобилей (названия для выбора клиентом)
 */
import { getDb } from '../db/index.js';

export function listCars(req, res) {
  const db = getDb();
  const rows = db.prepare('SELECT id, name, image_url FROM car_folders ORDER BY sort_order, name').all();

  const cars = rows.map(r => ({
    _id: r.id,
    name: r.name,
    image_url: r.image_url || null,
  }));

  res.json(cars);
}
