/**
 * Service Booking Web Console
 * REST API + Admin Panel
 */
import express from 'express';
import cors from 'cors';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import process from 'node:process';
import { initDatabase } from './db/index.js';
import { requireAuth } from './middleware/auth.js';
import { registerClient } from './routes/clients.js';
import { listServices, getService } from './routes/services.js';
import { listBookings, createBooking, cancelBooking, submitRating } from './routes/bookings.js';
import { listPosts } from './routes/posts.js';
import { getSlots } from './routes/slots.js';
import { getProfile, updateProfile, updatePushToken } from './routes/profile.js';
import { listNotifications, markRead } from './routes/notifications.js';
import { listChatMessages, postChatMessage, markAdminChatRead } from './routes/chat.js';
import { listCars } from './routes/cars.js';
import { listNews } from './routes/news.js';
import { getBookingAct } from './routes/act.js';
import { listRewards, redeemReward } from './routes/rewards.js';
import { submitCandidate } from './routes/candidates.js';
import { setupAdminRoutes } from './routes/admin.js';
import { serveImagePreview } from './routes/imagePreview.js';
import { previewInvite } from './routes/invites.js';
import { webAuthRegisterPin, webAuthLoginPin, webAuthChangeWebPin } from './routes/webAuth.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;

/** Версия в URL CSS/JS админки (сброс кэша CDN/браузера). Переопределите ASSET_VERSION в деплое при любом изменении стилей без смены версии пакета. */
const PKG = JSON.parse(readFileSync(join(__dirname, 'package.json'), 'utf8'));
const ASSET_V = process.env.ASSET_VERSION || PKG.version || '1';

const adminIndexHtml = readFileSync(join(__dirname, 'public', 'admin', 'index.html'), 'utf8').replaceAll(
  '{{ASSET_V}}',
  ASSET_V
);

const widgetIndexRaw = readFileSync(join(__dirname, 'public', 'widget', 'index.html'), 'utf8');

/**
 * Публичный базовый URL API (/api/v1) для виджета и /api/v1/web/public-info.
 * PUBLIC_API_BASE в .env — если Host/X-Forwarded за прокси неверны (обязательно с /api/v1).
 */
function normalizePublicApiBaseString(raw) {
  const s = String(raw || '').trim().replace(/\/$/, '');
  if (!s) return '';
  try {
    const url = new URL(s);
    let path = url.pathname.replace(/\/$/, '') || '';
    if (!path) {
      url.pathname = '/api/v1';
      return url.toString().replace(/\/$/, '');
    }
    if (path.toLowerCase() === '/api') {
      url.pathname = '/api/v1';
      return url.toString().replace(/\/$/, '');
    }
    return s;
  } catch {
    return s;
  }
}

function publicApiBaseFromRequest(req) {
  const env = (process.env.PUBLIC_API_BASE || '').trim();
  if (env) return normalizePublicApiBaseString(env);
  const xf = String(req.headers['x-forwarded-proto'] || '')
    .split(',')[0]
    .trim();
  const proto = xf || req.protocol || 'http';
  const host = String(req.get('host') || '')
    .split(',')[0]
    .trim();
  if (!host) return '';
  return normalizePublicApiBaseString(`${proto}://${host}/api/v1`);
}

function sendWidgetIndexHtml(res, req) {
  const apiBase = publicApiBaseFromRequest(req);
  const inject = apiBase
    ? `<script>window.__SERVICE_BOOKING_PUBLIC_API_BASE__=${JSON.stringify(apiBase)};</script>`
    : '';
  const html = widgetIndexRaw.replace('{{WIDGET_API_INJECT}}', inject);
  res.type('html');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.send(html);
}

// Важно для деплоя: вынесите SQLite на постоянный диск/volume и передайте DB_PATH
// (например, /data/service_booking.db). Иначе при пересоздании контейнера данные пропадут.
initDatabase(process.env.DB_PATH || null);

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.set('json spaces', 2);

/**
 * Виджет записи: полные пути на app (до Router), чтобы маршруты не терялись при любой версии Express / порядке middleware.
 */
app.get('/api/v1/web/health', (req, res) => {
  res.json({ ok: true, web_auth: true, version: PKG.version });
});

app.get('/api/v1/web/public-info', (req, res) => {
  const apiBase = publicApiBaseFromRequest(req);
  if (!apiBase) {
    return res.json({ api_base: '', admin_url: '', widget_url: '' });
  }
  const origin = apiBase.replace(/\/api\/v1$/i, '');
  res.json({
    api_base: apiBase,
    admin_url: `${origin}/admin`,
    widget_url: `${origin}/widget/`,
    widget_with_api_param: `${origin}/widget/?api=${encodeURIComponent(apiBase)}`,
  });
});

