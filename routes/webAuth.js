/**
 * Вход в веб-виджет: телефон + PIN из 4 цифр (без SMS).
 * iOS — по-прежнему X-API-Key. JWT (Bearer) выдаётся после входа/регистрации.
 */
import { v4 as uuidv4 } from 'uuid';
import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';
import { SignJWT, jwtVerify } from 'jose';
import { getDb } from '../db/index.js';

const JWT_ALG = 'HS256';
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const PIN_LEN = 4;
const MAX_PIN_FAILS = 12;
const FAIL_WINDOW_MS = 15 * 60 * 1000;
const MAX_REG_PER_IP_HOUR = 40;

/** key -> { fails: number, resetAt: number } */
const pinFailBuckets = new Map();
const regIpBuckets = new Map();

function bucketFails(key, map) {
  const now = Date.now();
  let e = map.get(key);
  if (!e || now > e.resetAt) {
    e = { fails: 0, resetAt: now + FAIL_WINDOW_MS };
    map.set(key, e);
  }
  return e;
}

function pinFailCount(phoneNorm) {
  const e = pinFailBuckets.get(`pin:${phoneNorm}`);
  if (!e || Date.now() > e.resetAt) return 0;
  return e.fails;
}

function recordPinFailure(phoneNorm) {
  const e = bucketFails(`pin:${phoneNorm}`, pinFailBuckets);
  e.fails += 1;
}

function clearPinFailures(phoneNorm) {
  pinFailBuckets.delete(`pin:${phoneNorm}`);
}

function regIpAllowed(ip) {
  const key = `reg:${ip}`;
  const now = Date.now();
  let e = regIpBuckets.get(key);
  if (!e || now > e.resetAt) {
    e = { count: 0, resetAt: now + 60 * 60 * 1000 };
    regIpBuckets.set(key, e);
  }
  if (e.count >= MAX_REG_PER_IP_HOUR) return false;
  e.count += 1;
  return true;
}

export function getWebSessionSecret() {
  const s = process.env.WEB_SESSION_SECRET?.trim();
  if (s && s.length >= 16) return s;
  if (process.env.NODE_ENV === 'production') return null;
  return 'dev-web-session-secret-min16!!';
}

export function normalizePhoneInput(raw) {
  const d = String(raw || '').replace(/\D/g, '');
  if (!d.length) return { ok: false, error: 'Укажите номер телефона' };
  let n = d;
  if (n.length === 11 && n.startsWith('8')) n = '7' + n.slice(1);
  if (n.length === 10) n = '7' + n;
  if (n.length !== 11 || !n.startsWith('7')) {
    return { ok: false, error: 'Некорректный номер (ожидается российский формат, 10 или 11 цифр)' };
  }
  return { ok: true, phone_norm: n, display: `+${n}` };
}

function validatePin(pin) {
  const p = String(pin || '').replace(/\D/g, '');
  if (p.length !== PIN_LEN) {
    return { ok: false, error: `PIN должен быть ровно ${PIN_LEN} цифры` };
  }
  return { ok: true, pin: p };
}

function hashWebPin(pin) {
  const salt = randomBytes(16);
  const hash = scryptSync(Buffer.from(pin, 'utf8'), salt, 64, SCRYPT_PARAMS);
  return `${salt.toString('base64url')}.${hash.toString('base64url')}`;
}

function verifyWebPin(stored, pin) {
  if (!stored || typeof stored !== 'string' || !stored.includes('.')) return false;
  const i = stored.indexOf('.');
  const saltB64 = stored.slice(0, i);
  const hashB64 = stored.slice(i + 1);
  try {
    const salt = Buffer.from(saltB64, 'base64url');
    const expected = Buffer.from(hashB64, 'base64url');
    const hash = scryptSync(Buffer.from(pin, 'utf8'), salt, 64, SCRYPT_PARAMS);
    if (hash.length !== expected.length) return false;
    return timingSafeEqual(hash, expected);
  } catch {
    return false;
  }
}

function nowIso() {
  return new Date().toISOString();
}

function clientIp(req) {
  const xf = req.headers['x-forwarded-for'];
  if (typeof xf === 'string' && xf.trim()) return xf.split(',')[0].trim().slice(0, 64);
  return (req.socket?.remoteAddress || 'unknown').slice(0, 64);
}

async function signWebToken(clientId, secret) {
  const key = new TextEncoder().encode(secret);
  return new SignJWT({ sb_web: '1' })
    .setSubject(clientId)
    .setProtectedHeader({ alg: JWT_ALG })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(key);
}

function createWebClientWithPin(db, norm, pinHash, firstName) {
  const clientId = uuidv4();
  const apiKey = 'sb_' + randomBytes(24).toString('hex');
  const deviceId = `web:${clientId}`;
  const t = nowIso();
  const fn = firstName && String(firstName).trim() ? String(firstName).trim() : '';
  db.prepare(
    `
    INSERT INTO clients (id, device_id, api_key, platform, app_version, first_name, last_name, phone, phone_norm, loyalty_points, web_pin_hash, created_at)
    VALUES (?, ?, ?, 'web', '', ?, '', ?, ?, 0, ?, ?)
  `
  ).run(clientId, deviceId, apiKey, fn, norm.display, norm.phone_norm, pinHash, t);
  return clientId;
}

/**
 * Регистрация: номер + PIN 4 цифры (без SMS).
 * Если клиент с этим телефоном уже есть с PIN — ошибка.
 * Если клиент есть без PIN (например из приложения) — задаём PIN.
 */
