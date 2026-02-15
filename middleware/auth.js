/**
 * Middleware авторизации API по Bearer api_key
 */
import { getDb } from '../db/index.js';

export function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Необходима авторизация' });
  }
  const apiKey = auth.slice(7).trim();
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
