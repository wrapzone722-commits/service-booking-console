/**
 * Admin API - для админ-панели
 * Пароль только для защищённых вкладок (прочие разделы).
 */
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/index.js';
import { getBookingActAdmin } from './act.js';
import { sendPushToClient } from '../services/push.js';
import { serveImagePreview } from './imagePreview.js';
import { listCandidates, updateCandidateStatus, deleteCandidate } from './candidates.js';
import { uploadMiddleware, handleImageUpload } from './uploads.js';

const ADMIN_HEADER = 'x-admin-key';
const ADMIN_PASSWORD = '2300';

function requireAdmin(req, res, next) {
  const key = req.headers[ADMIN_HEADER];
  if (key !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Необходима авторизация администратора' });
  }
  next();
}

export function setupAdminRoutes(router) {
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
    const row = db.prepare('SELECT id, name FROM services WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Услуга не найдена' });

    const { c: bookingCount } = db.prepare('SELECT COUNT(*) as c FROM bookings WHERE service_id = ?').get(req.params.id);
    const force =
      req.query.force === '1' ||
      req.query.force === 'true' ||
      String(req.query.force).toLowerCase() === 'yes';

    if (bookingCount > 0 && !force) {
      return res.status(409).json({
        error: 'CONFLICT_BOOKINGS',
        bookings_count: bookingCount,
        message: `К услуге привязано записей: ${bookingCount}. Повторите удаление с параметром force.`,
      });
    }

    const tx = db.transaction(() => {
      db.prepare('DELETE FROM bookings WHERE service_id = ?').run(req.params.id);
      db.prepare('DELETE FROM services WHERE id = ?').run(req.params.id);
    });
    try {
      tx();
    } catch (e) {
      console.error('delete service:', e);
      return res.status(500).json({ error: 'Не удалось удалить услугу (ограничения БД)' });
    }
    res.status(204).send();
  });

  // === Bookings (admin) ===
  router.get('/bookings', (req, res) => {
    const db = getDb();
    const { status, date, client_id } = req.query;
    let sql = `
      SELECT b.*, s.name as service_name,
        c.first_name, c.last_name, c.phone, c.email, c.social_links,
        c.platform AS client_platform, c.app_version AS client_app_version
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
      createNotification(db, row.user_id, 'Услуга началась. Следите за прогрессом в приложении.', 'Услуга в процессе', 'service');
      sendPushToClient(db, row.user_id, { title: 'Услуга в процессе', body: 'Услуга началась. Следите за прогрессом в приложении.', bookingId: row.id }).catch(() => {});
    }
    if (status === 'completed') {
      createNotification(db, row.user_id, 'Ваш авто готов. Администратор подтвердил завершение. Можете забирать ключи.', 'Услуга завершена', 'service');
      sendPushToClient(db, row.user_id, { title: 'Услуга завершена', body: 'Ваш авто готов. Можете забирать ключи.', bookingId: row.id }).catch(() => {});
      // Начисление баллов лояльности: 10% от суммы, минимум 1 балл.
      // Важно: начисляем только при переходе в completed, чтобы не было двойного начисления.
      if (row.status !== 'completed') {
        const price = Number(row.price || 0) || 0;
        const points = Math.max(1, Math.floor(price * 0.10));
        if (points > 0) {
          db.prepare('UPDATE clients SET loyalty_points = loyalty_points + ? WHERE id = ?').run(points, row.user_id);
        }
      }
    }
    if (status === 'confirmed') {
      createNotification(db, row.user_id, `Запись на ${row.service_id} подтверждена. Ждём вас в указанное время.`, 'Запись подтверждена', 'service');
      sendPushToClient(db, row.user_id, { title: 'Запись подтверждена', body: 'Ждём вас в указанное время.', bookingId: row.id }).catch(() => {});
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

  // === Act (HTML/PDF) ===
  router.get('/bookings/:id/act', getBookingActAdmin);

  // === Clients ===
  router.get('/clients', (req, res) => {
    const db = getDb();
    const rows = db.prepare('SELECT id, device_id, first_name, last_name, phone, email, social_links, loyalty_points, created_at FROM clients ORDER BY created_at DESC').all();
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
    res.json(
      rows.map(r => ({
        ...r,
        is_enabled: !!r.is_enabled,
        use_custom_hours: !!r.use_custom_hours,
      }))
    );
  });

  router.put('/posts/:id', (req, res) => {
    const db = getDb();
    const { name, is_enabled, use_custom_hours, start_time, end_time, interval_minutes } = req.body || {};
    const row = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Пост не найден' });
    const nextCustom =
      use_custom_hours === undefined ? row.use_custom_hours : use_custom_hours ? 1 : 0;
    db.prepare(`
      UPDATE posts SET name=?, is_enabled=?, use_custom_hours=?, start_time=?, end_time=?, interval_minutes=?
      WHERE id=?
    `).run(
      name ?? row.name,
      is_enabled !== false ? 1 : 0,
      nextCustom,
      start_time ?? row.start_time,
      end_time ?? row.end_time,
      interval_minutes ?? row.interval_minutes,
      req.params.id
    );
    const updated = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id);
    res.json({
      ...updated,
      is_enabled: !!updated.is_enabled,
      use_custom_hours: !!updated.use_custom_hours,
    });
  });

  // === Автомобили (папки для выбора в приложении) — только с паролем админки ===
  router.get('/car-folders', requireAdmin, (req, res) => {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM car_folders ORDER BY sort_order ASC, name ASC').all();
    res.json(rows);
  });

  router.post('/car-folders', requireAdmin, (req, res) => {
    const { name, image_url, sort_order } = req.body || {};
    if (!name || typeof name !== 'string') return res.status(400).json({ error: 'name обязателен' });
    const db = getDb();
    const id = uuidv4();
    const now = new Date().toISOString();
    db.prepare(
      'INSERT INTO car_folders (id, name, image_url, sort_order, created_at) VALUES (?,?,?,?,?)'
    ).run(id, name.trim(), image_url || null, sort_order ?? 0, now);
    const row = db.prepare('SELECT * FROM car_folders WHERE id = ?').get(id);
    res.status(201).json(row);
  });

  router.put('/car-folders/:id', requireAdmin, (req, res) => {
    const db = getDb();
    const { name, image_url, sort_order } = req.body || {};
    const row = db.prepare('SELECT * FROM car_folders WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Запись не найдена' });
    const nextName = name !== undefined ? String(name).trim() : row.name;
    if (!nextName) return res.status(400).json({ error: 'name не может быть пустым' });
    db.prepare('UPDATE car_folders SET name=?, image_url=?, sort_order=? WHERE id=?').run(
      nextName,
      image_url !== undefined ? (image_url && String(image_url).trim()) || null : row.image_url,
      sort_order !== undefined ? Number(sort_order) || 0 : row.sort_order,
      req.params.id
    );
    res.json(db.prepare('SELECT * FROM car_folders WHERE id = ?').get(req.params.id));
  });

  router.delete('/car-folders/:id', requireAdmin, (req, res) => {
    const db = getDb();
    const inUse = db.prepare('SELECT COUNT(*) as c FROM clients WHERE selected_car_id = ?').get(req.params.id);
    if (inUse && inUse.c > 0) {
      return res.status(400).json({ error: 'Нельзя удалить: тип выбран у клиентов' });
    }
    db.prepare('DELETE FROM car_folders WHERE id = ?').run(req.params.id);
    res.status(204).send();
  });

  // === News ===
  router.get('/news', (req, res) => {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM news ORDER BY created_at DESC').all();
    res.json(rows.map(r => ({ ...r, published: !!r.published })));
  });

  router.post('/news', (req, res) => {
    const { title, body, published } = req.body || {};
    if (!title || !body) return res.status(400).json({ error: 'title и body обязательны' });
    const db = getDb();
    const id = uuidv4();
    const now = new Date().toISOString();
    const pub = published !== false ? 1 : 0;
    db.prepare('INSERT INTO news (id, title, body, published, created_at) VALUES (?,?,?,?,?)')
      .run(id, title, body, pub, now);

    if (pub === 1) {
      broadcastNews(db, id, title, body, now);
    }

    const row = db.prepare('SELECT * FROM news WHERE id = ?').get(id);
    res.status(201).json({ ...row, published: !!row.published });
  });

  router.put('/news/:id', (req, res) => {
    const db = getDb();
    const { title, body, published } = req.body || {};
    const row = db.prepare('SELECT * FROM news WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Новость не найдена' });

    const nextTitle = title ?? row.title;
    const nextBody = body ?? row.body;
    const nextPublished = published === undefined ? row.published : (published !== false ? 1 : 0);

    db.prepare('UPDATE news SET title=?, body=?, published=? WHERE id=?')
      .run(nextTitle, nextBody, nextPublished, req.params.id);

    // если новость стала опубликованной — разослать тем, кому ещё не разослана
    if (nextPublished === 1) {
      const createdAt = row.created_at;
      broadcastNews(db, req.params.id, nextTitle, nextBody, createdAt);
    }

    const updated = db.prepare('SELECT * FROM news WHERE id = ?').get(req.params.id);
    res.json({ ...updated, published: !!updated.published });
  });

  router.delete('/news/:id', (req, res) => {
    const db = getDb();
    db.prepare('DELETE FROM news WHERE id = ?').run(req.params.id);
    db.prepare("DELETE FROM notifications WHERE news_id = ? AND type = 'news'").run(req.params.id);
    res.status(204).send();
  });

  // === Loyalty rewards (товары и услуги за баллы) ===
  router.get('/rewards', (req, res) => {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM loyalty_rewards ORDER BY sort_order ASC, points_cost ASC, name ASC').all();
    res.json(rows.map(r => ({ ...r, is_active: !!r.is_active })));
  });

  router.post('/rewards', (req, res) => {
    const { name, description, points_cost, image_url, is_active, sort_order } = req.body || {};
    if (!name) return res.status(400).json({ error: 'name обязателен' });
    const id = uuidv4();
    const now = new Date().toISOString();
    const db = getDb();
    db.prepare(`
      INSERT INTO loyalty_rewards (id, name, description, points_cost, image_url, is_active, sort_order, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, name, description || '', points_cost ?? 0, image_url || null, is_active !== false ? 1 : 0, sort_order ?? 0, now);
    const row = db.prepare('SELECT * FROM loyalty_rewards WHERE id = ?').get(id);
    res.status(201).json({ ...row, is_active: !!row.is_active });
  });

  router.put('/rewards/:id', (req, res) => {
    const db = getDb();
    const { name, description, points_cost, image_url, is_active, sort_order } = req.body || {};
    const row = db.prepare('SELECT * FROM loyalty_rewards WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Награда не найдена' });
    db.prepare(`
      UPDATE loyalty_rewards SET name=?, description=?, points_cost=?, image_url=?, is_active=?, sort_order=?
      WHERE id=?
    `).run(name ?? row.name, description ?? row.description, points_cost ?? row.points_cost, image_url ?? row.image_url, is_active !== false ? 1 : 0, sort_order ?? row.sort_order, req.params.id);
    const updated = db.prepare('SELECT * FROM loyalty_rewards WHERE id = ?').get(req.params.id);
    res.json({ ...updated, is_active: !!updated.is_active });
  });

  router.delete('/rewards/:id', (req, res) => {
    const db = getDb();
    db.prepare('DELETE FROM loyalty_rewards WHERE id = ?').run(req.params.id);
    res.status(204).send();
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
    sendPushToClient(db, client_id, { title: title || 'Сообщение', body }).catch(() => {});
    res.status(201).json({ id, body, title, type: 'admin', created_at: now });
  });

  // === Candidates ===
  router.get('/candidates', (req, res) => listCandidates(req, res));
  router.patch('/candidates/:id/status', (req, res) => updateCandidateStatus(req, res));
  router.delete('/candidates/:id', (req, res) => deleteCandidate(req, res));

  // === Settings ===
  router.get('/settings', requireAdmin, (req, res) => {
    const db = getDb();
    const rows = db.prepare('SELECT key, value FROM settings').all();
    const obj = {};
    for (const r of rows) obj[r.key] = r.value;
    res.json(obj);
  });

  /** Превью изображения для админки (сжатие, lazy-load в списках) */
  router.get('/image/preview', requireAdmin, serveImagePreview);

  /** Загрузка изображения (сжатие + сохранение в /uploads/) */
  router.post('/upload/image', requireAdmin, uploadMiddleware, handleImageUpload);

  const SETTINGS_KEYS = [
    'api_base_url',
    'studio_slot_start',
    'studio_slot_end',
    'studio_slot_interval_minutes',
  ];

  router.put('/settings', requireAdmin, (req, res) => {
    const db = getDb();
    const body = req.body || {};
    const upd = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
    for (const key of SETTINGS_KEYS) {
      if (body[key] !== undefined) upd.run(key, String(body[key]));
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

function broadcastNews(db, newsId, title, body, createdAt) {
  const clients = db.prepare('SELECT id FROM clients').all();
  const ins = db.prepare(`
    INSERT INTO notifications (id, client_id, body, title, type, read, created_at, news_id)
    VALUES (?, ?, ?, ?, 'news', 0, ?, ?)
  `);
  const exists = db.prepare(`
    SELECT 1 FROM notifications WHERE client_id = ? AND type = 'news' AND news_id = ? LIMIT 1
  `);
  for (const c of clients) {
    const already = exists.get(c.id, newsId);
    if (already) continue;
    ins.run(uuidv4(), c.id, body, title || null, createdAt || new Date().toISOString(), newsId);
  }
}
