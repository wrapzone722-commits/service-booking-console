/**
 * Admin API - для админ-панели
 * Простая авторизация: заголовок X-Admin-Key (пароль из настроек)
 */
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/index.js';

const ADMIN_HEADER = 'x-admin-key';

function requireAdmin(req, res, next) {
  const key = req.headers[ADMIN_HEADER];
  const db = getDb();
  const setting = db.prepare("SELECT value FROM settings WHERE key = 'admin_password'").get();
  const expected = setting?.value || 'admin123';
  if (key !== expected) {
    return res.status(401).json({ error: 'Необходима авторизация администратора' });
  }
  next();
}

export function setupAdminRoutes(router) {
  router.use(requireAdmin);

  // === Services ===
  router.get('/services', (req, res) => {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM services ORDER BY category, name').all();
    res.json(rows.map(r => ({ ...r, is_active: !!r.is_active })));
  });

  router.post('/services', (req, res) => {
    const { name, description, price, duration, category, image_url, is_active } = req.body || {};
    if (!name) return res.status(400).json({ error: 'name обязателен' });
    const id = uuidv4();
    const now = new Date().toISOString();
    const db = getDb();
    db.prepare(`
      INSERT INTO services (id, name, description, price, duration, category, image_url, is_active, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, name, description || '', price ?? 0, duration ?? 60, category || '', image_url || null, is_active !== false ? 1 : 0, now);
    const row = db.prepare('SELECT * FROM services WHERE id = ?').get(id);
    res.status(201).json({ ...row, is_active: !!row.is_active });
  });

  router.put('/services/:id', (req, res) => {
    const db = getDb();
    const { name, description, price, duration, category, image_url, is_active } = req.body || {};
    const row = db.prepare('SELECT * FROM services WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Услуга не найдена' });
    db.prepare(`
      UPDATE services SET name=?, description=?, price=?, duration=?, category=?, image_url=?, is_active=?
      WHERE id=?
    `).run(name ?? row.name, description ?? row.description, price ?? row.price, duration ?? row.duration, category ?? row.category, image_url ?? row.image_url, is_active !== false ? 1 : 0, req.params.id);
    const updated = db.prepare('SELECT * FROM services WHERE id = ?').get(req.params.id);
    res.json({ ...updated, is_active: !!updated.is_active });
  });

  router.delete('/services/:id', (req, res) => {
    const db = getDb();
    db.prepare('DELETE FROM services WHERE id = ?').run(req.params.id);
    res.status(204).send();
  });

  // === Bookings (admin) ===
  router.get('/bookings', (req, res) => {
    const db = getDb();
    const { status, date, client_id } = req.query;
    let sql = `
      SELECT b.*, s.name as service_name, c.first_name, c.last_name, c.phone
      FROM bookings b
      JOIN services s ON s.id = b.service_id
      JOIN clients c ON c.id = b.user_id
      WHERE 1=1
    `;
    const params = [];
    if (status) { sql += ' AND b.status = ?'; params.push(status); }
    if (date) { sql += ' AND date(b.date_time) = date(?)'; params.push(date); }
    if (client_id) { sql += ' AND b.user_id = ?'; params.push(client_id); }
    sql += ' ORDER BY b.date_time DESC';
    const rows = db.prepare(sql).all(...params);
    res.json(rows.map(r => ({
      ...r,
      in_progress_started_at: r.in_progress_started_at,
    })));
  });

  router.patch('/bookings/:id/status', (req, res) => {
    const db = getDb();
    const { status } = req.body || {};
    const allowed = ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ error: 'Недопустимый статус' });
    }
    const row = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Запись не найдена' });

    let inProgressStartedAt = row.in_progress_started_at;
    if (status === 'in_progress' && !row.in_progress_started_at) {
      inProgressStartedAt = new Date().toISOString();
      // Сервисное уведомление: «Услуга начата»
      createNotification(db, row.user_id, 'Услуга началась. Следите за прогрессом в приложении.', 'Услуга в процессе', 'service');
    }
    if (status === 'completed') {
      createNotification(db, row.user_id, 'Ваш авто готов. Администратор подтвердил завершение. Можете забирать ключи.', 'Услуга завершена', 'service');
    }
    if (status === 'confirmed') {
      createNotification(db, row.user_id, `Запись на ${row.service_id} подтверждена. Ждём вас в указанное время.`, 'Запись подтверждена', 'service');
    }

    db.prepare('UPDATE bookings SET status = ?, in_progress_started_at = ? WHERE id = ?')
      .run(status, inProgressStartedAt, req.params.id);
    const updated = db.prepare('SELECT b.*, s.name as service_name FROM bookings b JOIN services s ON s.id = b.service_id WHERE b.id = ?').get(req.params.id);
    res.json({
      _id: updated.id,
      status: status,
      in_progress_started_at: inProgressStartedAt,
      service_name: updated.service_name,
    });
  });

  // === Clients ===
  router.get('/clients', (req, res) => {
    const db = getDb();
    const rows = db.prepare('SELECT id, device_id, first_name, last_name, phone, email, created_at FROM clients ORDER BY created_at DESC').all();
    res.json(rows);
  });

  router.get('/clients/:id', (req, res) => {
    const db = getDb();
    const row = db.prepare('SELECT * FROM clients WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Клиент не найден' });
    let social = {};
    if (row.social_links) try { social = JSON.parse(row.social_links); } catch (_) {}
    res.json({ ...row, social_links: social });
  });

  // === Posts ===
  router.get('/posts', (req, res) => {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM posts ORDER BY id').all();
    res.json(rows.map(r => ({ ...r, is_enabled: !!r.is_enabled })));
  });

  router.put('/posts/:id', (req, res) => {
    const db = getDb();
    const { name, is_enabled, start_time, end_time, interval_minutes } = req.body || {};
    const row = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Пост не найден' });
    db.prepare(`
      UPDATE posts SET name=?, is_enabled=?, start_time=?, end_time=?, interval_minutes=?
      WHERE id=?
    `).run(name ?? row.name, is_enabled !== false ? 1 : 0, start_time ?? row.start_time, end_time ?? row.end_time, interval_minutes ?? row.interval_minutes, req.params.id);
    const updated = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id);
    res.json({ ...updated, is_enabled: !!updated.is_enabled });
  });

  // === Notifications - отправка от админа ===
  router.post('/notifications', (req, res) => {
    const { client_id, body, title } = req.body || {};
    if (!client_id || !body) return res.status(400).json({ error: 'client_id и body обязательны' });
    const id = uuidv4();
    const now = new Date().toISOString();
    const db = getDb();
    db.prepare(`
      INSERT INTO notifications (id, client_id, body, title, type, read, created_at)
      VALUES (?, ?, ?, ?, 'admin', 0, ?)
    `).run(id, client_id, body, title || null, now);
    res.status(201).json({ id, body, title, type: 'admin', created_at: now });
  });

  // === Settings ===
  router.get('/settings', (req, res) => {
    const db = getDb();
    const rows = db.prepare('SELECT key, value FROM settings').all();
    const obj = {};
    for (const r of rows) obj[r.key] = r.value;
    res.json(obj);
  });

  router.put('/settings', (req, res) => {
    const db = getDb();
    const { api_base_url, admin_password } = req.body || {};
    if (api_base_url !== undefined) {
      db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('api_base_url', ?)").run(api_base_url);
    }
    if (admin_password !== undefined) {
      db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('admin_password', ?)").run(admin_password);
    }
    const rows = db.prepare('SELECT key, value FROM settings').all();
    const obj = {};
    for (const r of rows) obj[r.key] = r.value;
    res.json(obj);
  });
}

function createNotification(db, clientId, body, title, type) {
  const id = uuidv4();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO notifications (id, client_id, body, title, type, read, created_at)
    VALUES (?, ?, ?, ?, ?, 0, ?)
  `).run(id, clientId, body, title || null, type || 'service', now);
}
