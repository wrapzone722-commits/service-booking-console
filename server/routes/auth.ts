import { RequestHandler } from "express";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import * as db from "../db";
import { sendVerificationEmail } from "../lib/email";

const DEFAULT_PASSWORD = "230000";

function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password + (process.env.JWT_SECRET || "your-secret-key-change-in-production")).digest("hex");
}

function verifyPassword(password: string, passwordHash: string): boolean {
  return hashPassword(password) === passwordHash;
}

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";
const YANDEX_CLIENT_ID = process.env.YANDEX_CLIENT_ID || "";
const YANDEX_CLIENT_SECRET = process.env.YANDEX_CLIENT_SECRET || "";
const YANDEX_REDIRECT_URI = process.env.YANDEX_REDIRECT_URI || "http://localhost:5173/auth/yandex/callback";

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

// Verify email with code
export const verifyEmail: RequestHandler = async (req, res) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({
        error: "Validation error",
        message: "Missing required fields: email, code",
      });
    }

    const account = db.verifyEmail(email.toLowerCase(), code);
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
