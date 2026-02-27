-- Service Booking Web Console - Schema

-- Клиенты (зарегистрированные устройства через приложение)
CREATE TABLE IF NOT EXISTS clients (
  id TEXT PRIMARY KEY,
  device_id TEXT UNIQUE NOT NULL,
  api_key TEXT UNIQUE NOT NULL,
  platform TEXT,
  app_version TEXT,
  first_name TEXT DEFAULT '',
  last_name TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  -- Нормализованный телефон (только цифры). Нужен чтобы привязывать баллы к клиенту, а не к device_id
  phone_norm TEXT,
  email TEXT,
  avatar_url TEXT,
  selected_car_id TEXT,
  social_links TEXT, -- JSON: {telegram, whatsapp, instagram, vk}
  -- Баллы лояльности закреплены за клиентом (переносятся при смене устройства по телефону)
  loyalty_points INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

-- Услуги
CREATE TABLE IF NOT EXISTS services (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  price REAL NOT NULL DEFAULT 0,
  duration INTEGER NOT NULL DEFAULT 60,
  category TEXT DEFAULT '',
  image_url TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

-- Посты (боксы)
CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  is_enabled INTEGER NOT NULL DEFAULT 1,
  use_custom_hours INTEGER NOT NULL DEFAULT 0,
  start_time TEXT DEFAULT '09:00',
  end_time TEXT DEFAULT '18:00',
  interval_minutes INTEGER NOT NULL DEFAULT 30,
  created_at TEXT NOT NULL
);

-- Записи
CREATE TABLE IF NOT EXISTS bookings (
  id TEXT PRIMARY KEY,
  service_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  date_time TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  price REAL NOT NULL,
  duration INTEGER NOT NULL,
  notes TEXT,
  post_id TEXT DEFAULT 'post_1',
  created_at TEXT NOT NULL,
  in_progress_started_at TEXT,
  rating INTEGER,
  rating_comment TEXT,
  FOREIGN KEY (service_id) REFERENCES services(id),
  FOREIGN KEY (user_id) REFERENCES clients(id)
);

-- Уведомления
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  body TEXT NOT NULL,
  title TEXT,
  type TEXT NOT NULL DEFAULT 'service',
  news_id TEXT,
  read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  FOREIGN KEY (client_id) REFERENCES clients(id)
);

-- Новости (для вкладки «Новости»; рассылка через notifications(type='news', news_id=...))
CREATE TABLE IF NOT EXISTS news (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  published INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

-- Папки автомобилей (клиент выбирает из списка)
CREATE TABLE IF NOT EXISTS car_folders (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  image_url TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT NOT NULL
);

-- Клиент привязан к выбранному авто
-- selected_car_id в clients

-- Товары и услуги за баллы (обмен в приложении)
CREATE TABLE IF NOT EXISTS loyalty_rewards (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  points_cost INTEGER NOT NULL DEFAULT 0,
  image_url TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT NOT NULL
);

-- История обменов баллов (клиент обменял баллы на награду)
CREATE TABLE IF NOT EXISTS loyalty_redemptions (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  reward_id TEXT NOT NULL,
  points_spent INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (client_id) REFERENCES clients(id),
  FOREIGN KEY (reward_id) REFERENCES loyalty_rewards(id)
);

-- Настройки
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Индексы
CREATE INDEX IF NOT EXISTS idx_bookings_user ON bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_date ON bookings(date_time);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_notifications_client ON notifications(client_id);
CREATE INDEX IF NOT EXISTS idx_notifications_news ON notifications(news_id);
CREATE INDEX IF NOT EXISTS idx_clients_device ON clients(device_id);
CREATE INDEX IF NOT EXISTS idx_clients_api_key ON clients(api_key);
CREATE INDEX IF NOT EXISTS idx_clients_phone_norm ON clients(phone_norm);
CREATE INDEX IF NOT EXISTS idx_news_created ON news(created_at);
CREATE INDEX IF NOT EXISTS idx_loyalty_rewards_active ON loyalty_rewards(is_active);
CREATE INDEX IF NOT EXISTS idx_loyalty_redemptions_client ON loyalty_redemptions(client_id);
