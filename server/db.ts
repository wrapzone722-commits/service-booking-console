import { Service, Booking, User, Post, PostIntervalMinutes, Account, Notification, CarFolder, CarImage, NewsItem, Employee, Shift, LoyaltyRules, LoyaltyTransaction, Candidate, CandidateStatus, QuizAnswer } from "@shared/api";
import type { DisplayPhotoRule } from "@shared/api";
import crypto from "crypto";
import fs from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");
const CAR_FOLDERS_FILE = path.join(DATA_DIR, "car-folders.json");
const DISPLAY_SETTINGS_FILE = path.join(DATA_DIR, "display-settings.json");
const ACCOUNTS_FILE = path.join(DATA_DIR, "accounts.json");
const TELEGRAM_CREDENTIALS_FILE = path.join(DATA_DIR, "telegram-bot.json");
const USERS_FILE = path.join(DATA_DIR, "users.json");
const CLIENT_AUTH_FILE = path.join(DATA_DIR, "client-auth.json");
const EMPLOYEES_FILE = path.join(DATA_DIR, "employees.json");
const SHIFTS_FILE = path.join(DATA_DIR, "shifts.json");
const LOYALTY_RULES_FILE = path.join(DATA_DIR, "loyalty-rules.json");
const LOYALTY_TX_FILE = path.join(DATA_DIR, "loyalty-transactions.json");
const CANDIDATES_FILE = path.join(DATA_DIR, "candidates.json");

type TelegramBotCredentials = {
  bot_token: string;
  bot_username: string | null;
};

const telegramCredentialsStore: TelegramBotCredentials = {
  bot_token: "",
  bot_username: null,
};

const DEFAULT_DISPLAY_PHOTO_RULE: DisplayPhotoRule = {
  days_01: 3,
  days_02: 2,
  days_03: 1,
};

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
  employees: Map<string, Employee>;
  shifts: Map<string, Shift>;
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
  news: Map<string, NewsItem>;
  carFolders: Map<string, CarFolder>;
  loyaltyTransactions: LoyaltyTransaction[];
  candidates: Map<string, Candidate>;
}

export interface TelegramBotSettings {
  enabled: boolean;
  notify_new_booking: boolean;
  notify_booking_cancelled: boolean;
  notify_booking_confirmed: boolean;
  notify_daily_summary: boolean;
  daily_summary_hour: number; // 0-23
  admin_chat_ids: string[];
  reminders_enabled: boolean;
  reminder_hours_before: number[];
  welcome_message: string;
  template_new_booking: string;
  template_booking_cancelled: string;
  template_booking_confirmed: string;
  template_daily_summary: string;
  template_reminder: string;
}

let db: Database = {
  services: new Map(),
  bookings: new Map(),
  users: new Map(),
  employees: new Map(),
  shifts: new Map(),
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
  news: new Map(),
  carFolders: new Map(),
  loyaltyTransactions: [],
  candidates: new Map(),
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
    welcome_message: "👋 Добро пожаловать! Вы подключены к уведомлениям о записях.",
    template_new_booking: "",
    template_booking_cancelled: "",
    template_booking_confirmed: "",
    template_daily_summary: "",
    template_reminder: "",
  },
};

// База данных стартует пустой (без демо-данных)
// Данные создаются при авторизации пользователей

function loadAccountsFromFile(): void {
  try {
    if (!fs.existsSync(ACCOUNTS_FILE)) return;
    const raw = fs.readFileSync(ACCOUNTS_FILE, "utf-8");
    const arr = JSON.parse(raw) as Account[];
    if (!Array.isArray(arr)) return;

    db.accounts.clear();
    db.accountsByEmail.clear();
    db.accountsByYandexId.clear();
    db.accountsByTelegramId.clear();
    db.accountsByPhone.clear();

    for (const acc of arr) {
      if (!acc?._id || !acc.email) continue;
      db.accounts.set(acc._id, acc);
      db.accountsByEmail.set(String(acc.email).trim().toLowerCase(), acc);
      if (acc.yandex_id) db.accountsByYandexId.set(acc.yandex_id, acc);
      if (acc.telegram_id) db.accountsByTelegramId.set(acc.telegram_id, acc);
      if (acc.phone) {
        const p = normalizePhone(acc.phone);
        if (p) db.accountsByPhone.set(p, acc);
      }
    }
  } catch (e) {
    console.error("Failed to load accounts from file:", e);
  }
}

function saveAccountsToFile(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    const arr = Array.from(db.accounts.values());
    fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(arr, null, 2), "utf-8");
  } catch (e) {
    console.error("Failed to save accounts to file:", e);
  }
}

function loadTelegramCredentialsFromFile(): void {
  try {
    if (!fs.existsSync(TELEGRAM_CREDENTIALS_FILE)) return;
    const raw = fs.readFileSync(TELEGRAM_CREDENTIALS_FILE, "utf-8");
    const o = JSON.parse(raw) as Partial<TelegramBotCredentials>;
    if (typeof o.bot_token === "string") telegramCredentialsStore.bot_token = o.bot_token;
    if (o.bot_username === null || typeof o.bot_username === "string") {
      telegramCredentialsStore.bot_username = o.bot_username ?? null;
    }
  } catch (e) {
    console.error("Failed to load telegram bot credentials:", e);
  }
}

function saveTelegramCredentialsToFile(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(TELEGRAM_CREDENTIALS_FILE, JSON.stringify(telegramCredentialsStore, null, 2), "utf-8");
  } catch (e) {
    console.error("Failed to save telegram bot credentials:", e);
  }
}

