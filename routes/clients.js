/**
 * POST /clients/register - регистрация устройства, получение API-ключа
 */
import { v4 as uuidv4 } from 'uuid';
import { randomBytes } from 'crypto';
import { getDb } from '../db/index.js';

export function registerClient(req, res) {
  const { device_id, platform, app_version } = req.body || {};
  if (!device_id || typeof device_id !== 'string') {
    return res.status(400).json({ error: 'device_id обязателен' });
  }

  const db = getDb();
  const existing = db.prepare('SELECT id, api_key FROM clients WHERE device_id = ?').get(device_id.trim());

  if (existing) {
    return res.json({
      client_id: existing.id,
      api_key: existing.api_key,
    });
  }

  const clientId = uuidv4();
  const apiKey = 'sb_' + randomBytes(24).toString('hex');
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO clients (id, device_id, api_key, platform, app_version, first_name, last_name, phone, created_at)
    VALUES (?, ?, ?, ?, ?, '', '', 'device:' || ?, ?)
  `).run(clientId, device_id.trim(), apiKey, platform || '', app_version || '', device_id.slice(0, 8), now);

  res.json({
    client_id: clientId,
    api_key: apiKey,
  });
}