app.post('/api/v1/web/auth/register-pin', (req, res, next) => {
  webAuthRegisterPin(req, res).catch(next);
});
app.post('/api/v1/web/auth/login-pin', (req, res, next) => {
  webAuthLoginPin(req, res).catch(next);
});

// === API v1 (для iOS) ===
const api = express.Router();

api.post('/clients/register', registerClient);

api.get('/services', requireAuth, listServices);
api.get('/services/:id', requireAuth, getService);

api.get('/bookings', requireAuth, listBookings);
api.post('/bookings', requireAuth, createBooking);
api.delete('/bookings/:id', requireAuth, cancelBooking);
api.post('/bookings/:id/rating', requireAuth, submitRating);
api.get('/bookings/:id/act', requireAuth, getBookingAct);

api.get('/posts', requireAuth, listPosts);
api.get('/slots', requireAuth, getSlots);

api.get('/profile', requireAuth, getProfile);
api.put('/profile', requireAuth, updateProfile);
api.put('/profile/web-pin', requireAuth, webAuthChangeWebPin);
api.put('/profile/push_token', requireAuth, updatePushToken);

api.get('/cars', requireAuth, listCars);

api.get('/notifications', requireAuth, listNotifications);
api.patch('/notifications/:id/read', requireAuth, markRead);

api.get('/chat/messages', requireAuth, listChatMessages);
api.post('/chat/messages', requireAuth, postChatMessage);
api.post('/chat/mark-admin-read', requireAuth, markAdminChatRead);

api.get('/news', requireAuth, listNews);

api.get('/rewards', requireAuth, listRewards);
api.post('/rewards/:id/redeem', requireAuth, redeemReward);

api.post('/candidates', submitCandidate);

/** Публичное превью пригласительного кода (без авторизации, для QR и приложения). */
api.get('/invites/preview', previewInvite);

/** Сжатое превью изображения (экономия трафика в iOS). Тот же хост, что у API, или IMAGE_PREVIEW_HOSTS. */
api.get('/image/preview', requireAuth, serveImagePreview);

app.use('/api/v1', api);

/** Редирект с QR: открыть страницу с подсказкой установить приложение и ввести код. */
app.get('/invite/:code', (req, res) => {
  res.redirect(302, `/invite.html?code=${encodeURIComponent(req.params.code)}`);
});

/** Виджет: HTML с подстановкой API (до static). Важно: сначала `/widget/`, иначе при strict routing=false маршрут `/widget` совпадает с `/widget/` и даёт бесконечный 301. */
app.get('/widget/', (req, res) => {
  sendWidgetIndexHtml(res, req);
});
app.get('/widget/index.html', (req, res) => {
  sendWidgetIndexHtml(res, req);
});
app.get('/widget', (req, res) => {
  res.redirect(301, '/widget/');
});

// === Admin API ===
const adminApi = express.Router();
setupAdminRoutes(adminApi);
app.use('/admin/api', adminApi);

// === Static: Admin panel (CSS/JS без долгого кэша — иначе после деплоя остаётся старый вид) ===
app.use(
  express.static(join(__dirname, 'public'), {
    setHeaders(res, filePath) {
      const norm = filePath.replace(/\\/g, '/');
      if (norm.includes('/admin/') && (norm.endsWith('.css') || norm.endsWith('.js'))) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
      }
    },
  })
);

/** Инструкция / навык OpenClaw (без секретов) — для копирования в workspace ассистента */
app.use(
  '/openclaw',
  express.static(join(__dirname, 'openclaw'), {
    maxAge: '1h',
    setHeaders(res, filePath) {
      if (filePath.endsWith('.md')) {
        res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      }
    },
  })
);

// Главная страница теперь отдаётся из public/index.html (через express.static)

function sendAdminIndex(res) {
  res.type('html');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.send(adminIndexHtml);
}

app.get('/admin', (req, res) => {
  sendAdminIndex(res);
});

app.get('/admin/*', (req, res) => {
  sendAdminIndex(res);
});

// === Error handler ===
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Внутренняя ошибка сервера' });
});

app.listen(PORT, () => {
  const health = `http://127.0.0.1:${PORT}/api/v1/web/health`;
  console.log(`
  Service Booking Web Console  v${PKG.version}
  ===========================================
  Запуск из: ${process.cwd()}
  API:       http://localhost:${PORT}/api/v1
  Проверка:  ${health}  → должен быть JSON с "ok":true
  Admin:     http://localhost:${PORT}/admin
  Widget:    http://localhost:${PORT}/widget/
  Если /web/health даёт 404 — на порту ${PORT} другой процесс. Освободите порт или: PORT=3001 npm run dev
  `);
});
