/**
 * API-клиент для веб-приложения (тот же бэкенд, что и iOS).
 * Базовый URL: из window.__API_BASE_URL__ (runtime), иначе VITE_API_BASE_URL (сборка).
 */

function normalizeBaseUrl(value: string): string {
  let s = value.trim().replace(/\/$/, "");
  // иногда по ошибке задают полный /api/v1 — чтобы не получить /api/v1/api/v1
  if (s.endsWith("/api/v1")) s = s.slice(0, -"/api/v1".length);
  return s;
}

function getBaseUrl(): string {
  const win = typeof window !== "undefined" ? (window as Window & { __API_BASE_URL__?: string }) : null;
  const fromWindow = win?.__API_BASE_URL__;
  if (fromWindow && typeof fromWindow === "string") return normalizeBaseUrl(fromWindow);
  const env =
    typeof import.meta !== "undefined" &&
    (import.meta as { env?: { VITE_API_BASE_URL?: string } }).env?.VITE_API_BASE_URL;
  return (env && normalizeBaseUrl(env)) || "";
}

let BASE = getBaseUrl();
export function setApiBaseUrl(url: string) {
  BASE = normalizeBaseUrl(url);
}

const API_PREFIX = "/api/v1";

/** Проверка: ответ не должен быть HTML (иначе запрос ушёл не на API). */
function ensureJsonResponse(text: string): void {
  const trimmed = text.trim();
  if (trimmed.startsWith("<") || trimmed.startsWith("<!")) {
    throw new Error(
      "Сервер вернул страницу вместо данных. Укажите URL бэкенда: положите в корень сайта файл config.json с полем api_base_url (например {\"api_base_url\": \"https://ваш-бэкенд.ru\"}) или соберите приложение с переменной VITE_API_BASE_URL."
    );
  }
}

function getHeaders(apiKey: string | null): HeadersInit {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (apiKey) {
    headers["X-API-Key"] = apiKey;
    headers["Authorization"] = `Bearer ${apiKey}`;
  }
  return headers;
}

async function handleResponse<T>(res: Response): Promise<T> {
  const text = await res.text();
  ensureJsonResponse(text);
  if (!res.ok) {
    let message = res.statusText;
    try {
      const json = JSON.parse(text);
      message = (json as { message?: string }).message ?? (json as { error?: string }).error ?? message;
    } catch {
      // leave message as statusText
    }
    throw new Error(message || `HTTP ${res.status}`);
  }
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

export type ApiKeyGetter = () => string | null;

let apiKeyGetter: ApiKeyGetter = () => null;

export function setApiKeyGetter(getter: ApiKeyGetter) {
  apiKeyGetter = getter;
}

function url(path: string, params?: Record<string, string>): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const full = `${BASE.replace(/\/$/, "")}${API_PREFIX}${normalized}`;
  if (!params || Object.keys(params).length === 0) return full;
  const search = new URLSearchParams(params).toString();
  return `${full}?${search}`;
}

export async function apiGet<T>(path: string, params?: Record<string, string>): Promise<T> {
  const res = await fetch(url(path, params), {
    method: "GET",
    headers: getHeaders(apiKeyGetter()),
  });
  return handleResponse<T>(res);
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(url(path), {
    method: "POST",
    headers: getHeaders(apiKeyGetter()),
    body: body != null ? JSON.stringify(body) : undefined,
  });
  return handleResponse<T>(res);
}

export async function apiPut<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(url(path), {
    method: "PUT",
    headers: getHeaders(apiKeyGetter()),
    body: body != null ? JSON.stringify(body) : undefined,
  });
  return handleResponse<T>(res);
}

export async function apiPatch<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(url(path), {
    method: "PATCH",
    headers: getHeaders(apiKeyGetter()),
    body: body != null ? JSON.stringify(body) : undefined,
  });
  return handleResponse<T>(res);
}

export async function apiDelete(path: string): Promise<void> {
  const res = await fetch(url(path), {
    method: "DELETE",
    headers: getHeaders(apiKeyGetter()),
  });
  const text = await res.text();
  ensureJsonResponse(text);
  if (!res.ok) {
    let message = res.statusText;
    try {
      const json = JSON.parse(text);
      message = (json as { message?: string }).message ?? message;
    } catch {
      //
    }
    throw new Error(message);
  }
}

