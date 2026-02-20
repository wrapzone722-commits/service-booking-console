/**
 * Middleware авторизации API по api_key
 *
 * Поддерживаем оба варианта:
 * - Authorization: Bearer <api_key>
 * - X-API-Key: <api_key>
 *
 * (Некоторые прокси/хостинги могут удалять Authorization, поэтому X-API-Key важен.)
 */
import { getDb } from '../db/index.js';

export function requireAuth(req, res, next) {
  const auth = typeof req.headers.authorization === 'string' ? req.headers.authorization : '';
  const xApiKey = typeof req.headers['x-api-key'] === 'string' ? req.headers['x-api-key'] : '';

  let apiKey = '';
  if (auth.startsWith('Bearer ')) {
    apiKey = auth.slice(7).trim();
  } else if (xApiKey) {
    apiKey = xApiKey.trim();
  }

  if (!apiKey) {
    return res.status(401).json({ error: 'Необходима авторизация' });
  }

  const db = getDb();
  const client = db.prepare('SELECT id FROM clients WHERE api_key = ?').get(apiKey);
  if (!client) {
    return res.status(401).json({ error: 'Необходима авторизация' });
  }

  req.clientId = client.id;
  req.apiKey = apiKey;
  next();
}
