/**
 * Печать ESC/POS на термопринтер по LAN (RAW TCP, обычно порт 9100).
 */
import net from 'net';
import { getDb } from '../db/index.js';
import { buildBookingReceiptEscPos, buildTestReceiptEscPos } from '../services/escposReceipt.js';

function settingGet(db, key, fallback) {
  const r = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  const v = r && r.value != null ? String(r.value).trim() : '';
  return v || fallback;
}

function sendRaw(host, port, buf, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const socket = net.connect({ host, port, timeout: timeoutMs }, () => {
      socket.write(buf, err => {
        if (err) {
          socket.destroy();
          reject(err);
          return;
        }
        socket.end();
      });
    });
    const t = setTimeout(() => {
      socket.destroy();
      reject(new Error('Таймаут подключения к принтеру'));
    }, timeoutMs);
    socket.on('error', e => {
      clearTimeout(t);
      reject(e);
    });
    socket.on('close', () => {
      clearTimeout(t);
      resolve();
    });
  });
}

function friendlyPrintError(e) {
  const msg = e && e.message ? String(e.message) : 'Ошибка сети';
  if (msg.includes('ECONNREFUSED')) {
    return 'Принтер не принимает соединение (проверьте IP и порт 9100, режим RAW/JetDirect)';
  }
  if (msg.includes('ETIMEDOUT') || msg.includes('Таймаут')) {
    return 'Таймаут: сервер консоли должен быть в одной сети с принтером (или доступен маршрут до IP принтера)';
  }
  if (msg.includes('ENOTFOUND')) return 'Неверный адрес принтера';
  return msg;
}

export function registerPrintRoutes(router, requireAdmin) {
  router.get('/printer', requireAdmin, (req, res) => {
    const db = getDb();
    res.json({
      enabled: settingGet(db, 'printer_lan_enabled', '0') === '1',
      host: settingGet(db, 'printer_lan_host', ''),
      port: parseInt(settingGet(db, 'printer_lan_port', '9100'), 10) || 9100,
      header_line: settingGet(db, 'receipt_header_line', 'ДРУГОЕ МЕСТО'),
    });
  });

  router.put('/printer', requireAdmin, (req, res) => {
    const db = getDb();
    const body = req.body || {};
    const upd = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
    if (body.enabled !== undefined) {
      upd.run('printer_lan_enabled', body.enabled === true || body.enabled === '1' || body.enabled === 1 ? '1' : '0');
    }
    if (body.host !== undefined) {
      upd.run('printer_lan_host', String(body.host).trim());
    }
    if (body.port !== undefined) {
      const p = parseInt(body.port, 10);
      upd.run('printer_lan_port', String(Number.isFinite(p) && p > 0 && p < 65536 ? p : 9100));
    }
    if (body.header_line !== undefined) {
      const h = String(body.header_line).trim().slice(0, 80);
      upd.run('receipt_header_line', h || 'Студия');
    }
    const db2 = getDb();
    res.json({
      enabled: settingGet(db2, 'printer_lan_enabled', '0') === '1',
      host: settingGet(db2, 'printer_lan_host', ''),
      port: parseInt(settingGet(db2, 'printer_lan_port', '9100'), 10) || 9100,
      header_line: settingGet(db2, 'receipt_header_line', 'ДРУГОЕ МЕСТО'),
    });
  });

  router.post('/print/test', requireAdmin, async (req, res) => {
    const db = getDb();
    if (settingGet(db, 'printer_lan_enabled', '0') !== '1') {
      return res.status(400).json({ error: 'Включите печать по сети и сохраните настройки' });
    }
    const host = settingGet(db, 'printer_lan_host', '');
    const port = parseInt(settingGet(db, 'printer_lan_port', '9100'), 10) || 9100;
    if (!host) return res.status(400).json({ error: 'Укажите IP-адрес принтера' });
    const header = settingGet(db, 'receipt_header_line', 'ДРУГОЕ МЕСТО');
    const buf = buildTestReceiptEscPos({ headerLine: header });
    try {
      await sendRaw(host, port, buf);
      res.json({ ok: true });
    } catch (e) {
      console.error('print test:', e);
      res.status(502).json({ error: friendlyPrintError(e) });
    }
  });

  router.post('/print/receipt', requireAdmin, async (req, res) => {
    const bookingId = req.body?.booking_id;
    if (!bookingId || typeof bookingId !== 'string') {
      return res.status(400).json({ error: 'booking_id обязателен' });
    }
    const db = getDb();
    if (settingGet(db, 'printer_lan_enabled', '0') !== '1') {
      return res.status(400).json({ error: 'Печать по сети выключена (раздел «Термопринтер»)' });
    }
    const host = settingGet(db, 'printer_lan_host', '');
    const port = parseInt(settingGet(db, 'printer_lan_port', '9100'), 10) || 9100;
    if (!host) return res.status(400).json({ error: 'Укажите IP принтера' });

    const row = db
      .prepare(
        `
      SELECT b.*, s.name as service_name, c.first_name, c.last_name, c.phone
      FROM bookings b
      JOIN services s ON s.id = b.service_id
      JOIN clients c ON c.id = b.user_id
      WHERE b.id = ?
    `
      )
      .get(bookingId);

    if (!row) return res.status(404).json({ error: 'Запись не найдена' });
    if (row.status === 'cancelled') {
      return res.status(400).json({ error: 'Отменённая запись — чек не печатаем' });
    }

    const header = settingGet(db, 'receipt_header_line', 'ДРУГОЕ МЕСТО');
    const buf = buildBookingReceiptEscPos(row, { headerLine: header });
    try {
      await sendRaw(host, port, buf);
      res.json({ ok: true });
    } catch (e) {
      console.error('print receipt:', e);
      res.status(502).json({ error: friendlyPrintError(e) });
    }
  });
}
