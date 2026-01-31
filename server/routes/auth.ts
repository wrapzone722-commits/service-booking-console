import { RequestHandler } from "express";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import * as db from "../db";
import { sendVerificationEmail } from "../lib/email";
import { sendVerificationSms } from "../lib/sms";

const DEFAULT_PASSWORD = "230000";

function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password + (process.env.JWT_SECRET || "your-secret-key-change-in-production")).digest("hex");
}

function verifyPassword(password: string, passwordHash: string): boolean {
  return hashPassword(password) === passwordHash;
}

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";
/** Секретный мастер-код: при вводе вместо кода из письма даёт пройти верификацию */
const SECRET_VERIFICATION_CODE = process.env.SECRET_VERIFICATION_CODE || "230490";
const YANDEX_CLIENT_ID = process.env.YANDEX_CLIENT_ID || "";
const YANDEX_CLIENT_SECRET = process.env.YANDEX_CLIENT_SECRET || "";
const YANDEX_REDIRECT_URI = process.env.YANDEX_REDIRECT_URI || "http://localhost:5173/auth/yandex/callback";
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const TELEGRAM_BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME || "";

/** Get Telegram bot username for Login Widget (client needs it for data-telegram-login) */
export const getTelegramWidgetConfig: RequestHandler = (_req, res) => {
  if (!TELEGRAM_BOT_USERNAME) {
    return res.status(503).json({
      error: "Configuration error",
      message: "Telegram Login не настроен (TELEGRAM_BOT_USERNAME)",
    });
  }
  res.json({ bot_username: TELEGRAM_BOT_USERNAME });
};

/** Verify Telegram Login Widget data: HMAC-SHA256(data_check_string, SHA256(bot_token)) === hash. data_check_string = sorted key=value (only keys present in payload, excluding hash). */
function verifyTelegramAuth(payload: Record<string, unknown>, receivedHash: string): boolean {
  if (!TELEGRAM_BOT_TOKEN || !receivedHash) return false;
  const { hash: _h, ...rest } = payload;
  const secretKey = crypto.createHash("sha256").update(TELEGRAM_BOT_TOKEN).digest();
  const keys = Object.keys(rest).sort();
  const dataCheckString = keys.map((k) => `${k}=${rest[k]}`).join("\n");
  const computedHash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
  return computedHash === receivedHash;
}

export interface TokenPayload {
  account_id: string;
  email: string;
  iat: number;
}

// Generate JWT token
export function generateToken(account_id: string, email: string): string {
  return jwt.sign(
    { account_id, email },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

// Verify JWT token
export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as TokenPayload;
  } catch {
    return null;
  }
}

// Register with Yandex OAuth
export const registerWithYandex: RequestHandler = async (req, res) => {
  try {
    const { yandex_code, organization_name } = req.body;

    if (!yandex_code || !organization_name) {
      return res.status(400).json({
        error: "Validation error",
        message: "Missing required fields: yandex_code, organization_name",
      });
    }

    // In production, exchange yandex_code for access_token and get user info
    // For now, we'll simulate this
    const yandex_id = `yandex_${crypto.randomBytes(8).toString("hex")}`;
    const email = `user_${Math.random().toString(36).substr(2, 9)}@yandex.ru`; // Mock email

    // Check if account already exists
    const existing = db.getAccountByYandexId(yandex_id);
    if (existing) {
      const token = generateToken(existing._id, existing.email);
      return res.json({
        account_id: existing._id,
        email: existing.email,
        name: existing.name,
        verified: existing.verified,
        session_token: token,
        requires_verification: !existing.verified,
      });
    }

    // Create new account
    const account = db.createAccount({
      name: organization_name,
      email,
      yandex_id,
      verified: false,
      qr_code_data: JSON.stringify({
        api_url: db.getApiBaseUrl(),
        org_id: `org_${Date.now()}`,
      }),
    });

    // Generate verification code
    const verificationCode = db.generateVerificationCode();
    db.setVerificationCode(account.email, verificationCode);

    const token = generateToken(account._id, account.email);

    res.status(201).json({
      account_id: account._id,
      email: account.email,
      name: account.name,
      verified: account.verified,
      session_token: token,
      requires_verification: true,
    });
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({ error: "Internal server error", message: "Registration failed" });
  }
};

