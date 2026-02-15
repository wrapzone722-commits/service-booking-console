/**
 * GET /notifications - список уведомлений клиента
 * PATCH /notifications/:id/read - отметить прочитанным
 */
import { getDb } from '../db/index.js';

export function listNotifications(req, res) {
  const db = getDb();
  const rows = db.prepare(`
    SELECT * FROM notifications WHERE client_id = ? ORDER BY created_at DESC
  `).all(req.clientId);

  const list = rows.map(r => ({
    _id: r.id,
    body: r.body,
    created_at: r.created_at,
    type: r.type || 'service',
    title: r.title || null,
    read: !!r.read,
  }));

  res.json(list);
}

export function markRead(req, res) {
  const db = getDb();
  const row = db.prepare('SELECT id FROM notifications WHERE id = ? AND client_id = ?').get(req.params.id, req.clientId);
  if (!row) {
    return res.status(404).json({ error: 'Уведомление не найдено' });
  }
  db.prepare('UPDATE notifications SET read = 1 WHERE id = ?').run(req.params.id);
  res.status(204).send();
}
