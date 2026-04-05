/**
 * Service Booking Web Console
 * REST API + Admin Panel
 */
import express from 'express';
import cors from 'cors';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { initDatabase } from './db/index.js';
import { requireAuth } from './middleware/auth.js';
import { registerClient } from './routes/clients.js';
import { listServices, getService } from './routes/services.js';
import { listBookings, createBooking, cancelBooking, submitRating } from './routes/bookings.js';
import { listPosts } from './routes/posts.js';
import { getSlots } from './routes/slots.js';
import { getProfile, updateProfile, updatePushToken } from './routes/profile.js';
import { listNotifications, markRead } from './routes/notifications.js';
import { listCars } from './routes/cars.js';
import { listNews } from './routes/news.js';
import { getBookingAct } from './routes/act.js';
import { listRewards, redeemReward } from './routes/rewards.js';
import { submitCandidate } from './routes/candidates.js';
import { setupAdminRoutes } from './routes/admin.js';
import { serveImagePreview } from './routes/imagePreview.js';
import { previewInvite } from './routes/invites.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;

/** Версия в URL CSS/JS админки (сброс кэша CDN/браузера). Переопределите ASSET_VERSION в деплое при любом изменении стилей без смены версии пакета. */
const PKG = JSON.parse(readFileSync(join(__dirname, 'package.json'), 'utf8'));
const ASSET_V = process.env.ASSET_VERSION || PKG.version || '1';

const adminIndexHtml = readFileSync(join(__dirname, 'public', 'admin', 'index.html'), 'utf8').replaceAll(
  '{{ASSET_V}}',
  ASSET_V
);

// Важно для деплоя: вынесите SQLite на постоянный диск/volume и передайте DB_PATH
// (например, /data/service_booking.db). Иначе при пересоздании контейнера данные пропадут.
initDatabase(process.env.DB_PATH || null);

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.set('json spaces', 2);

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
api.put('/profile/push_token', requireAuth, updatePushToken);

api.get('/cars', requireAuth, listCars);

api.get('/notifications', requireAuth, listNotifications);
api.patch('/notifications/:id/read', requireAuth, markRead);

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

app.get('/', (req, res) => {
  res.redirect('/admin');
});

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
  console.log(`
  Service Booking Web Console
  ==========================
  API:      http://localhost:${PORT}/api/v1
  Admin:    http://localhost:${PORT}/admin
  `);
});