function loadUsersFromFile(): void {
  try {
    if (!fs.existsSync(USERS_FILE)) return;
    const raw = fs.readFileSync(USERS_FILE, "utf-8");
    const arr = JSON.parse(raw) as User[];
    if (!Array.isArray(arr)) return;
    db.users.clear();
    for (const u of arr) {
      if (!u?._id) continue;
      db.users.set(u._id, u);
    }
  } catch (e) {
    console.error("Failed to load users from file:", e);
  }
}

function saveUsersToFile(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    const arr = Array.from(db.users.values());
    fs.writeFileSync(USERS_FILE, JSON.stringify(arr, null, 2), "utf-8");
  } catch (e) {
    console.error("Failed to save users to file:", e);
  }
}

function loadClientAuthFromFile(): void {
  try {
    if (!fs.existsSync(CLIENT_AUTH_FILE)) return;
    const raw = fs.readFileSync(CLIENT_AUTH_FILE, "utf-8");
    const arr = JSON.parse(raw) as ClientAuth[];
    if (!Array.isArray(arr)) return;
    db.clientAuthByDeviceId.clear();
    db.clientAuthByApiKey.clear();
    for (const a of arr) {
      if (!a?.device_id || !a?.api_key || !a?.client_id) continue;
      db.clientAuthByDeviceId.set(a.device_id, a);
      db.clientAuthByApiKey.set(a.api_key, a);
    }
  } catch (e) {
    console.error("Failed to load client auth from file:", e);
  }
}

function saveClientAuthToFile(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    const arr = Array.from(db.clientAuthByDeviceId.values());
    fs.writeFileSync(CLIENT_AUTH_FILE, JSON.stringify(arr, null, 2), "utf-8");
  } catch (e) {
    console.error("Failed to save client auth to file:", e);
  }
}

function loadEmployeesFromFile(): void {
  try {
    if (!fs.existsSync(EMPLOYEES_FILE)) return;
    const raw = fs.readFileSync(EMPLOYEES_FILE, "utf-8");
    const arr = JSON.parse(raw) as Employee[];
    if (!Array.isArray(arr)) return;
    db.employees.clear();
    for (const e of arr) {
      if (!e?._id || !e?.name) continue;
      const rateHour = e.pay_rate_hour === null || e.pay_rate_hour === undefined ? null : Number(e.pay_rate_hour);
      const rateWork = e.pay_rate_work === null || e.pay_rate_work === undefined ? null : Number(e.pay_rate_work);
      db.employees.set(e._id, {
        ...e,
        is_active: e.is_active ?? true,
        phone: e.phone ?? null,
        role: e.role ?? null,
        pay_rate_hour: Number.isFinite(rateHour as number) ? Math.max(0, rateHour as number) : null,
        pay_rate_work: Number.isFinite(rateWork as number) ? Math.max(0, rateWork as number) : null,
      });
    }
  } catch (e) {
    console.error("Failed to load employees from file:", e);
  }
}

function saveEmployeesToFile(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    const arr = Array.from(db.employees.values());
    fs.writeFileSync(EMPLOYEES_FILE, JSON.stringify(arr, null, 2), "utf-8");
  } catch (e) {
    console.error("Failed to save employees to file:", e);
  }
}

function loadShiftsFromFile(): void {
  try {
    if (!fs.existsSync(SHIFTS_FILE)) return;
    const raw = fs.readFileSync(SHIFTS_FILE, "utf-8");
    const arr = JSON.parse(raw) as Shift[];
    if (!Array.isArray(arr)) return;
    db.shifts.clear();
    for (const s of arr) {
      if (!s?._id || !s?.employee_id || !s?.start_iso || !s?.end_iso) continue;
      db.shifts.set(s._id, { ...s, notes: s.notes ?? null });
    }
  } catch (e) {
    console.error("Failed to load shifts from file:", e);
  }
}

function saveShiftsToFile(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    const arr = Array.from(db.shifts.values());
    fs.writeFileSync(SHIFTS_FILE, JSON.stringify(arr, null, 2), "utf-8");
  } catch (e) {
    console.error("Failed to save shifts to file:", e);
  }
}

// Загрузка папок автомобилей из файла (сохраняются между перезапусками)
function loadCarFoldersFromFile(): void {
  try {
    if (!fs.existsSync(CAR_FOLDERS_FILE)) return;
    const raw = fs.readFileSync(CAR_FOLDERS_FILE, "utf-8");
    const arr = JSON.parse(raw) as CarFolder[];
    if (Array.isArray(arr)) {
      db.carFolders.clear();
      for (const folder of arr) {
        if (folder._id && folder.name && Array.isArray(folder.images)) {
          const f: CarFolder = {
            ...folder,
            default_photo_name: folder.default_photo_name || "01",
          };
          db.carFolders.set(folder._id, f);
        }
      }
    }
  } catch (e) {
    console.error("Failed to load car folders from file:", e);
  }
}

function saveCarFoldersToFile(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    const arr = Array.from(db.carFolders.values());
    fs.writeFileSync(CAR_FOLDERS_FILE, JSON.stringify(arr, null, 2), "utf-8");
  } catch (e) {
    console.error("Failed to save car folders to file:", e);
  }
}

loadAccountsFromFile();
loadTelegramCredentialsFromFile();
loadUsersFromFile();
loadClientAuthFromFile();
loadEmployeesFromFile();
loadShiftsFromFile();
loadCarFoldersFromFile();

