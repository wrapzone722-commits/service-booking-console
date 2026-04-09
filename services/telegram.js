/**
 * Telegram Bot API: уведомления клиентам и вебхук привязки чата.
 * Токен: TELEGRAM_BOT_TOKEN (env) или settings.telegram_bot_token (приоритет у env).
 */
import { randomBytes } from 'crypto';

const TG_API = 'https://api.telegram.org';

export function getTelegramBotToken(db) {
  const env = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (env) return env;
  if (!db) return '';
  const r = db.prepare("SELECT value FROM settings WHERE key = 'telegram_bot_token'").get();
  return r?.value != null && String(r.value).trim() ? String(r.value).trim() : '';
}

export function isTelegramConfigured(db) {
  return !!getTelegramBotToken(db);
}

export function ensureTelegramWebhookSecret(db) {
  const r = db.prepare("SELECT value FROM settings WHERE key = 'telegram_webhook_secret'").get();
  let s = r?.value != null ? String(r.value).trim() : '';
  if (!s) {
    s = randomBytes(24).toString('hex');
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('telegram_webhook_secret', s);
  }
  return s;
}

export async function telegramApi(token, method, body = {}) {
  const url = `${TG_API}/bot${token}/${method}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const j = await res.json().catch(() => ({}));
  if (!j.ok) {
    const err = new Error(j.description || `Telegram ${method} failed`);
    err.telegramCode = j.error_code;
    throw err;
  }
  return j.result;
}

export async function fetchAndCacheBotUsername(db, token) {
  try {
    const me = await telegramApi(token, 'getMe');
    const u = me?.username;
    if (u) {
      db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('telegram_bot_username', String(u));
    }
    return u ? String(u) : null;
  } catch (e) {
    console.error('[Telegram] getMe:', e.message);
    return null;
  }
}

export function getCachedBotUsername(db) {
  const r = db.prepare("SELECT value FROM settings WHERE key = 'telegram_bot_username'").get();
  return r?.value != null && String(r.value).trim() ? String(r.value).trim() : null;
}

export async function sendTelegramToClient(db, clientId, text) {
  const token = getTelegramBotToken(db);
  if (!token || !text) return false;
  const row = db.prepare('SELECT telegram_chat_id FROM clients WHERE id = ?').get(clientId);
  const chatId = row?.telegram_chat_id;
  if (chatId == null || !String(chatId).trim()) return false;
  try {
    await telegramApi(token, 'sendMessage', {
      chat_id: String(chatId).trim(),
      text: String(text).slice(0, 4096),
      disable_web_page_preview: true,
    });
    return true;
  } catch (e) {
    console.error('[Telegram] sendMessage:', e.message);
    return false;
  }
}

export async function sendTelegramChat(token, chatId, text) {
  await telegramApi(token, 'sendMessage', {
    chat_id: String(chatId).trim(),
    text: String(text).slice(0, 4096),
    disable_web_page_preview: true,
  });
}

export async function telegramSetWebhook(token, webhookUrl) {
  await telegramApi(token, 'setWebhook', {
    url: webhookUrl,
    allowed_updates: ['message', 'edited_message'],
  });
}
