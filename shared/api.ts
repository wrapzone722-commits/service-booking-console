/**
 * Shared code between client and server
 * Useful to share types between client and server
 * and/or small pure JS functions that can be used on both client and server
 */

// ====== SERVICE MODELS ======
export interface Service {
  _id: string;
  name: string;
  description: string;
  price: number;
  duration: number; // in minutes
  category: string;
  image_url: string | null;
  /** Маленькая миниатюра для списка (80x80, низкое качество) */
  image_thumbnail_url?: string | null;
  is_active: boolean;
}

export interface CreateServiceRequest {
  name: string;
  description: string;
  price: number;
  duration: number;
  category: string;
  image_url?: string | null;
  image_thumbnail_url?: string | null;
  is_active?: boolean;
}

export interface UpdateServiceRequest {
  name?: string;
  description?: string;
  price?: number;
  duration?: number;
  category?: string;
  image_url?: string | null;
  image_thumbnail_url?: string | null;
  is_active?: boolean;
}

// ====== BOOKING MODELS ======
export type BookingStatus = "pending" | "confirmed" | "in_progress" | "completed" | "cancelled";

/** Контроль записи: администратор связывается с клиентом для подтверждения актуальности */
export type BookingControlStatus = "pending" | "confirmed" | "callback" | "no_answer" | "cancelled";

export interface Booking {
  _id: string;
  service_id: string;
  service_name: string;
  user_id: string;
  user_name: string;
  /** Сотрудник, который выполнял работу (для аналитики/актов). Назначается из админки. */
  employee_id?: string | null;
  /** Удобное отображаемое имя (денормализация для UI). */
  employee_name?: string | null;
  post_id?: string;
  date_time: string; // ISO 8601
  status: BookingStatus;
  price: number;
  duration: number;
  notes: string | null;
  created_at: string; // ISO 8601
  /** ISO 8601, когда статус переведён в in_progress (для Live Activity таймера) */
  in_progress_started_at?: string | null;
  /** Оценка от клиента (1–5), после завершения услуги */
  rating?: number | null;
  /** Комментарий к оценке */
  rating_comment?: string | null;
  /** Статус контроля записи (админка) */
  control_status?: BookingControlStatus;
  /** Комментарий администратора после звонка */
  control_comment?: string | null;
  /** Когда обновляли control_status/control_comment */
  control_updated_at?: string | null;
}

export interface CreateBookingRequest {
  service_id: string;
  date_time: string;
  post_id?: string;
  notes?: string | null;
  /** При создании из админки — ID клиента */
  user_id?: string;
}

export interface UpdateBookingStatusRequest {
  status: BookingStatus;
}

export interface AssignBookingEmployeeRequest {
  employee_id: string | null;
}

// ====== POSTS (CAR WASH BAYS) ======
export type PostIntervalMinutes = 30 | 60 | 90 | 120;

export interface Post {
  _id: string;
  name: string;
  is_enabled: boolean;
  use_custom_hours: boolean;
  start_time: string; // HH:MM
  end_time: string; // HH:MM
  interval_minutes: PostIntervalMinutes;
}

// ====== TIME SLOT MODELS ======
export interface TimeSlot {
  id: string;
  time: string; // ISO 8601
  is_available: boolean;
}

// ====== USER/CLIENT MODELS ======
export interface SocialLinks {
  telegram?: string | null;
  whatsapp?: string | null;
  instagram?: string | null;
  vk?: string | null;
}

/** Уровень клиента в программе лояльности: Клиент, Постоянный клиент, Прайд */
export type ClientTier = "client" | "regular" | "pride";

export interface User {
  _id: string;
  first_name: string;
  last_name: string;
  phone: string;
  email: string | null;
  avatar_url: string | null;
  social_links: SocialLinks;
  /** Internal: Telegram private chat id, set after user presses /start in bot */
  telegram_chat_id?: string | null;
  /** When telegram_chat_id was linked (ISO) */
  telegram_linked_at?: string | null;
  /** Доступ к записям: active / inactive */
  status?: "active" | "inactive" | "vip";
  /** Уровень в программе лояльности (Клиент / Постоянный клиент / Прайд) */
  client_tier?: ClientTier;
  /** Накопительные баллы (начисляются за завершённые записи) */
  loyalty_points?: number;
  /** Марка/модель авто для iOS (carMake) */
  car_make?: string | null;
  /** Гос. номер для iOS (carPlate) */
  car_plate?: string | null;
  /** Промокод для iOS */
  promo_code?: string | null;
  created_at: string; // ISO 8601
}

