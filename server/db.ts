import { Service, Booking, User, Post, PostIntervalMinutes, Account, Notification } from "@shared/api";
import crypto from "crypto";

// Device Connection interface
export interface DeviceConnection {
  _id: string;
  device_id: string; // unique device identifier
  device_name: string; // iOS device name
  client_id?: string; // optional: linked client
  api_token: string; // token for device authentication
  qr_code_data: string; // JSON config encoded in QR
  status: "pending" | "connected" | "inactive"; // connection status
  last_seen: string; // ISO 8601
  created_at: string; // ISO 8601
  expires_at?: string; // optional: expiration date
}

export interface ClientAuth {
  device_id: string;
  client_id: string;
  api_key: string;
  platform: string;
  app_version: string;
  created_at: string; // ISO 8601
  last_seen: string; // ISO 8601
}

// In-memory database (replace with real DB in production)
interface Database {
  services: Map<string, Service>;
  bookings: Map<string, Booking>;
  users: Map<string, User>;
  posts: Map<string, Post>;
  closedSlotsByPost: Map<string, Set<string>>;
  deviceConnections: Map<string, DeviceConnection>;
  clientAuthByDeviceId: Map<string, ClientAuth>;
  clientAuthByApiKey: Map<string, ClientAuth>;
  accounts: Map<string, Account>;
  accountsByEmail: Map<string, Account>;
  accountsByYandexId: Map<string, Account>;
  accountsByTelegramId: Map<string, Account>;
  accountsByPhone: Map<string, Account>;
  working_hours: { start: number; end: number };
  slot_duration: number; // in minutes
  api_base_url: string; // for QR code generation
  telegram_bot_settings: TelegramBotSettings;
  notifications: Map<string, Notification>;
}

export interface TelegramBotSettings {
  enabled: boolean;
  notify_new_booking: boolean;
  notify_booking_cancelled: boolean;
  notify_booking_confirmed: boolean;
  notify_daily_summary: boolean;
  daily_summary_hour: number; // 0-23
  admin_chat_ids: string[]; // Telegram chat IDs for notifications
  reminders_enabled: boolean;
  reminder_hours_before: number[]; // [24, 1] = 24h and 1h before
}

let db: Database = {
  services: new Map(),
  bookings: new Map(),
  users: new Map(),
  posts: new Map(),
  closedSlotsByPost: new Map(),
  deviceConnections: new Map(),
  clientAuthByDeviceId: new Map(),
  clientAuthByApiKey: new Map(),
  accounts: new Map(),
  accountsByEmail: new Map(),
  accountsByYandexId: new Map(),
  accountsByTelegramId: new Map(),
  accountsByPhone: new Map(),
  working_hours: { start: 9, end: 18 },
  slot_duration: 30,
  api_base_url: process.env.API_BASE_URL || "https://www.detailing-studio72.ru/api/v1",
  notifications: new Map(),
  telegram_bot_settings: {
    enabled: false,
    notify_new_booking: true,
    notify_booking_cancelled: true,
    notify_booking_confirmed: false,
    notify_daily_summary: true,
    daily_summary_hour: 9,
    admin_chat_ids: [],
    reminders_enabled: false,
    reminder_hours_before: [24, 1],
  },
};

// База данных стартует пустой (без демо-данных)
// Данные создаются при авторизации пользователей

export function getDb(): Database {
  return db;
}

export function getServices(includeInactive = false): Service[] {
  const all = Array.from(db.services.values());
  return includeInactive ? all : all.filter((s) => s.is_active);
}

export function getService(id: string): Service | null {
  return db.services.get(id) || null;
}

export function createService(data: Omit<Service, "_id">): Service {
  const id = `svc_${Date.now()}`;
  const service: Service = { ...data, _id: id };
  db.services.set(id, service);
  return service;
}

export function updateService(id: string, data: Partial<Service>): Service | null {
  const service = db.services.get(id);
  if (!service) return null;
  const updated = { ...service, ...data, _id: id };
  db.services.set(id, updated);
  return updated;
}

export function deleteService(id: string): boolean {
  return db.services.delete(id);
}

