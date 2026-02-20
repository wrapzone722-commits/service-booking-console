/**
 * GET /news - новости для клиента
 *
 * Реализация через рассылку: админ создаёт новость, сервер создаёт notification(type='news')
 * для каждого клиента. В ответе отдаём элементы в формате iOS-модели ClientNewsItem.
 */
import { getDb } from '../db/index.js';

export function listNews(req, res) {
  const db = getDb();

  const rows = db.prepare(`
    SELECT
      n.id as notification_id,
      n.read as read,
      n.created_at as notification_created_at,
      n.title as notification_title,
      n.body as notification_body,
      n.news_id as news_id,
      ne.title as title,
      ne.body as body,
      ne.created_at as created_at,
      ne.published as published
    FROM notifications n
    LEFT JOIN news ne ON ne.id = n.news_id
    WHERE n.client_id = ? AND (n.type = 'news')
    ORDER BY COALESCE(ne.created_at, n.created_at) DESC
  `).all(req.clientId);

  const list = rows.map(r => {
    const id = r.news_id || r.notification_id;
    const title = r.title ?? r.notification_title ?? '';
    const body = r.body ?? r.notification_body ?? '';
    const createdAt = r.created_at ?? r.notification_created_at;
    const published = r.published === null || r.published === undefined ? true : !!r.published;
    return {
      _id: id,
      title,
      body,
      created_at: createdAt,
      published,
      read: !!r.read,
      notification_id: r.notification_id,
    };
  });

  res.json(list);
}

