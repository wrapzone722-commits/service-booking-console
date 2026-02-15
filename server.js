/**
 * Service Booking Web Console
 * REST API + Admin Panel
 */
import express from 'express';
import cors from 'cors';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { initDatabase } from './db/index.js';
import { requireAuth } from './middleware/auth.js';
import { registerClient } from './routes/clients.js';
import { listServices, getService } from './routes/services.js';
import { listBookings, createBooking, cancelBooking, submitRating } from './routes/bookings.js';
import { listPosts } from './routes/posts.js';
import { getSlots } from './routes/slots.js';
import { getProfile, updateProfile } from './routes/profile.js';
import { listNotifications, markRead } from './routes/notifications.js';
import { listCars } from './routes/cars.js';
import { setupAdminRoutes } from './routes/admin.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;

initDatabase();

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

api.get('/posts', requireAuth, listPosts);
api.get('/slots', requireAuth, getSlots);

api.get('/profile', requireAuth, getProfile);
api.put('/profile', requireAuth, updateProfile);

api.get('/cars', requireAuth, listCars);

api.get('/notifications', requireAuth, listNotifications);
api.patch('/notifications/:id/read', requireAuth, markRead);

app.use('/api/v1', api);

// === Admin API ===
const adminApi = express.Router();
setupAdminRoutes(adminApi);
app.use('/admin/api', adminApi);

// === Static: Admin panel ===
app.use(express.static(join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.redirect('/admin');
});

app.get('/admin', (req, res) => {
  res.sendFile(join(__dirname, 'public', 'admin', 'index.html'));
});

app.get('/admin/*', (req, res) => {
  res.sendFile(join(__dirname, 'public', 'admin', 'index.html'));
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
  Пароль админа по умолчанию: admin123
  (заголовок X-Admin-Key)
  `);
});