// ====== LOYALTY ======
export type LoyaltyBonusId = "referral" | "review_2gis" | "review_yandex" | "social_checkin";

export interface LoyaltyBonusRule {
  id: LoyaltyBonusId;
  title: string;
  description: string;
  points: number;
  enabled: boolean;
}

export interface LoyaltyRules {
  /** Процент начисления от суммы услуги (например 10 = 10%) */
  earn_percent: number;
  /** Минимальное начисление за завершённую услугу */
  min_earn_points: number;
  /** Бонусы за действия (подтверждение клиент показывает администратору) */
  bonuses: LoyaltyBonusRule[];
  updated_at: string; // ISO
}

export interface UpdateLoyaltyRulesRequest {
  earn_percent?: number;
  min_earn_points?: number;
  bonuses?: LoyaltyBonusRule[];
}

export interface LoyaltyAdjustRequest {
  /** + начислить, - списать */
  delta: number;
  /** Причина (например: "Отзыв 2ГИС") */
  reason: string;
}

export interface LoyaltyTransaction {
  _id: string;
  user_id: string;
  delta: number;
  reason: string;
  created_at: string; // ISO
}


export interface UpdateUserRequest {
  first_name?: string;
  last_name?: string;
  email?: string | null;
  phone?: string;
  avatar_url?: string | null;
  profile_photo_url?: string | null;
  social_links?: SocialLinks;
  status?: "active" | "inactive" | "vip";
  client_tier?: ClientTier;
  loyalty_points?: number;
  /** iOS: марка авто */
  car_make?: string | null;
  /** iOS: гос. номер */
  car_plate?: string | null;
  /** iOS: промокод */
  promo_code?: string | null;
  /** iOS: полное имя (мапится в first_name + last_name) */
  name?: string;
  /** iOS: Telegram (мапится в social_links.telegram) */
  telegram?: string | null;
}

// ====== API CONFIG ======
export interface ApiConfig {
  base_url: string;
  token?: string;
}

// ====== ACCOUNT/ORGANIZATION MODELS ======
export interface Account {
  _id: string;
  name: string; // Organization name
  email: string; // Admin email
  yandex_id?: string; // Yandex OAuth ID
  telegram_id?: string; // Telegram user ID (Login Widget)
  phone?: string;
  website?: string;
  logo_url?: string | null;
  verified: boolean; // Email verified
  verification_code?: string; // For email verification
  verification_expires?: string; // ISO 8601
  qr_code_data?: string; // JSON: { api_url, org_id }
  password_hash?: string; // For phone/email login
  created_at: string; // ISO 8601
  updated_at: string; // ISO 8601

  // Организация — данные для документов (заполняются вручную)
  address?: string; // Адрес (фактический/юридический)
  phone_extra?: string; // Доп. телефон
  inn?: string; // ИНН
  ogrn?: string; // ОГРН/ОГРНИП
  kpp?: string; // КПП
  legal_address?: string; // Юридический адрес
  bank_name?: string; // Название банка
  bank_bik?: string; // БИК
  bank_account?: string; // Расчётный счёт
  director_name?: string; // Директор/руководитель
}

export interface OrganizationUpdateRequest {
  name?: string;
  email?: string;
  phone?: string;
  phone_extra?: string;
  website?: string;
  address?: string;
  legal_address?: string;
  inn?: string;
  ogrn?: string;
  kpp?: string;
  bank_name?: string;
  bank_bik?: string;
  bank_account?: string;
  director_name?: string;
}

// ====== PUBLIC COMPANY INFO (for clients) ======
export interface PublicCompanyInfo {
  name: string;
  phone: string | null;
  phone_extra: string | null;
  email: string | null;
  website: string | null;
  address: string | null;
  legal_address: string | null;
  inn: string | null;
  ogrn: string | null;
  kpp: string | null;
  bank_name: string | null;
  bank_bik: string | null;
  bank_account: string | null;
  director_name: string | null;
}

export interface LoginRequest {
  email?: string;
  password?: string;
  phone?: string;
  yandex_code?: string;
}

export interface LoginByPhoneRequest {
  phone: string;
  password: string;
}

export interface LoginResponse {
  account_id: string;
  email: string;
  name: string;
  verified: boolean;
  session_token: string; // JWT
  requires_verification?: boolean;
}

export interface VerificationRequest {
  code: string;
  email: string;
}