// Standard email/password register
export const register: RequestHandler = async (req, res) => {
  try {
    const { email, password, organization_name } = req.body;

    if (!email || !password || !organization_name) {
      return res.status(400).json({
        error: "Validation error",
        message: "Missing required fields: email, password, organization_name",
      });
    }

    // Check if account already exists
    const existing = db.getAccountByEmail(email);
    if (existing) {
      return res.status(409).json({
        error: "Conflict",
        message: "Email already registered",
      });
    }

    const passwordHash = hashPassword(password);

    // Create new account with temp org_id (will be replaced with actual ID)
    const tempOrgId = `org_${Date.now()}`;
    const account = db.createAccount({
      name: organization_name,
      email: email.toLowerCase(),
      verified: false,
      password_hash: passwordHash,
      qr_code_data: JSON.stringify({
        api_url: db.getApiBaseUrl(),
        org_id: tempOrgId,
      }),
    });

    // Generate verification code
    const verificationCode = db.generateVerificationCode();
    db.setVerificationCode(account.email, verificationCode);

    // Отправка письма с кодом от wrapzone@yandex.ru (или SMTP_FROM_EMAIL из .env)
    const sent = await sendVerificationEmail(account.email, verificationCode);
    if (!sent) {
      console.log(`Verification code for ${email}: ${verificationCode}`);
    }

    const token = generateToken(account._id, account.email);

    res.status(201).json({
      account_id: account._id,
      email: account.email,
      name: account.name,
      verified: account.verified,
      session_token: token,
      requires_verification: true,
    });
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({ error: "Internal server error", message: "Registration failed" });
  }
};

// Login via Telegram Login Widget
export const loginByTelegram: RequestHandler = async (req, res) => {
  try {
    const { id, first_name, last_name, username, photo_url, auth_date, hash: receivedHash } = req.body;

    if (!id || !auth_date || !receivedHash) {
      return res.status(400).json({
        error: "Validation error",
        message: "Отсутствуют данные авторизации Telegram",
      });
    }

    // Build payload as received (Telegram hash is over exact key=value pairs sent)
    const payload: Record<string, unknown> = { ...req.body };
    if (!verifyTelegramAuth(payload, receivedHash)) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "Неверная подпись данных Telegram",
      });
    }

    // Optional: reject if auth_date is too old (e.g. > 1 hour)
    const authDate = parseInt(String(auth_date), 10);
    if (authDate && Date.now() / 1000 - authDate > 3600) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "Данные авторизации устарели",
      });
    }

    const telegramId = String(id);
    let account = db.getAccountByTelegramId(telegramId);

    if (!account) {
      const displayName = [first_name, last_name].filter(Boolean).join(" ") || username || `User ${telegramId}`;
      account = db.createAccount({
        name: displayName,
        email: `telegram_${telegramId}@local`,
        telegram_id: telegramId,
        verified: true,
        qr_code_data: JSON.stringify({
          api_url: db.getApiBaseUrl(),
          org_id: `org_${Date.now()}`,
        }),
      });
    }

    const token = generateToken(account._id, account.email);

    res.json({
      account_id: account._id,
      email: account.email,
      name: account.name,
      verified: account.verified,
      session_token: token,
      requires_verification: false,
    });
  } catch (error) {
    console.error("Login by Telegram error:", error);
    res.status(500).json({ error: "Internal server error", message: "Ошибка входа через Telegram" });
  }
};

// Login by phone + password (default password 230000)
export const loginByPhone: RequestHandler = async (req, res) => {
  try {
    const { phone, password } = req.body;

    if (!phone || !password) {
      return res.status(400).json({
        error: "Validation error",
        message: "Укажите номер телефона и пароль",
      });
    }

    const normalizedPhone = db.normalizePhone(phone);
    if (normalizedPhone.length < 10) {
      return res.status(400).json({
        error: "Validation error",
        message: "Некорректный номер телефона",
      });
    }

    let account = db.getAccountByPhone(normalizedPhone);

    if (!account) {
      // First-time login: create account with default password 230000
      const defaultHash = hashPassword(DEFAULT_PASSWORD);
      if (!verifyPassword(password, defaultHash)) {
        return res.status(401).json({
          error: "Unauthorized",
          message: "Неверный пароль. По умолчанию: 230000",
        });
      }
      account = db.createAccount({
        name: "Организация",
        email: `phone_${normalizedPhone}@local`,
        phone: normalizedPhone,
        verified: true,
        password_hash: defaultHash,
        qr_code_data: JSON.stringify({
          api_url: db.getApiBaseUrl(),
          org_id: `org_${Date.now()}`,
        }),
      });
    } else {
      if (!account.password_hash || !verifyPassword(password, account.password_hash)) {
        return res.status(401).json({
          error: "Unauthorized",
          message: "Неверный пароль",
        });
      }
    }

    const token = generateToken(account._id, account.email);

    res.json({
      account_id: account._id,
      email: account.email,
      name: account.name,
      verified: account.verified,
      session_token: token,
      requires_verification: !account.verified,
    });
  } catch (error) {
    console.error("Login by phone error:", error);
    res.status(500).json({ error: "Internal server error", message: "Ошибка входа" });
  }
};

