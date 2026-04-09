/**
 * Авторизация клиентского API:
 * - Веб-виджет: Authorization: Bearer <JWT> (typ web, после входа по телефону)
 * - Приложение iOS: X-API-Key или Bearer <api_key>
 */
import { getDb } from '../db/index.js';
import { verifyWebAccessToken, getWebSessionSecret } from '../routes/webAuth.js';

function extractCredentials(req) {
  const auth = typeof req.headers.authorization === 'string' ? req.headers.authorization : '';
  const xApiKey = typeof req.headers['x-api-key'] === 'string' ? req.headers['x-api-key'] : '';
  if (auth.startsWith('Bearer ')) {
    return auth.slice(7).trim();
  }
  if (xApiKey) {
    return xApiKey.trim();
  }
  return '';
}

function looksLikeJwt(s) {
  return typeof s === 'string' && s.startsWith('eyJ') && s.split('.').length === 3;
}

function tryApiKey(req, res, next, apiKey) {
  const db = getDb();
  const client = db.prepare('SELECT id FROM clients WHERE api_key = ?').get(apiKey);
  if (!client) {
    return res.status(401).json({ error: 'Необходима авторизация' });
  }
  req.clientId = client.id;
  req.apiKey = apiKey;
  next();
}

export function requireAuth(req, res, next) {
  const token = extractCredentials(req);
  if (!token) {
    return res.status(401).json({ error: 'Необходима авторизация' });
  }

  if (looksLikeJwt(token)) {
    const secret = getWebSessionSecret();
    if (secret) {
      verifyWebAccessToken(token, secret)
        .then(clientId => {
          if (clientId) {
            req.clientId = clientId;
            req.authViaWebJwt = true;
            next();
            return;
          }
          tryApiKey(req, res, next, token);
        })
        .catch(() => tryApiKey(req, res, next, token));
      return;
    }
  }

  tryApiKey(req, res, next, token);
}