// ====== TELEGRAM BOT ======
export interface TelegramBotSettings {
  enabled: boolean;
  notify_new_booking: boolean;
  notify_booking_cancelled: boolean;
  notify_booking_confirmed: boolean;
  notify_daily_summary: boolean;
  daily_summary_hour: number;
  admin_chat_ids: string[];
  reminders_enabled: boolean;
  reminder_hours_before: number[];
  /** Приветственное сообщение при /start */
  welcome_message: string;
  /** Шаблоны: {{user_name}}, {{service_name}}, {{date_time}}, {{price}}, {{notes}} */
  template_new_booking: string;
  template_booking_cancelled: string;
  template_booking_confirmed: string;
  template_daily_summary: string;
  template_reminder: string;
}

// ====== CARS (AVATARS / PROFILE PHOTOS) ======
export interface CarImage {
  name: string; // e.g. "01.jpg"
  url: string; // full image base64 or URL
  thumbnail_url: string; // thumbnail base64 or URL
}

export interface CarFolder {
  _id: string;
  name: string;
  images: CarImage[];
  /** Имя файла по умолчанию для фото профиля (01.jpg, 01.png и т.д.) */
  default_photo_name: string;
  /** Для превью всегда показывать это фото (файл с именем 01). Заполняется сервером. */
  profile_preview_url?: string;
  /** Миниатюра для превью (фото 01). Заполняется сервером. */
  profile_preview_thumbnail_url?: string;
}

/** Правило отображения фото авто после услуги: 01 → 02 → 03 → 04 по дням */
export interface DisplayPhotoRule {
  /** Дней показывать 01 после посещения (0–3 дня) */
  days_01: number;
  /** Дней показывать 02 после 01 (следующие 2 дня) */
  days_02: number;
  /** Дней показывать 03 после 02 (1 день), затем 04 */
  days_03: number;
}

// ====== NOTIFICATIONS ======
export type NotificationType = "service" | "admin" | "news";

export interface Notification {
  _id: string;
  client_id: string; // user_id клиента
  body: string;
  created_at: string; // ISO 8601
  type: NotificationType;
  title: string | null;
  read: boolean;
  /** Optional: связанная сущность (например новость). */
  entity_type?: "news" | null;
  entity_id?: string | null;
}

// ====== NEWS ======
export interface NewsItem {
  _id: string;
  title: string;
  body: string;
  created_at: string; // ISO 8601
  published: boolean;
}

/** News for a particular client — includes read state via notification. */
export interface ClientNewsItem extends NewsItem {
  read: boolean;
  notification_id: string | null;
}

// ====== EMPLOYEES / SHIFTS ======
export interface Employee {
  _id: string;
  name: string;
  phone?: string | null;
  role?: string | null;
  /** Ставка за час (₽). Если null/undefined — 0. */
  pay_rate_hour?: number | null;
  /** Ставка за выполненную работу/запись (₽). Если null/undefined — 0. */
  pay_rate_work?: number | null;
  is_active: boolean;
  created_at: string; // ISO 8601
}

export interface CreateEmployeeRequest {
  name: string;
  phone?: string | null;
  role?: string | null;
  pay_rate_hour?: number | null;
  pay_rate_work?: number | null;
  is_active?: boolean;
}

export interface UpdateEmployeeRequest {
  name?: string;
  phone?: string | null;
  role?: string | null;
  pay_rate_hour?: number | null;
  pay_rate_work?: number | null;
  is_active?: boolean;
}

export interface Shift {
  _id: string;
  employee_id: string;
  start_iso: string; // ISO 8601
  end_iso: string; // ISO 8601
  notes?: string | null;
  created_at: string; // ISO 8601
}

export interface CreateShiftRequest {
  employee_id: string;
  start_iso: string;
  end_iso: string;
  notes?: string | null;
}

export interface UpdateShiftRequest {
  employee_id?: string;
  start_iso?: string;
  end_iso?: string;
  notes?: string | null;
}

export interface EmployeeAnalyticsRow {
  employee_id: string;
  employee_name: string;
  shifts: number;
  works: number;
  /** Часы смен в периоде (с учётом пересечения диапазона). */
  hours: number;
  /** Начисление (₽) = hours*rate_hour + works*rate_work */
  salary: number;
}

export interface EmployeesAnalyticsResponse {
  from: string;
  to: string;
  rows: EmployeeAnalyticsRow[];
}

export interface EmployeesTimesheetExport {
  from: string;
  to: string;
  generated_at: string;
  employees: Employee[];
  shifts: Shift[];
  analytics: EmployeesAnalyticsResponse;
}

export interface EmployeesImportPayload {
  employees?: Employee[];
  shifts?: Shift[];
}

// ====== ERROR RESPONSE ======
export interface ErrorResponse {
  error: string;
  message: string;
}