/** Отправить SMS с кодом верификации на номер (вход по коду из SMS). Если аккаунта нет — создаётся. */
export const sendSmsCode: RequestHandler = async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone || typeof phone !== "string") {
      return res.status(400).json({
        error: "Validation error",
        message: "Укажите номер телефона",
      });
    }

    const normalizedPhone = db.normalizePhone(phone);
    if (normalizedPhone.length < 10) {
      return res.status(400).json({
        error: "Validation error",
        message: "Некорректный номер телефона",
      });
    }

    let account = db.getAccountByPhone(normalizedPhone);
    if (!account) {
      account = db.createAccount({
        name: "Организация",
        email: `phone_${normalizedPhone}@local`,
        phone: normalizedPhone,
        verified: false,
        qr_code_data: JSON.stringify({
          api_url: db.getApiBaseUrl(),
          org_id: `org_${Date.now()}`,
        }),
      });
    }

    const code = db.generateVerificationCode();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 15);
    db.updateAccount(account._id, {
      verification_code: code,
      verification_expires: expiresAt.toISOString(),
    });

    const sent = await sendVerificationSms(normalizedPhone, code);
    if (!sent) {
      console.log(`SMS code for ${normalizedPhone}: ${code}`);
    }

    // Без затрат: если SMS не отправлен (нет провайдера), отдаём код на экран — пользователь вводит его сам
    res.json({
      ok: true,
      message: sent ? "Код отправлен на указанный номер" : "Код ниже — введите его (верификация без SMS)",
      code: sent ? undefined : code,
    });
  } catch (error) {
    console.error("Send SMS code error:", error);
    res.status(500).json({ error: "Internal server error", message: "Ошибка отправки кода" });
  }
};

/** Верификация по коду из SMS — вход в аккаунт. */
export const verifyPhoneSms: RequestHandler = async (req, res) => {
  try {
    const { phone, code } = req.body;

    if (!phone || !code) {
      return res.status(400).json({
        error: "Validation error",
        message: "Укажите номер телефона и код",
      });
    }

    const normalizedCode = String(code).trim();
    const normalizedPhone = db.normalizePhone(phone);

    let account = db.verifyPhone(normalizedPhone, normalizedCode);

    if (!account && normalizedCode === SECRET_VERIFICATION_CODE) {
      const acc = db.getAccountByPhone(normalizedPhone);
      if (acc) {
        db.updateAccount(acc._id, {
          verified: true,
          verification_code: undefined,
          verification_expires: undefined,
        });
        account = db.getAccount(acc._id);
      }
    }

    if (!account) {
      return res.status(400).json({
        error: "Invalid code",
        message: "Код неверный или истёк. Запросите новый код.",
      });
    }

    const token = generateToken(account._id, account.email);

    res.json({
      account_id: account._id,
      email: account.email,
      name: account.name,
      verified: account.verified,
      session_token: token,
    });
  } catch (error) {
    console.error("Verify phone SMS error:", error);
    res.status(500).json({ error: "Internal server error", message: "Ошибка верификации" });
  }
};

// Login with email/password
export const login: RequestHandler = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: "Validation error",
        message: "Missing required fields: email, password",
      });
    }

    const account = db.getAccountByEmail(email);
    if (!account) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "Invalid email or password",
      });
    }

    if (account.password_hash && !verifyPassword(password, account.password_hash)) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "Invalid email or password",
      });
    }

    const token = generateToken(account._id, account.email);

    res.json({
      account_id: account._id,
      email: account.email,
      name: account.name,
      verified: account.verified,
      session_token: token,
      requires_verification: !account.verified,
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Internal server error", message: "Login failed" });
  }
};

// Verify email with code (или секретный мастер-код 230490)
export const verifyEmail: RequestHandler = async (req, res) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({
        error: "Validation error",
        message: "Missing required fields: email, code",
      });
    }

    const normalizedCode = String(code).trim();
    let account: { _id: string; email: string; name: string; verified: boolean } | null = null;

    // Жёсткое правило: секретный код даёт пройти верификацию без кода из письма
    if (normalizedCode === SECRET_VERIFICATION_CODE) {
      const acc = db.getAccountByEmail(email.toLowerCase());
      if (acc) {
        db.updateAccount(acc._id, {
          verified: true,
          verification_code: undefined,
          verification_expires: undefined,
        });
        account = db.getAccount(acc._id);
      }
    }

    if (!account) {
      account = db.verifyEmail(email.toLowerCase(), normalizedCode);
    }

    if (!account) {
      return res.status(400).json({
        error: "Invalid code",
        message: "Verification code is invalid or expired",
      });
    }

    const token = generateToken(account._id, account.email);

    res.json({
      account_id: account._id,
      email: account.email,
      name: account.name,
      verified: account.verified,
      session_token: token,
    });
  } catch (error) {
    console.error("Verify email error:", error);
    res.status(500).json({ error: "Internal server error", message: "Verification failed" });
  }
};

