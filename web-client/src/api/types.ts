/** Типы по API консоли (snake_case с сервера). */

export interface Service {
  _id: string;
  name: string;
  description: string;
  price: number;
  duration: number;
  category: string;
  image_url: string | null;
  is_active: boolean;
}

export type BookingStatus = "pending" | "confirmed" | "in_progress" | "completed" | "cancelled";

export interface Booking {
  _id: string;
  service_id: string;
  service_name: string;
  user_id: string;
  user_name?: string;
  post_id?: string;
  date_time: string;
  status: BookingStatus;
  price: number;
  duration: number;
  notes: string | null;
  created_at: string;
  in_progress_started_at?: string | null;
  rating?: number | null;
  rating_comment?: string | null;
}

export interface CreateBookingRequest {
  service_id: string;
  date_time: string;
  post_id?: string;
  notes?: string | null;
}

export interface TimeSlot {
  id: string;
  time: string;
  is_available: boolean;
}

export interface Post {
  _id: string;
  name: string;
  is_enabled: boolean;
  use_custom_hours: boolean;
  start_time: string;
  end_time: string;
  interval_minutes: number;
}

export interface SocialLinks {
  telegram?: string | null;
  vk?: string | null;
  whatsapp?: string | null;
  instagram?: string | null;
}

export interface User {
  _id: string;
  first_name: string;
  last_name: string;
  phone: string;
  email: string | null;
  avatar_url: string | null;
  social_links?: SocialLinks;
  client_tier?: string;
  loyalty_points?: number;
  name?: string;
  profile_photo_url?: string | null;
  display_photo_name?: string;
}

export interface UpdateProfileRequest {
  first_name?: string;
  last_name?: string;
  email?: string | null;
  telegram?: string | null;
  social_links?: SocialLinks;
  selected_car_id?: string | null;
  profile_photo_url?: string | null;
}

export interface CarImage {
  name: string;
  url: string;
  thumbnail_url?: string;
}

export interface CarFolder {
  _id: string;
  name: string;
  images: CarImage[];
  default_photo_name?: string;
  profile_preview_url?: string;
  profile_preview_thumbnail_url?: string;
}

export type NotificationType = "service" | "admin";

export interface Notification {
  _id: string;
  client_id: string;
  body: string;
  created_at: string;
  type: NotificationType;
  title: string | null;
  read: boolean;
}

export interface RegisterClientResponse {
  client_id: string;
  api_key: string;
}

export interface TelegramWidgetConfigResponse {
  bot_username: string;
}

export interface TelegramLoginResponse {
  session_token: string;
  account_id: string;
  email: string;
  name: string;
  verified: boolean;
  requires_verification: boolean;
}