export async function webAuthRegisterPin(req, res) {
  const secret = getWebSessionSecret();
  if (!secret) {
    return res.status(503).json({
      error: 'Веб-вход отключён: задайте WEB_SESSION_SECRET (не короче 16 символов)',
    });
  }

  const { phone, pin, pin_confirm, first_name } = req.body || {};
  const norm = normalizePhoneInput(phone);
  if (!norm.ok) return res.status(400).json({ error: norm.error });

  const pv = validatePin(pin);
  if (!pv.ok) return res.status(400).json({ error: pv.error });
  if (pin_confirm != null && String(pin_confirm).replace(/\D/g, '') !== pv.pin) {
    return res.status(400).json({ error: 'PIN и подтверждение не совпадают' });
  }

  const db = getDb();
  const row = db
    .prepare('SELECT id, web_pin_hash, first_name FROM clients WHERE phone_norm = ? ORDER BY created_at DESC LIMIT 1')
    .get(norm.phone_norm);

  if (row && row.web_pin_hash) {
    return res.status(400).json({
      error: 'Этот номер уже зарегистрирован. Войдите с PIN на вкладке «Вход».',
    });
  }

  if (!regIpAllowed(clientIp(req))) {
    return res.status(429).json({ error: 'Слишком много регистраций с этого адреса. Попробуйте позже.' });
  }

  const pinHash = hashWebPin(pv.pin);
  let clientId;

  if (row) {
    db.prepare('UPDATE clients SET web_pin_hash = ? WHERE id = ?').run(pinHash, row.id);
    if (first_name && String(first_name).trim() && (!row.first_name || !String(row.first_name).trim())) {
      db.prepare('UPDATE clients SET first_name = ? WHERE id = ?').run(String(first_name).trim(), row.id);
    }
    clientId = row.id;
  } else {
    clientId = createWebClientWithPin(db, norm, pinHash, first_name);
  }

  clearPinFailures(norm.phone_norm);
  const access_token = await signWebToken(clientId, secret);
  res.json({
    access_token,
    token_type: 'Bearer',
    expires_in: 60 * 60 * 24 * 30,
    first_visit: true,
  });
}

export async function webAuthLoginPin(req, res) {
  const secret = getWebSessionSecret();
  if (!secret) {
    return res.status(503).json({ error: 'Веб-вход не настроен' });
  }

  const { phone, pin } = req.body || {};
  const norm = normalizePhoneInput(phone);
  if (!norm.ok) return res.status(400).json({ error: norm.error });
  const pv = validatePin(pin);
  if (!pv.ok) return res.status(400).json({ error: pv.error });

  if (pinFailCount(norm.phone_norm) >= MAX_PIN_FAILS) {
    return res.status(429).json({
      error: 'Слишком много неверных попыток. Подождите около 15 минут или запросите помощь администратора.',
    });
  }

  const db = getDb();
  const row = db
    .prepare('SELECT id, web_pin_hash FROM clients WHERE phone_norm = ? ORDER BY created_at DESC LIMIT 1')
    .get(norm.phone_norm);

  const bad = () => {
    recordPinFailure(norm.phone_norm);
    return res.status(400).json({ error: 'Неверный номер или PIN' });
  };

  if (!row || !row.web_pin_hash) {
    return bad();
  }
  if (!verifyWebPin(row.web_pin_hash, pv.pin)) {
    return bad();
  }

  clearPinFailures(norm.phone_norm);
  const access_token = await signWebToken(row.id, secret);
  res.json({
    access_token,
    token_type: 'Bearer',
    expires_in: 60 * 60 * 24 * 30,
    first_visit: false,
  });
}

/**
 * Смена PIN для веб-входа (нужен текущий PIN). Только для клиентов с заданным web_pin_hash.
 */
export function webAuthChangeWebPin(req, res) {
  const { old_pin, pin, pin_confirm } = req.body || {};
  const pvOld = validatePin(old_pin);
  if (!pvOld.ok) return res.status(400).json({ error: pvOld.error });
  const pv = validatePin(pin);
  if (!pv.ok) return res.status(400).json({ error: pv.error });
  const confirm = pin_confirm != null ? String(pin_confirm).replace(/\D/g, '') : pv.pin;
  if (confirm !== pv.pin) {
    return res.status(400).json({ error: 'PIN и подтверждение не совпадают' });
  }

  const db = getDb();
  const row = db.prepare('SELECT web_pin_hash FROM clients WHERE id = ?').get(req.clientId);
  if (!row || !row.web_pin_hash) {
    return res.status(400).json({
      error: 'PIN для сайта не задан — пройдите регистрацию в виджете.',
    });
  }
  if (!verifyWebPin(row.web_pin_hash, pvOld.pin)) {
    return res.status(400).json({ error: 'Неверный текущий PIN' });
  }

  db.prepare('UPDATE clients SET web_pin_hash = ? WHERE id = ?').run(hashWebPin(pv.pin), req.clientId);
  res.json({ ok: true });
}

export async function verifyWebAccessToken(token, secret) {
  if (!token || !secret) return null;
  try {
    const key = new TextEncoder().encode(secret);
    const { payload } = await jwtVerify(token, key, { algorithms: [JWT_ALG] });
    if (payload.sb_web !== '1' || typeof payload.sub !== 'string') return null;
    const db = getDb();
    const row = db.prepare('SELECT id FROM clients WHERE id = ?').get(payload.sub);
    return row ? payload.sub : null;
  } catch {
    return null;
  }
}