const DEFAULT_LOYALTY_RULES: LoyaltyRules = {
  earn_percent: 10,
  min_earn_points: 1,
  bonuses: [
    {
      id: "referral",
      title: "Привёл нового клиента",
      description: "Покажите администратору подтверждение (контакт/запись нового клиента).",
      points: 500,
      enabled: true,
    },
    {
      id: "review_2gis",
      title: "Отзыв в 2ГИС",
      description: "Покажите администратору отзыв в 2ГИС со своего аккаунта.",
      points: 500,
      enabled: true,
    },
    {
      id: "review_yandex",
      title: "Отзыв в Яндекс Картах",
      description: "Покажите администратору отзыв в Яндекс Картах со своего аккаунта.",
      points: 500,
      enabled: true,
    },
    {
      id: "social_checkin",
      title: "Отметка в социальных сетях",
      description: "Покажите администратору публикацию/сторис с отметкой.",
      points: 500,
      enabled: true,
    },
  ],
  updated_at: new Date().toISOString(),
};

let loyaltyRulesStore: LoyaltyRules = { ...DEFAULT_LOYALTY_RULES };

function loadLoyaltyRulesFromFile(): void {
  try {
    if (!fs.existsSync(LOYALTY_RULES_FILE)) return;
    const raw = fs.readFileSync(LOYALTY_RULES_FILE, "utf-8");
    const o = JSON.parse(raw) as Partial<LoyaltyRules>;
    if (typeof o.earn_percent === "number") loyaltyRulesStore.earn_percent = Math.max(0, o.earn_percent);
    if (typeof o.min_earn_points === "number") loyaltyRulesStore.min_earn_points = Math.max(0, o.min_earn_points);
    if (Array.isArray(o.bonuses)) loyaltyRulesStore.bonuses = o.bonuses as LoyaltyRules["bonuses"];
    loyaltyRulesStore.updated_at = typeof o.updated_at === "string" ? o.updated_at : new Date().toISOString();
  } catch (e) {
    console.error("Failed to load loyalty rules:", e);
  }
}

function saveLoyaltyRulesToFile(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(LOYALTY_RULES_FILE, JSON.stringify(loyaltyRulesStore, null, 2), "utf-8");
  } catch (e) {
    console.error("Failed to save loyalty rules:", e);
  }
}

function loadLoyaltyTransactionsFromFile(): void {
  try {
    if (!fs.existsSync(LOYALTY_TX_FILE)) return;
    const raw = fs.readFileSync(LOYALTY_TX_FILE, "utf-8");
    const arr = JSON.parse(raw) as LoyaltyTransaction[];
    if (Array.isArray(arr)) db.loyaltyTransactions = arr;
  } catch (e) {
    console.error("Failed to load loyalty transactions:", e);
  }
}

function saveLoyaltyTransactionsToFile(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(LOYALTY_TX_FILE, JSON.stringify(db.loyaltyTransactions, null, 2), "utf-8");
  } catch (e) {
    console.error("Failed to save loyalty transactions:", e);
  }
}

loadLoyaltyRulesFromFile();
loadLoyaltyTransactionsFromFile();

// ── Candidates persistence ──

function loadCandidatesFromFile(): void {
  try {
    if (fs.existsSync(CANDIDATES_FILE)) {
      const raw = JSON.parse(fs.readFileSync(CANDIDATES_FILE, "utf-8"));
      if (Array.isArray(raw)) {
        for (const c of raw) db.candidates.set(c._id, c);
      }
    }
  } catch { /* first run */ }
}

function saveCandidatesToFile(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(CANDIDATES_FILE, JSON.stringify(Array.from(db.candidates.values()), null, 2));
  } catch (e) {
    console.error("Failed to save candidates:", e);
  }
}

loadCandidatesFromFile();

export function getCandidates(statusFilter?: CandidateStatus): Candidate[] {
  let arr = Array.from(db.candidates.values());
  if (statusFilter) arr = arr.filter((c) => c.status === statusFilter);
  return arr.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export function getCandidate(id: string): Candidate | null {
  return db.candidates.get(id) || null;
}

export function createCandidate(data: {
  full_name: string;
  email: string;
  phone?: string;
  desired_role?: string;
  about?: string;
  quiz_answers?: QuizAnswer[];
}): Candidate {
  const id = `cand_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const answers = Array.isArray(data.quiz_answers) ? data.quiz_answers : [];
  const candidate: Candidate = {
    _id: id,
    full_name: data.full_name.trim(),
    email: data.email.trim(),
    phone: data.phone || "",
    desired_role: data.desired_role || "",
    about: data.about || "",
    quiz_answers: answers,
    quiz_score: answers.filter((a) => a.correct).length,
    quiz_total: answers.length,
    status: "new",
    notes: "",
    created_at: new Date().toISOString(),
  };
  db.candidates.set(id, candidate);
  saveCandidatesToFile();
  return candidate;
}

export function updateCandidateStatus(id: string, status: CandidateStatus, notes?: string): Candidate | null {
  const c = db.candidates.get(id);
  if (!c) return null;
  c.status = status;
  if (notes !== undefined) c.notes = notes;
  saveCandidatesToFile();
  return c;
}

export function deleteCandidate(id: string): boolean {
  const ok = db.candidates.delete(id);
  if (ok) saveCandidatesToFile();
  return ok;
}

export function getLoyaltyRules(): LoyaltyRules {
  return { ...loyaltyRulesStore, bonuses: Array.isArray(loyaltyRulesStore.bonuses) ? [...loyaltyRulesStore.bonuses] : [] };
}

export function setLoyaltyRules(patch: Partial<LoyaltyRules>): LoyaltyRules {
  if (patch.earn_percent !== undefined) loyaltyRulesStore.earn_percent = Math.max(0, Number(patch.earn_percent) || 0);
  if (patch.min_earn_points !== undefined) loyaltyRulesStore.min_earn_points = Math.max(0, Number(patch.min_earn_points) || 0);
  if (patch.bonuses !== undefined && Array.isArray(patch.bonuses)) loyaltyRulesStore.bonuses = patch.bonuses as LoyaltyRules["bonuses"];
  loyaltyRulesStore.updated_at = new Date().toISOString();
  saveLoyaltyRulesToFile();
  return getLoyaltyRules();
}

export function adjustLoyaltyPoints(userId: string, delta: number, reason: string): { user: User | null; tx: LoyaltyTransaction | null } {
  const user = db.users.get(userId);
  if (!user) return { user: null, tx: null };
  const current = Number.isFinite(Number(user.loyalty_points)) ? Number(user.loyalty_points) : 0;
  const d = Number(delta);
  const safeDelta = Number.isFinite(d) ? Math.trunc(d) : 0;
  if (safeDelta === 0) return { user: updateUser(userId, { loyalty_points: current }), tx: null };
  const next = Math.max(0, current + safeDelta);
  const updated = updateUser(userId, { loyalty_points: next });
  const tx: LoyaltyTransaction = {
    _id: `lxt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    user_id: userId,
    delta: safeDelta,
    reason: String(reason || "").trim() || "Adjustment",
    created_at: new Date().toISOString(),
  };
  db.loyaltyTransactions.unshift(tx);
  // keep last 2000 to avoid unbounded growth
  if (db.loyaltyTransactions.length > 2000) db.loyaltyTransactions.length = 2000;
  saveLoyaltyTransactionsToFile();
  return { user: updated, tx };
}

