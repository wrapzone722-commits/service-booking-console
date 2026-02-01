import type { RequestHandler } from "express";
import * as db from "../db";
import { sendTelegramMessage } from "../lib/telegram";
import type { TelegramBotSettings } from "../db";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const TELEGRAM_BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME || "";

export const getBotInfo: RequestHandler = (_req, res) => {
  res.json({
    configured: !!TELEGRAM_BOT_TOKEN,
    bot_username: TELEGRAM_BOT_USERNAME || null,
    bot_link: TELEGRAM_BOT_USERNAME ? `https://t.me/${TELEGRAM_BOT_USERNAME}` : null,
  });
};

export const getSettings: RequestHandler = (_req, res) => {
  try {
    const settings = db.getTelegramBotSettings();
    res.json(settings);
  } catch (e) {
    console.error("Get telegram settings:", e);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const updateSettings: RequestHandler = (req, res) => {
  try {
    const body = req.body ?? {};
    const updates: Partial<TelegramBotSettings> = {};
    if (typeof body.enabled === "boolean") updates.enabled = body.enabled;
    if (typeof body.notify_new_booking === "boolean") updates.notify_new_booking = body.notify_new_booking;
    if (typeof body.notify_booking_cancelled === "boolean") updates.notify_booking_cancelled = body.notify_booking_cancelled;
    if (typeof body.notify_booking_confirmed === "boolean") updates.notify_booking_confirmed = body.notify_booking_confirmed;
    if (typeof body.notify_daily_summary === "boolean") updates.notify_daily_summary = body.notify_daily_summary;
    if (typeof body.daily_summary_hour === "number") updates.daily_summary_hour = body.daily_summary_hour;
    if (Array.isArray(body.admin_chat_ids)) updates.admin_chat_ids = body.admin_chat_ids.filter((id: unknown) => typeof id === "string");
    if (typeof body.reminders_enabled === "boolean") updates.reminders_enabled = body.reminders_enabled;
    if (Array.isArray(body.reminder_hours_before)) updates.reminder_hours_before = body.reminder_hours_before.filter((n: unknown) => typeof n === "number");
    const settings = db.updateTelegramBotSettings(updates);
    res.json(settings);
  } catch (e) {
    console.error("Update telegram settings:", e);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const sendTest: RequestHandler = async (req, res) => {
  try {
    if (!TELEGRAM_BOT_TOKEN) {
      return res.status(503).json({ error: "Bot не настроен", message: "Укажите TELEGRAM_BOT_TOKEN" });
    }
    const settings = db.getTelegramBotSettings();
    const chatIds = settings.admin_chat_ids;
    if (!chatIds.length) {
      return res.status(400).json({ error: "Нет получателей", message: "Добавьте Chat ID в настройках" });
    }
    const text = "✅ <b>Тест уведомлений</b>\n\nБот подключен и работает.";
    let sent = 0;
    for (const chatId of chatIds) {
      if (await sendTelegramMessage(TELEGRAM_BOT_TOKEN, chatId, text)) sent++;
    }
    res.json({ success: true, sent, total: chatIds.length });
  } catch (e) {
    console.error("Send test:", e);
    res.status(500).json({ error: "Ошибка отправки" });
  }
};

/** Telegram webhook — receives updates when users write to bot (e.g. /start) */
export const webhook: RequestHandler = async (req, res) => {
  try {
    const update = req.body as { message?: { chat?: { id: number }; text?: string } };
    const chatId = update?.message?.chat?.id;
    const text = update?.message?.text;
    if (chatId && text?.trim().toLowerCase() === "/start") {
      db.addTelegramAdminChatId(String(chatId));
    }
  } catch (e) {
    console.error("Telegram webhook:", e);
  }
  res.sendStatus(200); // Always 200 for webhook
};

/** Set Telegram webhook so bot receives /start etc. — call once after deploy */
export const setWebhook: RequestHandler = async (req, res) => {
  try {
    if (!TELEGRAM_BOT_TOKEN) {
      return res.status(503).json({ error: "Bot не настроен" });
    }
    const host = req.get("host") || req.headers.host || "";
    const proto = req.get("x-forwarded-proto") || req.protocol || "https";
    const baseUrl = host ? `${proto}://${host}` : process.env.API_BASE_URL?.replace(/\/api\/v1$/, "") || "";
    if (!baseUrl) {
      return res.status(500).json({ error: "Не удалось определить URL" });
    }
    const webhookUrl = `${baseUrl}/api/v1/telegram/webhook`;
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook?url=${encodeURIComponent(webhookUrl)}`;
    const r = await fetch(url);
    const json = (await r.json().catch(() => ({}))) as { ok?: boolean; description?: string };
    if (!json.ok) {
      return res.status(502).json({ error: json.description || "Ошибка Telegram API" });
    }
    res.json({ success: true, webhook_url: webhookUrl });
  } catch (e) {
    console.error("Set webhook:", e);
    res.status(500).json({ error: "Ошибка настройки webhook" });
  }
};