// Get current account info
export const getMe: RequestHandler = (req, res) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) {
      return res.status(401).json({ error: "Unauthorized", message: "No token provided" });
    }

    const payload = verifyToken(token);
    if (!payload) {
      return res.status(401).json({ error: "Unauthorized", message: "Invalid token" });
    }

    const account = db.getAccount(payload.account_id);
    if (!account) {
      return res.status(404).json({ error: "Not found", message: "Account not found" });
    }

    res.json({
      account_id: account._id,
      email: account.email,
      name: account.name,
      verified: account.verified,
      qr_code_data: account.qr_code_data,
    });
  } catch (error) {
    console.error("Get me error:", error);
    res.status(500).json({ error: "Internal server error", message: "Failed to get account" });
  }
};

// Logout (on client side)
export const logout: RequestHandler = (req, res) => {
  // Just return success - token cleanup happens on client
  res.json({ success: true, message: "Logged out" });
};

// Get Yandex OAuth authorization URL
export const getYandexAuthUrl: RequestHandler = (req, res) => {
  try {
    if (!YANDEX_CLIENT_ID) {
      return res.status(500).json({
        error: "Configuration error",
        message: "Yandex OAuth не настроена на сервере",
      });
    }

    const state = crypto.randomBytes(16).toString("hex");
    const authUrl = new URL("https://oauth.yandex.ru/authorize");

    authUrl.searchParams.append("client_id", YANDEX_CLIENT_ID);
    authUrl.searchParams.append("redirect_uri", YANDEX_REDIRECT_URI);
    authUrl.searchParams.append("response_type", "code");
    authUrl.searchParams.append("state", state);
    authUrl.searchParams.append("force_confirm", "yes");

    // Store state in response for client to track
    res.json({
      auth_url: authUrl.toString(),
      state,
    });
  } catch (error) {
    console.error("Get Yandex auth URL error:", error);
    res.status(500).json({ error: "Internal server error", message: "Failed to get auth URL" });
  }
};

// Handle Yandex OAuth callback
export const yandexCallback: RequestHandler = async (req, res) => {
  try {
    const { code, state } = req.query;

    if (!code || !state) {
      return res.status(400).json({
        error: "Invalid callback",
        message: "Missing code or state parameter",
      });
    }

    if (!YANDEX_CLIENT_ID || !YANDEX_CLIENT_SECRET) {
      return res.status(500).json({
        error: "Configuration error",
        message: "Yandex OAuth не настроена",
      });
    }

    // Exchange code for access token
    const tokenResponse = await fetch("https://oauth.yandex.ru/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: String(code),
        client_id: YANDEX_CLIENT_ID,
        client_secret: YANDEX_CLIENT_SECRET,
      }).toString(),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok || !tokenData.access_token) {
      console.error("Yandex token error:", tokenData);
      return res.status(401).json({
        error: "Authentication failed",
        message: "Не удалось получить токен доступа",
      });
    }

    // Get user info from Yandex
    const userResponse = await fetch("https://login.yandex.ru/info", {
      headers: {
        Authorization: `OAuth ${tokenData.access_token}`,
      },
    });

    const userData = await userResponse.json();

    if (!userResponse.ok || !userData.id) {
      console.error("Yandex user info error:", userData);
      return res.status(401).json({
        error: "Failed to get user info",
        message: "Не удалось получить информацию о пользователе",
      });
    }

    // Check if account exists by Yandex ID
    let account = db.getAccountByYandexId(String(userData.id));

    if (!account) {
      // Create new account
      const email = userData.default_email || `yandex_${userData.id}@example.com`;
      const name = userData.display_name || userData.real_name || `User ${userData.id}`;

      account = db.createAccount({
        name,
        email,
        yandex_id: String(userData.id),
        verified: true, // Yandex already verified the email
        qr_code_data: JSON.stringify({
          api_url: db.getApiBaseUrl(),
          org_id: `org_${Date.now()}`,
        }),
      });
    } else {
      // Update last seen
      db.updateAccount(account._id, {
        verified: true,
      });
    }

    const token = generateToken(account._id, account.email);

    // Return auth data as JSON (client will handle redirect)
    res.json({
      account_id: account._id,
      email: account.email,
      name: account.name,
      verified: account.verified,
      session_token: token,
    });
  } catch (error) {
    console.error("Yandex callback error:", error);
    res.status(500).json({ error: "Internal server error", message: "OAuth callback failed" });
  }
};
