/**
 * Shared code between client and server
 * Useful to share types between client and server
 * and/or small pure JS functions that can be used on both client and server
 */

/**
 * Example response type for /api/demo
 */
export interface DemoResponse {
  message: string;
}

// ====== SERVICE MODELS ======
export interface Service {
  _id: string;
  name: string;
  description: string;
  price: number;
  duration: number; // in minutes
  category: string;
  image_url: string | null;
  is_active: boolean;
}

export interface CreateServiceRequest {
  name: string;
  description: string;
  price: number;
  duration: number;
  category: string;
  image_url?: string | null;
  is_active?: boolean;
}

export interface UpdateServiceRequest {
  name?: string;
  description?: string;
  price?: number;
  duration?: number;
  category?: string;
  image_url?: string | null;
  is_active?: boolean;
}

// ====== BOOKING MODELS ======
export type BookingStatus = "pending" | "confirmed" | "in_progress" | "completed" | "cancelled";

export interface Booking {
  _id: string;
  service_id: string;
  service_name: string;
  user_id: string;
  user_name: string;
  post_id?: string;
  date_time: string; // ISO 8601
  status: BookingStatus;
  price: number;
  duration: number;
  notes: string | null;
  created_at: string; // ISO 8601
  /** ISO 8601, когда статус переведён в in_progress (для Live Activity таймера) */
  in_progress_started_at?: string | null;
}

export interface CreateBookingRequest {
  service_id: string;
  date_time: string;
  post_id?: string;
  notes?: string | null;
}

export interface UpdateBookingStatusRequest {
  status: BookingStatus;
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

export interface User {
  _id: string;
  first_name: string;
  last_name: string;
  phone: string;
  email: string | null;
  avatar_url: string | null;
  social_links: SocialLinks;
  created_at: string; // ISO 8601
}

export interface UpdateUserRequest {
  first_name?: string;
  last_name?: string;
  email?: string | null;
  phone?: string;
  avatar_url?: string | null;
  social_links?: SocialLinks;
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
}

// ====== NOTIFICATIONS ======
export type NotificationType = "service" | "admin";

export interface Notification {
  _id: string;
  client_id: string; // user_id клиента
  body: string;
  created_at: string; // ISO 8601
  type: NotificationType;
  title: string | null;
  read: boolean;
}

// ====== ERROR RESPONSE ======
export interface ErrorResponse {
  error: string;
  message: string;
}