export function getBookings(): Booking[] {
  return Array.from(db.bookings.values()).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

export function getBooking(id: string): Booking | null {
  return db.bookings.get(id) || null;
}

export function createBooking(data: Omit<Booking, "_id" | "created_at">): Booking {
  const id = `bkg_${Date.now()}`;
  const booking: Booking = {
    ...data,
    _id: id,
    created_at: new Date().toISOString(),
  };
  db.bookings.set(id, booking);
  return booking;
}

export function updateBooking(id: string, data: Partial<Booking>): Booking | null {
  const booking = db.bookings.get(id);
  if (!booking) return null;
  const updated = { ...booking, ...data, _id: id };
  db.bookings.set(id, updated);
  return updated;
}

export function deleteBooking(id: string): boolean {
  return db.bookings.delete(id);
}

export function getUsers(): User[] {
  return Array.from(db.users.values()).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

export function getUser(id: string): User | null {
  return db.users.get(id) || null;
}

export function createUser(data: Omit<User, "_id" | "created_at">): User {
  const id = `usr_${Date.now()}`;
  const user: User = {
    ...data,
    _id: id,
    created_at: new Date().toISOString(),
  };
  db.users.set(id, user);
  return user;
}

export function updateUser(id: string, data: Partial<User>): User | null {
  const user = db.users.get(id);
  if (!user) return null;
  const updated = { ...user, ...data, _id: id };
  db.users.set(id, updated);
  return updated;
}

export function getUserByEmail(email: string): User | null {
  for (const user of db.users.values()) {
    if (user.email === email) return user;
  }
  return null;
}

export function registerClientDevice(params: {
  device_id: string;
  platform: string;
  app_version: string;
}): { client_id: string; api_key: string } {
  const existing = db.clientAuthByDeviceId.get(params.device_id);
  if (existing) {
    const updated: ClientAuth = {
      ...existing,
      platform: params.platform,
      app_version: params.app_version,
      last_seen: new Date().toISOString(),
    };
    db.clientAuthByDeviceId.set(params.device_id, updated);
    db.clientAuthByApiKey.set(updated.api_key, updated);
    return { client_id: updated.client_id, api_key: updated.api_key };
  }

  const api_key = crypto.randomBytes(24).toString("hex");
  const client = createUser({
    first_name: "Клиент",
    last_name: params.device_id.slice(0, 6),
    phone: `device:${params.device_id.slice(0, 8)}`,
    email: null,
    avatar_url: null,
    social_links: {},
  });

  const record: ClientAuth = {
    device_id: params.device_id,
    client_id: client._id,
    api_key,
    platform: params.platform,
    app_version: params.app_version,
    created_at: new Date().toISOString(),
    last_seen: new Date().toISOString(),
  };

  db.clientAuthByDeviceId.set(params.device_id, record);
  db.clientAuthByApiKey.set(api_key, record);

  return { client_id: record.client_id, api_key: record.api_key };
}

export function getClientAuthByApiKey(api_key: string): ClientAuth | null {
  return db.clientAuthByApiKey.get(api_key) || null;
}

function hhmmToMinutes(hhmm: string): number {
  const [hStr, mStr] = hhmm.split(":");
  const h = Number(hStr);
  const m = Number(mStr);
  return h * 60 + m;
}

function ensureDefaultPost(): void {
  if (db.posts.has("post_1")) return;
  const post: Post = {
    _id: "post_1",
    name: "Пост 1",
    is_enabled: true,
    use_custom_hours: false,
    start_time: "09:00",
    end_time: "18:00",
    interval_minutes: 30,
  };
  db.posts.set("post_1", post);
}

export function getPosts(): Post[] {
  ensureDefaultPost();
  return Array.from(db.posts.values()).sort((a, b) => a._id.localeCompare(b._id));
}

export function getPost(id: string): Post | null {
  ensureDefaultPost();
  return db.posts.get(id) || null;
}

export function createPost(data: Omit<Post, "_id">): Post {
  const id = `post_${Date.now()}`;
  const post: Post = { ...data, _id: id };
  db.posts.set(id, post);
  return post;
}

export function deletePost(id: string): boolean {
  const post = db.posts.get(id);
  if (!post) return false;
  db.posts.delete(id);
  db.closedSlotsByPost.delete(id);
  return true;
}

export function updatePost(id: string, data: Partial<Post>): Post | null {
  const post = db.posts.get(id);
  if (!post) return null;
  const updated: Post = { ...post, ...data, _id: id };
  db.posts.set(id, updated);
  return updated;
}

export function setPostSlotClosed(post_id: string, time: string, closed: boolean): boolean {
  const post = db.posts.get(post_id);
  if (!post) return false;
  const set = db.closedSlotsByPost.get(post_id) ?? new Set<string>();
  if (closed) set.add(time);
  else set.delete(time);
  db.closedSlotsByPost.set(post_id, set);
  return true;
}

export function isPostSlotClosed(post_id: string, time: string): boolean {
  return db.closedSlotsByPost.get(post_id)?.has(time) ?? false;
}

export function generatePostDaySlots(
  post_id: string,
  date: string
): { time: string; is_closed: boolean }[] {
  const post = db.posts.get(post_id);
  if (!post || !post.is_enabled) return [];

  const [year, month, day] = date.split("-").map(Number);
  const dateObj = new Date(year, month - 1, day);

  // Validate date is today or in future
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (dateObj < today) {
    return [];
  }

  const startMinutes = post.use_custom_hours
    ? hhmmToMinutes(post.start_time)
    : db.working_hours.start * 60;
  const endMinutes = post.use_custom_hours ? hhmmToMinutes(post.end_time) : db.working_hours.end * 60;

  const interval = post.interval_minutes;

  const slots: { time: string; is_closed: boolean }[] = [];
  for (let minutes = startMinutes; minutes < endMinutes; minutes += interval) {
    const hour = Math.floor(minutes / 60);
    const minute = minutes % 60;
    const time = new Date(year, month - 1, day, hour, minute);
    const timeStr = time.toISOString();
    slots.push({ time: timeStr, is_closed: isPostSlotClosed(post_id, timeStr) });
  }

  return slots;
}

export function generateTimeSlots(
  serviceId: string,
  date: string,
  post_id: string = "post_1"
): { time: string; is_available: boolean }[] {
  const service = db.services.get(serviceId);
  if (!service) return [];

  const post = db.posts.get(post_id);
  if (!post || !post.is_enabled) return [];

  const slots = [];
  const [year, month, day] = date.split("-").map(Number);
  const dateObj = new Date(year, month - 1, day);

  // Validate date is today or in future
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (dateObj < today) {
    return [];
  }

  const startMinutes = post.use_custom_hours
    ? hhmmToMinutes(post.start_time)
    : db.working_hours.start * 60;
  const endMinutes = post.use_custom_hours ? hhmmToMinutes(post.end_time) : db.working_hours.end * 60;

  const interval = post.interval_minutes;

  for (let minutes = startMinutes; minutes < endMinutes; minutes += interval) {
    const hour = Math.floor(minutes / 60);
    const minute = minutes % 60;
    const time = new Date(year, month - 1, day, hour, minute);
    const timeStr = time.toISOString();

    const isClosed = isPostSlotClosed(post_id, timeStr);

    // Check if this slot is already booked (for the same post)
    const isBooked = Array.from(db.bookings.values()).some((b) => {
      const bookingPostId = b.post_id ?? "post_1";
      if (bookingPostId !== post_id) return false;
      if (b.service_id !== serviceId || b.status === "cancelled") return false;
      const bookingStart = new Date(b.date_time);
      const bookingEnd = new Date(bookingStart.getTime() + b.duration * 60000);
      const slotStart = time;
      const slotEnd = new Date(slotStart.getTime() + interval * 60000);
      return (
        (slotStart >= bookingStart && slotStart < bookingEnd) ||
        (slotEnd > bookingStart && slotEnd <= bookingEnd) ||
        (slotStart <= bookingStart && slotEnd >= bookingEnd)
      );
    });

    slots.push({
      time: timeStr,
      is_available: !isBooked && !isClosed,
    });
  }

  return slots;
}

// Device Connection Functions
export function getDeviceConnections(): DeviceConnection[] {
  return Array.from(db.deviceConnections.values()).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

export function getDeviceConnection(id: string): DeviceConnection | null {
  return db.deviceConnections.get(id) || null;
}

export function getDeviceConnectionByToken(token: string): DeviceConnection | null {
  for (const conn of db.deviceConnections.values()) {
    if (conn.api_token === token) return conn;
  }
  return null;
}

export function createDeviceConnection(data: Omit<DeviceConnection, "_id" | "created_at">): DeviceConnection {
  const id = `dev_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const connection: DeviceConnection = {
    ...data,
    _id: id,
    created_at: new Date().toISOString(),
    status: "pending",
  };
  db.deviceConnections.set(id, connection);
  return connection;
}

export function updateDeviceConnection(
  id: string,
  data: Partial<DeviceConnection>
): DeviceConnection | null {
  const connection = db.deviceConnections.get(id);
  if (!connection) return null;
  const updated = { ...connection, ...data, _id: id };
  db.deviceConnections.set(id, updated);
  return updated;
}

export function deleteDeviceConnection(id: string): boolean {
  return db.deviceConnections.delete(id);
}

export function linkClientToDevice(deviceId: string, clientId: string): DeviceConnection | null {
  return updateDeviceConnection(deviceId, {
    client_id: clientId,
    status: "connected",
    last_seen: new Date().toISOString(),
  });
}

// Notifications
export function getNotificationsByClientId(clientId: string): Notification[] {
  return Array.from(db.notifications.values())
    .filter((n) => n.client_id === clientId)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export function createNotification(data: {
  client_id: string;
  body: string;
  type: Notification["type"];
  title?: string | null;
  read?: boolean;
}): Notification {
  const id = `ntf_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const notification: Notification = {
    client_id: data.client_id,
    body: data.body,
    type: data.type,
    title: data.title ?? null,
    read: data.read ?? false,
    _id: id,
    created_at: new Date().toISOString(),
  };
  db.notifications.set(id, notification);
  return notification;
}

export function getNotification(id: string): Notification | null {
  return db.notifications.get(id) || null;
}

export function markNotificationRead(id: string): Notification | null {
  const n = db.notifications.get(id);
  if (!n) return null;
  const updated = { ...n, read: true, _id: id };
  db.notifications.set(id, updated);
  return updated;
}

export function getWorkingHours(): { start: number; end: number } {
  return { ...db.working_hours };
}

export function setWorkingHours(start: number, end: number): void {
  db.working_hours.start = Math.max(0, Math.min(23, start));
  db.working_hours.end = Math.max(0, Math.min(24, end));
}

export function getTelegramBotSettings(): TelegramBotSettings {
  return { ...db.telegram_bot_settings, admin_chat_ids: [...db.telegram_bot_settings.admin_chat_ids] };
}

export function updateTelegramBotSettings(data: Partial<TelegramBotSettings>): TelegramBotSettings {
  const s = db.telegram_bot_settings;
  if (data.enabled !== undefined) s.enabled = data.enabled;
  if (data.notify_new_booking !== undefined) s.notify_new_booking = data.notify_new_booking;
  if (data.notify_booking_cancelled !== undefined) s.notify_booking_cancelled = data.notify_booking_cancelled;
  if (data.notify_booking_confirmed !== undefined) s.notify_booking_confirmed = data.notify_booking_confirmed;
  if (data.notify_daily_summary !== undefined) s.notify_daily_summary = data.notify_daily_summary;
  if (data.daily_summary_hour !== undefined) s.daily_summary_hour = Math.max(0, Math.min(23, data.daily_summary_hour));
  if (data.admin_chat_ids !== undefined) s.admin_chat_ids = Array.isArray(data.admin_chat_ids) ? data.admin_chat_ids.filter(Boolean) : [];
  if (data.reminders_enabled !== undefined) s.reminders_enabled = data.reminders_enabled;
  if (data.reminder_hours_before !== undefined) s.reminder_hours_before = Array.isArray(data.reminder_hours_before) ? data.reminder_hours_before : s.reminder_hours_before;
  return getTelegramBotSettings();
}

export function addTelegramAdminChatId(chatId: string): void {
  const ids = db.telegram_bot_settings.admin_chat_ids;
  if (!ids.includes(chatId)) ids.push(chatId);
}

export function getApiBaseUrl(): string {
  return db.api_base_url;
}

export function setApiBaseUrl(url: string): void {
  db.api_base_url = url;
}

/** Получить API URL динамически из запроса (host header) */
export function getApiUrlFromRequest(req: { headers: { host?: string }; protocol?: string; get?: (name: string) => string | undefined }): string {
  // Получаем host из заголовков
  const host = req.get?.("host") || req.headers?.host || "";
  // Определяем протокол (за reverse proxy обычно https)
  const proto = req.get?.("x-forwarded-proto") || req.protocol || "https";
  
  if (host) {
    return `${proto}://${host}/api/v1`;
  }
  // Fallback на статический URL
  return db.api_base_url;
}

// Account/Organization Functions
export function createAccount(data: Omit<Account, "_id" | "created_at" | "updated_at">): Account {
  const id = `acc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const now = new Date().toISOString();

  const account: Account = {
    ...data,
    _id: id,
    created_at: now,
    updated_at: now,
    verified: false,
  };

  db.accounts.set(id, account);
  db.accountsByEmail.set(data.email, account);

  if (data.yandex_id) {
    db.accountsByYandexId.set(data.yandex_id, account);
  }

  if (data.telegram_id) {
    db.accountsByTelegramId.set(data.telegram_id, account);
  }

  if (data.phone) {
    db.accountsByPhone.set(normalizePhone(data.phone), account);
  }

  return account;
}

/** Normalize phone to digits only for lookup (e.g. +7 900 123-45-67 → 79001234567) */
export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

export function getAccount(id: string): Account | null {
  return db.accounts.get(id) || null;
}

export function getAccountByEmail(email: string): Account | null {
  return db.accountsByEmail.get(email.toLowerCase()) || null;
}

export function getAccountByYandexId(yandex_id: string): Account | null {
  return db.accountsByYandexId.get(yandex_id) || null;
}

export function getAccountByTelegramId(telegram_id: string): Account | null {
  return db.accountsByTelegramId.get(telegram_id) || null;
}

export function getAccountByPhone(phone: string): Account | null {
  return db.accountsByPhone.get(normalizePhone(phone)) || null;
}

export function updateAccount(id: string, data: Partial<Account>): Account | null {
  const account = db.accounts.get(id);
  if (!account) return null;

  const updated: Account = { ...account, ...data, _id: id, updated_at: new Date().toISOString() };
  db.accounts.set(id, updated);

  // Update email index if changed
  if (data.email && data.email !== account.email) {
    db.accountsByEmail.delete(account.email);
    db.accountsByEmail.set(data.email.toLowerCase(), updated);
  }

  // Update phone index if changed
  if (data.phone !== undefined && normalizePhone(data.phone) !== (account.phone ? normalizePhone(account.phone) : "")) {
    if (account.phone) db.accountsByPhone.delete(normalizePhone(account.phone));
    db.accountsByPhone.set(normalizePhone(data.phone), updated);
  }

  // Update Yandex ID index if changed
  if (data.yandex_id && data.yandex_id !== account.yandex_id) {
    if (account.yandex_id) {
      db.accountsByYandexId.delete(account.yandex_id);
    }
    db.accountsByYandexId.set(data.yandex_id, updated);
  }

  // Update Telegram ID index if changed
  if (data.telegram_id !== undefined && data.telegram_id !== account.telegram_id) {
    if (account.telegram_id) {
      db.accountsByTelegramId.delete(account.telegram_id);
    }
    if (data.telegram_id) {
      db.accountsByTelegramId.set(data.telegram_id, updated);
    }
  }

  return updated;
}

export function generateVerificationCode(): string {
  // 4-значный цифровой код (1000-9999)
  return String(1000 + crypto.randomInt(9000));
}

export function setVerificationCode(email: string, code: string): boolean {
  const account = getAccountByEmail(email);
  if (!account) return false;

  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + 15); // Valid for 15 minutes

  updateAccount(account._id, {
    verification_code: code,
    verification_expires: expiresAt.toISOString(),
  });

  return true;
}

export function verifyEmail(email: string, code: string): Account | null {
  const account = getAccountByEmail(email);
  if (!account) return null;

  // Check code and expiration
  if (account.verification_code !== code) return null;

  const now = new Date();
  const expires = account.verification_expires ? new Date(account.verification_expires) : null;

  if (!expires || now > expires) return null;

  // Mark as verified
  return updateAccount(account._id, {
    verified: true,
    verification_code: undefined,
    verification_expires: undefined,
  });
}

// Phone verification (temporary passwordless flow)
export function setPhoneVerificationCode(phone: string, code: string): boolean {
  const account = getAccountByPhone(phone);
  if (!account) return false;

  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + 15);

  updateAccount(account._id, {
    verification_code: code,
    verification_expires: expiresAt.toISOString(),
  });

  return true;
}

export function verifyPhone(phone: string, code: string): Account | null {
  const account = getAccountByPhone(phone);
  if (!account) return null;

  if (account.verification_code !== code) return null;

  const now = new Date();
  const expires = account.verification_expires ? new Date(account.verification_expires) : null;
  if (!expires || now > expires) return null;

  // Mark verified and clear code
  return updateAccount(account._id, {
    verified: true,
    verification_code: undefined,
    verification_expires: undefined,
  });
}