/** Скачать PDF акта (возвращает blob для сохранения/открытия). */
export async function apiGetBlob(path: string): Promise<Blob> {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const full = `${BASE.replace(/\/$/, "")}${API_PREFIX}${normalized}`;
  const res = await fetch(full, { method: "GET", headers: getHeaders(apiKeyGetter()) });
  if (!res.ok) {
    const text = await res.text();
    ensureJsonResponse(text);
    let message = res.statusText;
    try {
      const json = JSON.parse(text);
      message = (json as { message?: string }).message ?? message;
    } catch {
      //
    }
    throw new Error(message);
  }
  return res.blob();
}

// ——— Конкретные вызовы ———

import type {
  Service,
  Booking,
  CreateBookingRequest,
  TimeSlot,
  Post,
  User,
  RegisterClientResponse,
  UpdateProfileRequest,
  CarFolder,
  Notification,
  ClientNewsItem,
  TelegramWidgetConfigResponse,
  TelegramLoginResponse,
} from "./types";

export async function registerClient(deviceId: string): Promise<RegisterClientResponse> {
  return apiPost<RegisterClientResponse>("/clients/register", {
    device_id: deviceId,
    platform: "web",
    app_version: "1.0",
  });
}

export async function fetchServices(): Promise<Service[]> {
  return apiGet<Service[]>("/services");
}

export async function fetchService(id: string): Promise<Service> {
  return apiGet<Service>(`/services/${id}`);
}

export async function fetchBookings(): Promise<Booking[]> {
  return apiGet<Booking[]>("/bookings");
}

export async function createBooking(req: CreateBookingRequest): Promise<Booking> {
  return apiPost<Booking>("/bookings", req);
}

export async function cancelBooking(id: string): Promise<void> {
  return apiDelete(`/bookings/${id}`);
}

export async function submitRating(bookingId: string, rating: number, comment?: string | null): Promise<void> {
  await apiPost(`/bookings/${bookingId}/rating`, { rating: Math.min(5, Math.max(1, Math.round(rating))), comment: comment ?? null });
}

export async function fetchBookingAct(bookingId: string): Promise<Blob> {
  return apiGetBlob(`/bookings/${bookingId}/act`);
}

export async function fetchSlots(serviceId: string, date: string, postId: string): Promise<TimeSlot[]> {
  return apiGet<TimeSlot[]>("/slots", {
    service_id: serviceId,
    date,
    post_id: postId,
  });
}

export async function fetchPosts(): Promise<Post[]> {
  return apiGet<Post[]>("/posts");
}

export async function fetchProfile(): Promise<User> {
  return apiGet<User>("/profile");
}

export async function updateProfile(req: UpdateProfileRequest): Promise<User> {
  const body: Record<string, unknown> = {};
  if (req.first_name !== undefined) body.first_name = req.first_name;
  if (req.last_name !== undefined) body.last_name = req.last_name;
  if (req.email !== undefined) body.email = req.email;
  if (req.social_links !== undefined) body.social_links = req.social_links;
  if (req.telegram !== undefined) body.telegram = req.telegram;
  if (req.selected_car_id !== undefined) body.selected_car_id = req.selected_car_id ?? null;
  if (req.profile_photo_url !== undefined) body.profile_photo_url = req.profile_photo_url ?? null;
  return apiPut<User>("/profile", Object.keys(body).length ? body : undefined);
}

export async function fetchCars(): Promise<CarFolder[]> {
  return apiGet<CarFolder[]>("/cars/folders");
}

export async function fetchNotifications(): Promise<Notification[]> {
  return apiGet<Notification[]>("/notifications");
}

export async function markNotificationRead(id: string): Promise<void> {
  await apiPatch(`/notifications/${id}/read`, {});
}

// ——— News ———

export async function fetchNews(): Promise<ClientNewsItem[]> {
  return apiGet<ClientNewsItem[]>("/news");
}

// ——— Telegram Login Widget ———

export async function fetchTelegramWidgetConfig(): Promise<TelegramWidgetConfigResponse> {
  return apiGet<TelegramWidgetConfigResponse>("/auth/telegram/widget-config");
}

export async function loginByTelegramWidget(payload: Record<string, unknown>): Promise<TelegramLoginResponse> {
  return apiPost<TelegramLoginResponse>("/auth/login/telegram", payload);
}
