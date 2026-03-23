/**
 * Отправка push-уведомлений через APNs (HTTP/2 + JWT).
 * Переменные окружения: APNS_KEY_ID, APNS_TEAM_ID, APNS_BUNDLE_ID, APNS_KEY_PATH (или APNS_KEY — содержимое .p8).
 */
import http2 from 'http2';
import { readFileSync } from 'fs';
import { SignJWT, importPKCS8 } from 'jose';

const APNS_KEY_ID = process.env.APNS_KEY_ID;
const APNS_TEAM_ID = process.env.APNS_TEAM_ID;
const APNS_BUNDLE_ID = process.env.APNS_BUNDLE_ID;
const APNS_KEY_PATH = process.env.APNS_KEY_PATH;
const APNS_KEY_CONTENT = process.env.APNS_KEY;
const APNS_PRODUCTION = process.env.APNS_PRODUCTION === '1' || process.env.NODE_ENV === 'production';

const APNS_HOST = APNS_PRODUCTION ? 'api.push.apple.com' : 'api.sandbox.push.apple.com';
const JWT_EXPIRY_SEC = 3600;
let cachedJwt = null;
let cachedJwtExp = 0;

/** Содержимое .p8 ключа (PEM PKCS#8) */
function getPemKey() {
  if (APNS_KEY_CONTENT) return APNS_KEY_CONTENT;
  if (APNS_KEY_PATH) return readFileSync(APNS_KEY_PATH, 'utf8');
  return null;
}

export function isConfigured() {
  return !!(APNS_KEY_ID && APNS_TEAM_ID && APNS_BUNDLE_ID && (APNS_KEY_PATH || APNS_KEY_CONTENT));
}

async function getJwt() {
  const now = Math.floor(Date.now() / 1000);
  if (cachedJwt && cachedJwtExp > now + 300) return cachedJwt;
  const pem = getPemKey();
  if (!pem) return null;
  try {
    const privateKey = await importPKCS8(pem, 'ES256');
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'ES256', kid: APNS_KEY_ID })
      .setIssuer(APNS_TEAM_ID)
      .setIssuedAt(now)
      .setExpirationTime(now + JWT_EXPIRY_SEC)
      .sign(privateKey);
    cachedJwt = token;
    cachedJwtExp = now + JWT_EXPIRY_SEC - 300;
    return token;
  } catch (e) {
    console.error('[APNs] JWT error:', e.message);
    return null;
  }
}

/**
 * Отправить push указанному клиенту.
 * @param {object} db - getDb()
 * @param {string} clientId - id из clients
 * @param {{ title?: string, body: string, bookingId?: string }} options
 * @returns {Promise<boolean>} true если отправлено
 */
export async function sendPushToClient(db, clientId, options = {}) {
  if (!isConfigured()) return false;
  const row = db.prepare('SELECT apns_device_token FROM clients WHERE id = ?').get(clientId);
  const token = row?.apns_device_token;
  if (!token || typeof token !== 'string' || !token.trim()) return false;

  const jwt = await getJwt();
  if (!jwt) return false;

  const payload = {
    aps: {
      alert: {
        title: options.title || 'Service Booking',
        body: options.body || '',
      },
      sound: 'default',
      'mutable-content': 1,
    },
  };
  if (options.bookingId) payload.bookingId = options.bookingId;

  return new Promise((resolve) => {
    const client = http2.connect(`https://${APNS_HOST}`);
    const path = `/3/device/${token.trim()}`;
    const headers = {
      ':method': 'POST',
      ':path': path,
      'apns-topic': APNS_BUNDLE_ID,
      'apns-push-type': 'alert',
      'apns-priority': '10',
      'authorization': `bearer ${jwt}`,
      'content-type': 'application/json',
    };
    const req = client.request(headers);
    req.setEncoding('utf8');
    req.write(JSON.stringify(payload));
    req.end();
    req.on('response', (headers) => {
      const status = headers[':status'];
      resolve(status === 200);
      client.close();
    });
    req.on('error', (err) => {
      console.error('[APNs] request error:', err.message);
      resolve(false);
      client.close();
    });
  });
}
