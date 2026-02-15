/**
 * GET /posts - список постов (боксов)
 */
import { getDb } from '../db/index.js';

export function listPosts(req, res) {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM posts ORDER BY id').all();

  const posts = rows.map(r => ({
    _id: r.id,
    name: r.name,
    is_enabled: !!r.is_enabled,
    use_custom_hours: !!r.use_custom_hours,
    start_time: r.start_time || '09:00',
    end_time: r.end_time || '18:00',
    interval_minutes: r.interval_minutes || 30,
  }));

  res.json(posts);
}