export function getLoyaltyTransactionsByUser(userId: string, limit = 50): LoyaltyTransaction[] {
  return db.loyaltyTransactions.filter((t) => t.user_id === userId).slice(0, Math.max(1, Math.min(200, limit)));
}

function loadDisplaySettingsFromFile(): void {
  try {
    if (!fs.existsSync(DISPLAY_SETTINGS_FILE)) return;
    const raw = fs.readFileSync(DISPLAY_SETTINGS_FILE, "utf-8");
    const o = JSON.parse(raw) as { display_photo_rule?: DisplayPhotoRule };
    if (o?.display_photo_rule) {
      displayPhotoRuleStore.days_01 = Math.max(0, Number(o.display_photo_rule.days_01) ?? 3);
      displayPhotoRuleStore.days_02 = Math.max(0, Number(o.display_photo_rule.days_02) ?? 2);
      displayPhotoRuleStore.days_03 = Math.max(0, Number(o.display_photo_rule.days_03) ?? 1);
    }
  } catch (e) {
    console.error("Failed to load display settings:", e);
  }
}

function saveDisplaySettingsToFile(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(
      DISPLAY_SETTINGS_FILE,
      JSON.stringify({ display_photo_rule: displayPhotoRuleStore }, null, 2),
      "utf-8"
    );
  } catch (e) {
    console.error("Failed to save display settings:", e);
  }
}

const displayPhotoRuleStore: DisplayPhotoRule = { ...DEFAULT_DISPLAY_PHOTO_RULE };
loadDisplaySettingsFromFile();

export function getDisplayPhotoRule(): DisplayPhotoRule {
  return { ...displayPhotoRuleStore };
}

export function setDisplayPhotoRule(rule: Partial<DisplayPhotoRule>): DisplayPhotoRule {
  if (rule.days_01 !== undefined) displayPhotoRuleStore.days_01 = Math.max(0, rule.days_01);
  if (rule.days_02 !== undefined) displayPhotoRuleStore.days_02 = Math.max(0, rule.days_02);
  if (rule.days_03 !== undefined) displayPhotoRuleStore.days_03 = Math.max(0, rule.days_03);
  saveDisplaySettingsToFile();
  return getDisplayPhotoRule();
}

/** Дата последней завершённой записи клиента (ISO строка или null) */
export function getLastCompletedBookingDateForClient(clientId: string): string | null {
  const completed = Array.from(db.bookings.values()).filter(
    (b) => b.user_id === clientId && b.status === "completed"
  );
  if (completed.length === 0) return null;
  completed.sort((a, b) => new Date(b.date_time).getTime() - new Date(a.date_time).getTime());
  return completed[0].date_time;
}

const DISPLAY_PHOTO_ORDER = ["01", "02", "03", "04"];

/** По правилу и количеству дней с последней услуги вернуть имя файла (01/02/03/04) */
export function getDisplayPhotoNameByRule(daysSinceCompleted: number): string {
  const rule = displayPhotoRuleStore;
  let day = 0;
  if (daysSinceCompleted < day + rule.days_01) return "01";
  day += rule.days_01;
  if (daysSinceCompleted < day + rule.days_02) return "02";
  day += rule.days_02;
  if (daysSinceCompleted < day + rule.days_03) return "03";
  return "04";
}

/** Из списка имён файлов папки (с любым расширением .jpg, .png и т.д.) выбрать подходящее по базовому имени: предпочитаем preferredName, иначе 01→02→03→04 */
export function pickDisplayPhotoFromAvailable(availableBaseNames: string[], preferredName: string): string {
  const normalized = availableBaseNames.map((n) => String(n).replace(/\.[^/.]+$/, "").trim().toLowerCase());
  const preferred = preferredName.trim().toLowerCase();
  if (normalized.includes(preferred)) return preferredName;
  const idx = DISPLAY_PHOTO_ORDER.indexOf(preferredName);
  for (let i = idx >= 0 ? idx : DISPLAY_PHOTO_ORDER.length - 1; i >= 0; i--) {
    if (normalized.includes(DISPLAY_PHOTO_ORDER[i].toLowerCase())) return DISPLAY_PHOTO_ORDER[i];
  }
  return normalized[0] ?? "01";
}

