import type { RequestHandler } from "express";
import * as db from "../db";
import { sendTelegramMessage, sendWelcomeMessage } from "../lib/telegram";
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
    if (typeof body.welcome_message === "string") updates.welcome_message = body.welcome_message;
    if (typeof body.template_new_booking === "string") updates.template_new_booking = body.template_new_booking;
    if (typeof body.template_booking_cancelled === "string") updates.template_booking_cancelled = body.template_booking_cancelled;
    if (typeof body.template_booking_confirmed === "string") updates.template_booking_confirmed = body.template_booking_confirmed;
    if (typeof body.template_daily_summary === "string") updates.template_daily_summary = body.template_daily_summary;
    if (typeof body.template_reminder === "string") updates.template_reminder = body.template_reminder;
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
      if (TELEGRAM_BOT_TOKEN) {
        await sendWelcomeMessage(TELEGRAM_BOT_TOKEN, String(chatId));
      }
    }
  } catch (e) {
    console.error("Telegram webhook:", e);
  }
  res.sendStatus(200); // Always 200 for webhook
};

/** AI: сгенерировать текст сообщения для Telegram */
export const generateMessage: RequestHandler = async (req, res) => {
  try {
    const { context, type, sample } = req.body ?? {};
    const prompt =
      typeof context === "string" && context.trim()
        ? context.trim()
        : type === "new_booking"
          ? "Напиши короткое уведомление о новой записи клиента в автомойку. Тон: дружелюбный, профессиональный."
          : type === "cancelled"
            ? "Напиши короткое уведомление об отмене записи."
            : type === "confirmed"
              ? "Напиши короткое уведомление о подтверждении записи клиенту."
              : type === "reminder"
                ? "Напиши короткое напоминание клиенту о предстоящей записи за N часов."
                : type === "welcome"
                  ? "Напиши приветственное сообщение для пользователя, подключившего бота к уведомлениям."
                  : "Напиши короткое профессиональное сообщение для Telegram-бота автосервиса.";

    const apiKey = process.env.AI_API_KEY || process.env.OPENAI_API_KEY;
    const endpoint = (process.env.AI_API_ENDPOINT || process.env.OPENAI_API_ENDPOINT || "https://agent.timeweb.cloud/api/v1/cloud-ai/agents/4fad52a6-973f-4838-ab1e-11b0fbdf2b48/v1").replace(/\/$/, "") + "/chat/completions";
    const token = apiKey || "eyJhbGciOiJSUzUxMiIsInR5cCI6IkpXVCIsImtpZCI6IjFrYnhacFJNQGJSI0tSbE1xS1lqIn0.eyJ1c2VyIjoicHo1NzQ5OCIsInR5cGUiOiJhcGlfa2V5IiwiYXBpX2tleV9pZCI6ImEyYzBlN2Y0LTNmYmQtNDU3YS1iYmQ4LWZjMzJmZDViM2QxNSIsImlhdCI6MTc2OTkwNTkzM30.rUiOuV8mYFdOwCQ3I_t1kS7iBvqRoosOEViGKKYzjhrBT_hPGYIVjQyKMYv2DpmVSlSP4wVfrYrOqibUFj90DW9JypoGr63TliMD6n5sBfogrZmCv8Loz8dYXRv6VJmxdleE5wGrHvZ9BxvOIP5a1jA6aHynvAROaNKEkqRglRxAaegBYkDnwnkNNI7ZIvd6XhC0XzC5XQGodMoVa-DoATfuVMEg0_GtxRlsPLGyNTV_bThhf-VrqZcY6WGKmeWGGEYKC9y8XtBAn6FOvtsDi7zOdtKgnJblc8dBXbhyVZe_hRZ4c-UawogUngWCkXCVv9ZULe7Jzf7Zo-63nRH2mxVyaKUgEQ8iHtOKfdlAL-CRsI9eAKpiPi3fjezR4tw_3hgEZ1Cg7KVWZEdGDpkdBJFxO7FTv_p00HKQ_iyNJUE1yc6P_1zShvkRP7O1UAd0Lp4bRpGsOMCiz7Oo7cQBSzdK2IarfKmnGZs52HKfda-4ENx-GbFGLRBqr51XN9h5";

    const userContent = sample ? `${prompt}\n\nПример данных: ${JSON.stringify(sample, null, 2)}` : prompt;
    const systemPrompt = `Ты помощник для составления сообщений Telegram-бота автосервиса.
Правила: отвечай ТОЛЬКО валидным JSON вида {"type":"message","message":"текст"}.
В message: HTML-теги <b>, <i>, эмодзи, тон дружелюбный, 1-4 предложения.`;

    const r = await fetch(endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        temperature: 0.5,
      }),
    });
    const json = await r.json().catch(() => ({}));
    const content = json?.choices?.[0]?.message?.content;
    if (!r.ok || !content) {
      return res.status(502).json({
        error: "AI ошибка",
        message: json?.error?.message || json?.message || `HTTP ${r.status}`,
      });
    }
    let parsed: { type?: string; message?: string } = {};
    try {
      parsed = JSON.parse(content.replace(/```\w*\n?/g, "").trim());
    } catch {
      parsed = { type: "message", message: content };
    }
    res.json({ type: "message", message: String(parsed.message || content) });
  } catch (e) {
    console.error("Generate message:", e);
    res.status(500).json({ error: "Ошибка генерации", message: "Не удалось сгенерировать сообщение" });
  }
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
