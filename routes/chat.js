/**
 * Чат клиент ↔ администратор (строки notifications с type admin | client).
 * read: для type=admin — прочитано клиентом; для type=client — просмотрено админом.
 */
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/index.js';

const CHAT_TYPES = "('admin','client')";

function mapRow(r) {
  return {
    _id: r.id,
    id: r.id,
    body: r.body,
    title: r.title || null,
    type: r.type,
    read: !!r.read,
    created_at: r.created_at,
  };
}

export function listChatMessages(req, res) {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT * FROM notifications WHERE client_id = ? AND type IN ${CHAT_TYPES} ORDER BY created_at ASC`
    )
    .all(req.clientId);
  res.json(rows.map(mapRow));
}

export function postChatMessage(req, res) {
  const text = (req.body && req.body.body != null ? String(req.body.body) : '').trim();
  if (!text) return res.status(400).json({ error: 'Текст сообщения обязателен' });
  if (text.length > 8000) return res.status(400).json({ error: 'Сообщение слишком длинное' });

  const id = uuidv4();
  const now = new Date().toISOString();
  const db = getDb();
  db.prepare(
    `INSERT INTO notifications (id, client_id, body, title, type, read, created_at)
     VALUES (?, ?, ?, NULL, 'client', 0, ?)`
  ).run(id, req.clientId, text, now);

  const row = db.prepare('SELECT * FROM notifications WHERE id = ?').get(id);
  res.status(201).json(mapRow(row));
}

/** Отметить все входящие от админа сообщения прочитанными (при открытии чата). */
export function markAdminChatRead(req, res) {
  const db = getDb();
  db.prepare(
    `UPDATE notifications SET read = 1 WHERE client_id = ? AND type = 'admin' AND read = 0`
  ).run(req.clientId);
  res.status(204).send();
}