export function getDb(): Database {
  return db;
}

export function getServices(includeInactive = false): Service[] {
  ensureDefaultService();
  const all = Array.from(db.services.values());
  return includeInactive ? all : all.filter((s) => s.is_active);
}

export function getService(id: string): Service | null {
  ensureDefaultService();
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

// ====== EMPLOYEES ======
export function getEmployees(includeInactive = false): Employee[] {
  const all = Array.from(db.employees.values());
  const filtered = includeInactive ? all : all.filter((e) => e.is_active);
  return filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export function getEmployee(id: string): Employee | null {
  return db.employees.get(id) || null;
}

export function createEmployee(data: Omit<Employee, "_id" | "created_at">): Employee {
  const id = `emp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const rateHour = data.pay_rate_hour === null || data.pay_rate_hour === undefined ? null : Number(data.pay_rate_hour);
  const rateWork = data.pay_rate_work === null || data.pay_rate_work === undefined ? null : Number(data.pay_rate_work);
  const employee: Employee = {
    ...data,
    _id: id,
    created_at: new Date().toISOString(),
    is_active: data.is_active ?? true,
    phone: data.phone ?? null,
    role: data.role ?? null,
    pay_rate_hour: Number.isFinite(rateHour as number) ? Math.max(0, rateHour as number) : null,
    pay_rate_work: Number.isFinite(rateWork as number) ? Math.max(0, rateWork as number) : null,
  };
  db.employees.set(id, employee);
  saveEmployeesToFile();
  return employee;
}

export function updateEmployee(id: string, data: Partial<Employee>): Employee | null {
  const employee = db.employees.get(id);
  if (!employee) return null;
  const rateHour =
    data.pay_rate_hour === undefined ? undefined : data.pay_rate_hour === null ? null : Number(data.pay_rate_hour);
  const rateWork =
    data.pay_rate_work === undefined ? undefined : data.pay_rate_work === null ? null : Number(data.pay_rate_work);
  const updated: Employee = {
    ...employee,
    ...data,
    _id: id,
    phone: data.phone === undefined ? employee.phone ?? null : data.phone,
    role: data.role === undefined ? employee.role ?? null : data.role,
    is_active: data.is_active === undefined ? employee.is_active : data.is_active,
    pay_rate_hour:
      rateHour === undefined
        ? employee.pay_rate_hour ?? null
        : rateHour === null
          ? null
          : Number.isFinite(rateHour)
            ? Math.max(0, rateHour)
            : employee.pay_rate_hour ?? null,
    pay_rate_work:
      rateWork === undefined
        ? employee.pay_rate_work ?? null
        : rateWork === null
          ? null
          : Number.isFinite(rateWork)
            ? Math.max(0, rateWork)
            : employee.pay_rate_work ?? null,
  };
  db.employees.set(id, updated);
  saveEmployeesToFile();
  return updated;
}

export function replaceEmployees(employees: Employee[]): void {
  db.employees.clear();
  for (const e of employees) {
    if (!e?._id || !e?.name) continue;
    db.employees.set(e._id, {
      ...e,
      is_active: e.is_active ?? true,
      phone: e.phone ?? null,
      role: e.role ?? null,
      pay_rate_hour: e.pay_rate_hour === undefined ? null : e.pay_rate_hour,
      pay_rate_work: e.pay_rate_work === undefined ? null : e.pay_rate_work,
    });
  }
  saveEmployeesToFile();
}

export function replaceShifts(shifts: Shift[]): void {
  db.shifts.clear();
  for (const s of shifts) {
    if (!s?._id || !s?.employee_id || !s?.start_iso || !s?.end_iso) continue;
    db.shifts.set(s._id, { ...s, notes: s.notes ?? null });
  }
  saveShiftsToFile();
}

export function deleteEmployee(id: string): boolean {
  const ok = db.employees.delete(id);
  if (ok) {
    // каскадно удаляем смены сотрудника
    for (const s of Array.from(db.shifts.values())) {
      if (s.employee_id === id) db.shifts.delete(s._id);
    }
    saveEmployeesToFile();
    saveShiftsToFile();
  }
  return ok;
}

// ====== SHIFTS ======
export function getShifts(params?: { from?: string; to?: string; employee_id?: string }): Shift[] {
  const fromMs = params?.from ? new Date(params.from).getTime() : null;
  const toMs = params?.to ? new Date(params.to).getTime() : null;
  const employeeId = params?.employee_id ?? null;
  const all = Array.from(db.shifts.values()).filter((s) => {
    if (employeeId && s.employee_id !== employeeId) return false;
    const startMs = new Date(s.start_iso).getTime();
    const endMs = new Date(s.end_iso).getTime();
    if (fromMs !== null && endMs < fromMs) return false;
    if (toMs !== null && startMs > toMs) return false;
    return true;
  });
  return all.sort((a, b) => new Date(a.start_iso).getTime() - new Date(b.start_iso).getTime());
}

export function getShift(id: string): Shift | null {
  return db.shifts.get(id) || null;
}

export function createShift(data: Omit<Shift, "_id" | "created_at">): Shift {
  const id = `shf_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const shift: Shift = {
    ...data,
    _id: id,
    created_at: new Date().toISOString(),
    notes: data.notes ?? null,
  };
  db.shifts.set(id, shift);
  saveShiftsToFile();
  return shift;
}

export function updateShift(id: string, data: Partial<Shift>): Shift | null {
  const shift = db.shifts.get(id);
  if (!shift) return null;
  const updated: Shift = {
    ...shift,
    ...data,
    _id: id,
    notes: data.notes === undefined ? shift.notes ?? null : data.notes,
  };
  db.shifts.set(id, updated);
  saveShiftsToFile();
  return updated;
}

export function deleteShift(id: string): boolean {
  const ok = db.shifts.delete(id);
  if (ok) saveShiftsToFile();
  return ok;
}

/** Один пользователь по умолчанию, чтобы GET /profile не возвращал 404 при пустой БД (например после перезапуска). */
function ensureDefaultUser(): void {
  // В продакшене не создаём "фейковый" профиль — клиент обязан пройти регистрацию /clients/register
  if (process.env.NODE_ENV === "production") return;
  if (db.users.size > 0) return;
  createUser({
    first_name: "Клиент",
    last_name: "",
    phone: "profile-fallback",
    email: null,
    avatar_url: null,
    social_links: {},
    client_tier: "client",
    loyalty_points: 0,
  });
}

export function getUsers(): User[] {
  ensureDefaultUser();
  return Array.from(db.users.values()).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

export function getUser(id: string): User | null {
  return db.users.get(id) || null;
}

export function createUser(data: Omit<User, "_id" | "created_at">): User {
  const id = `usr_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const user: User = {
    ...data,
    _id: id,
    created_at: new Date().toISOString(),
    client_tier: data.client_tier ?? "client",
    loyalty_points: data.loyalty_points ?? 0,
  };
  db.users.set(id, user);
  saveUsersToFile();
  return user;
}

export function updateUser(id: string, data: Partial<User>): User | null {
  const user = db.users.get(id);
  if (!user) return null;
  const updated = { ...user, ...data, _id: id };
  db.users.set(id, updated);
  saveUsersToFile();
  return updated;
}

function isRealPhone(phone: string | null | undefined): boolean {
  const p = String(phone ?? "").trim();
  if (!p) return false;
  if (p.toLowerCase().startsWith("device:")) return false;
  return normalizePhone(p).length >= 6;
}

/** Найти клиента по телефону (цифры), исключая технические device:* */
export function findUserByPhone(phone: string): User | null {
  if (!isRealPhone(phone)) return null;
  const n = normalizePhone(phone);
  for (const u of db.users.values()) {
    if (!isRealPhone(u.phone)) continue;
    if (normalizePhone(u.phone) === n) return u;
  }
  return null;
}

/**
 * Объединить 2 аккаунта клиента:
 * - primary сохраняется
 * - secondary удаляется
 * - баллы суммируются, устройства (client-auth) переназначаются, транзакции/уведомления/записи перепривязываются
 */
export function mergeUsers(primaryId: string, secondaryId: string): User | null {
  if (primaryId === secondaryId) return db.users.get(primaryId) ?? null;
  const primary = db.users.get(primaryId);
  const secondary = db.users.get(secondaryId);
  if (!primary || !secondary) return primary ?? null;

  const primaryPoints = Number.isFinite(Number(primary.loyalty_points)) ? Number(primary.loyalty_points) : 0;
  const secondaryPoints = Number.isFinite(Number(secondary.loyalty_points)) ? Number(secondary.loyalty_points) : 0;
  const mergedPoints = Math.max(0, Math.trunc(primaryPoints + secondaryPoints));

  // prefer "real" phone if primary has technical one
  const mergedPhone = isRealPhone(primary.phone) ? primary.phone : (isRealPhone(secondary.phone) ? secondary.phone : primary.phone);

  // merge basic fields (don't overwrite non-empty primary values)
  const merged: User = {
    ...primary,
    first_name: primary.first_name?.trim() ? primary.first_name : secondary.first_name,
    last_name: primary.last_name?.trim() ? primary.last_name : secondary.last_name,
    email: primary.email ?? secondary.email ?? null,
    phone: mergedPhone,
    avatar_url: primary.avatar_url ?? secondary.avatar_url ?? null,
    social_links: { ...(secondary.social_links ?? {}), ...(primary.social_links ?? {}) },
    loyalty_points: mergedPoints,
    client_tier: primary.client_tier ?? secondary.client_tier,
    status: primary.status ?? secondary.status,
  };

  db.users.set(primaryId, merged);

  // Re-link client auth records
  for (const rec of db.clientAuthByDeviceId.values()) {
    if (rec.client_id === secondaryId) {
      const updated = { ...rec, client_id: primaryId };
      db.clientAuthByDeviceId.set(updated.device_id, updated);
      db.clientAuthByApiKey.set(updated.api_key, updated);
    }
  }
  saveClientAuthToFile();

  // Re-link bookings (in-memory)
  for (const [bid, b] of db.bookings.entries()) {
    if (b.user_id === secondaryId) {
      db.bookings.set(bid, { ...b, user_id: primaryId, user_name: merged.first_name ? `${merged.first_name} ${merged.last_name ?? ""}`.trim() : b.user_name });
    }
  }

  // Re-link notifications (in-memory)
  for (const [nid, n] of db.notifications.entries()) {
    if (n.client_id === secondaryId) {
      db.notifications.set(nid, { ...n, client_id: primaryId });
    }
  }

  // Re-link loyalty transactions (persistent)
  let changedTx = false;
  for (const t of db.loyaltyTransactions) {
    if (t.user_id === secondaryId) {
      t.user_id = primaryId;
      changedTx = true;
    }
  }
  if (changedTx) saveLoyaltyTransactionsToFile();

  // Remove secondary user
  db.users.delete(secondaryId);
  saveUsersToFile();

  return merged;
}

function normalizeTelegramHandle(value: string): string {
  const s = String(value ?? "").trim();
  if (!s) return "";
  let out = s.replace(/^https?:\/\//i, "");
  out = out.replace(/^t\.me\//i, "").replace(/^telegram\.me\//i, "");
  out = out.replace(/^@+/, "");
  out = out.replace(/\/+$/, "");
  return out.trim().toLowerCase();
}

export function getUserByTelegramHandle(handle: string): User | null {
  const h = normalizeTelegramHandle(handle);
  if (!h) return null;
  for (const u of db.users.values()) {
    const t = u.social_links?.telegram;
    if (t && normalizeTelegramHandle(t) === h) return u;
  }
  return null;
}

/** Link telegram chat id to user by their telegram handle (username). */
export function linkTelegramChatIdByHandle(handle: string, chatId: string): User | null {
  const u = getUserByTelegramHandle(handle);
  if (!u) return null;
  return updateUser(u._id, {
    telegram_chat_id: chatId,
    telegram_linked_at: new Date().toISOString(),
  });
}

/** Начислить баллы лояльности клиенту (например за завершённую запись). */
export function addLoyaltyPoints(userId: string, points: number): User | null {
  const user = db.users.get(userId);
  if (!user || points <= 0) return null;
  const current = user.loyalty_points ?? 0;
  return updateUser(userId, { loyalty_points: current + points });
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
    saveClientAuthToFile();
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
    client_tier: "client",
    loyalty_points: 0,
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

  saveClientAuthToFile();
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

/** Одна демо-услуга при первом запуске, чтобы iOS/консоль сразу видели список. */
function ensureDefaultService(): void {
  if (db.services.size > 0) return;
  const service: Service = {
    _id: "svc_default",
    name: "Экспресс-мойка",
    description: "Быстрая мойка кузова. Добавьте свои услуги в разделе «Услуги».",
    price: 500,
    duration: 30,
    category: "Мойка",
    image_url: null,
    is_active: true,
  };
  db.services.set("svc_default", service);
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

const STUDIO_TZ_OFFSET_HOURS = parseInt(process.env.STUDIO_TZ_OFFSET_HOURS || "5", 10);

export function generateTimeSlots(
  serviceId: string,
  date: string,
  post_id: string = "post_1"
): { time: string; display_time: string; is_available: boolean }[] {
  const service = db.services.get(serviceId);
  if (!service) return [];

  const post = db.posts.get(post_id);
  if (!post || !post.is_enabled) return [];

  const slots: { time: string; display_time: string; is_available: boolean }[] = [];
  const [year, month, day] = date.split("-").map(Number);

  const todayUTC = Date.now();
  const todayStudio = new Date(todayUTC + STUDIO_TZ_OFFSET_HOURS * 3600000);
  const todayStr = todayStudio.toISOString().slice(0, 10);
  if (date < todayStr) {
    return [];
  }

  const startMinutes = post.use_custom_hours
    ? hhmmToMinutes(post.start_time)
    : db.working_hours.start * 60;
  const endMinutes = post.use_custom_hours ? hhmmToMinutes(post.end_time) : db.working_hours.end * 60;

  const interval = post.interval_minutes;

  const offsetSign = STUDIO_TZ_OFFSET_HOURS >= 0 ? "+" : "-";
  const absH = String(Math.abs(STUDIO_TZ_OFFSET_HOURS)).padStart(2, "0");
  const tzSuffix = `${offsetSign}${absH}:00`;

  for (let minutes = startMinutes; minutes < endMinutes; minutes += interval) {
    const hour = Math.floor(minutes / 60);
    const minute = minutes % 60;

    const hh = String(hour).padStart(2, "0");
    const mm = String(minute).padStart(2, "0");
    const displayTime = `${hh}:${mm}`;
    const mo = String(month).padStart(2, "0");
    const dd = String(day).padStart(2, "0");

    const isoWithTz = `${year}-${mo}-${dd}T${hh}:${mm}:00${tzSuffix}`;
    const time = new Date(isoWithTz);
    const timeStr = time.toISOString();

    const isClosed = isPostSlotClosed(post_id, timeStr);

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
      display_time: displayTime,
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

// Cars (avatar folders)
export function getCarFolders(): CarFolder[] {
  return Array.from(db.carFolders.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export function getCarFolder(id: string): CarFolder | null {
  return db.carFolders.get(id) || null;
}

export function getCarFolderByName(name: string): CarFolder | null {
  for (const f of db.carFolders.values()) {
    if (f.name === name) return f;
  }
  return null;
}

export function createCarFolder(data: Omit<CarFolder, "_id">): CarFolder {
  const id = `car_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const folder: CarFolder = { ...data, _id: id };
  db.carFolders.set(id, folder);
  saveCarFoldersToFile();
  return folder;
}

export function updateCarFolder(id: string, data: Partial<CarFolder>): CarFolder | null {
  const folder = db.carFolders.get(id);
  if (!folder) return null;
  const updated = { ...folder, ...data, _id: id };
  db.carFolders.set(id, updated);
  saveCarFoldersToFile();
  return updated;
}

export function deleteCarFolder(id: string): boolean {
  const ok = db.carFolders.delete(id);
  if (ok) saveCarFoldersToFile();
  return ok;
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
  entity_type?: Notification["entity_type"];
  entity_id?: Notification["entity_id"];
}): Notification {
  const id = `ntf_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const notification: Notification = {
    client_id: data.client_id,
    body: data.body,
    type: data.type,
    title: data.title ?? null,
    read: data.read ?? false,
    entity_type: data.entity_type ?? null,
    entity_id: data.entity_id ?? null,
    _id: id,
    created_at: new Date().toISOString(),
  };
  db.notifications.set(id, notification);
  return notification;
}

// News
export function getNewsAll(): NewsItem[] {
  return Array.from(db.news.values()).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export function getNewsPublished(): NewsItem[] {
  return getNewsAll().filter((n) => n.published);
}

export function getNewsItem(id: string): NewsItem | null {
  return db.news.get(id) || null;
}

export function createNews(data: { title: string; body: string; published?: boolean }): NewsItem {
  const id = `news_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const item: NewsItem = {
    _id: id,
    title: data.title.trim(),
    body: data.body.trim(),
    published: data.published ?? true,
    created_at: new Date().toISOString(),
  };
  db.news.set(id, item);
  return item;
}

export function updateNews(id: string, data: Partial<Pick<NewsItem, "title" | "body" | "published">>): NewsItem | null {
  const existing = db.news.get(id);
  if (!existing) return null;
  const updated: NewsItem = {
    ...existing,
    title: data.title !== undefined ? String(data.title).trim() : existing.title,
    body: data.body !== undefined ? String(data.body).trim() : existing.body,
    published: data.published !== undefined ? !!data.published : existing.published,
    _id: id,
  };
  db.news.set(id, updated);
  return updated;
}

export function ensureNewsNotificationsForClient(clientId: string): void {
  const published = getNewsPublished();
  if (published.length === 0) return;

  const existingNewsIds = new Set(
    Array.from(db.notifications.values())
      .filter((n) => n.client_id === clientId && n.type === "news" && n.entity_type === "news" && !!n.entity_id)
      .map((n) => n.entity_id as string)
  );

  for (const item of published) {
    if (existingNewsIds.has(item._id)) continue;
    createNotification({
      client_id: clientId,
      type: "news",
      title: item.title,
      body: item.body,
      entity_type: "news",
      entity_id: item._id,
      read: false,
    });
  }
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
  const s = db.telegram_bot_settings;
  return {
    ...s,
    admin_chat_ids: [...s.admin_chat_ids],
    welcome_message: s.welcome_message ?? "👋 Добро пожаловать! Вы подключены к уведомлениям о записях.",
    template_new_booking: s.template_new_booking ?? "",
    template_booking_cancelled: s.template_booking_cancelled ?? "",
    template_booking_confirmed: s.template_booking_confirmed ?? "",
    template_daily_summary: s.template_daily_summary ?? "",
    template_reminder: s.template_reminder ?? "",
  };
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
  if (data.welcome_message !== undefined) s.welcome_message = String(data.welcome_message ?? "");
  if (data.template_new_booking !== undefined) s.template_new_booking = String(data.template_new_booking ?? "");
  if (data.template_booking_cancelled !== undefined) s.template_booking_cancelled = String(data.template_booking_cancelled ?? "");
  if (data.template_booking_confirmed !== undefined) s.template_booking_confirmed = String(data.template_booking_confirmed ?? "");
  if (data.template_daily_summary !== undefined) s.template_daily_summary = String(data.template_daily_summary ?? "");
  if (data.template_reminder !== undefined) s.template_reminder = String(data.template_reminder ?? "");
  return getTelegramBotSettings();
}

export function addTelegramAdminChatId(chatId: string): void {
  const ids = db.telegram_bot_settings.admin_chat_ids;
  if (!ids.includes(chatId)) ids.push(chatId);
}

/** Bot token comes from saved credentials (preferred) or env var */
export function getTelegramBotToken(): string {
  return telegramCredentialsStore.bot_token || process.env.TELEGRAM_BOT_TOKEN || "";
}

/** Bot username comes from saved credentials (preferred) or env var */
export function getTelegramBotUsername(): string | null {
  return telegramCredentialsStore.bot_username || process.env.TELEGRAM_BOT_USERNAME || null;
}

export function setTelegramBotCredentials(token: string, username: string | null): void {
  telegramCredentialsStore.bot_token = token;
  telegramCredentialsStore.bot_username = username ?? null;
  saveTelegramCredentialsToFile();
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
  const email = String(data.email ?? "").trim().toLowerCase();

  const account: Account = {
    ...data,
    email,
    _id: id,
    created_at: now,
    updated_at: now,
    verified: false,
  };

  db.accounts.set(id, account);
  db.accountsByEmail.set(email, account);

  if (data.yandex_id) {
    db.accountsByYandexId.set(data.yandex_id, account);
  }

  if (data.telegram_id) {
    db.accountsByTelegramId.set(data.telegram_id, account);
  }

  if (data.phone) {
    const p = normalizePhone(data.phone);
    if (p) db.accountsByPhone.set(p, account);
  }

  saveAccountsToFile();
  return account;
}

/** Normalize phone to digits only for lookup (e.g. +7 900 123-45-67 → 79001234567) */
export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

export function getAccount(id: string): Account | null {
  return db.accounts.get(id) || null;
}

/** Первый (любой) аккаунт организации — для подстановки в шапку актов выполненных работ */
export function getFirstAccount(): Account | null {
  const first = db.accounts.values().next();
  return first.value ?? null;
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
    db.accountsByEmail.delete(String(account.email).trim().toLowerCase());
    db.accountsByEmail.set(String(data.email).trim().toLowerCase(), updated);
  }

  // Update phone index if changed
  if (data.phone !== undefined && normalizePhone(data.phone) !== (account.phone ? normalizePhone(account.phone) : "")) {
    if (account.phone) db.accountsByPhone.delete(normalizePhone(account.phone));
    const p = data.phone ? normalizePhone(data.phone) : "";
    if (p) db.accountsByPhone.set(p, updated);
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

  saveAccountsToFile();
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
