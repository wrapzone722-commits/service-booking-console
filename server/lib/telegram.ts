import type { Booking } from "@shared/api";
import * as db from "../db";

/** Send message via Telegram Bot API */
export async function sendTelegramMessage(botToken: string, chatId: string, text: string): Promise<boolean> {
  if (!botToken || !chatId || !text) return false;
  try {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean };
    return json.ok === true;
  } catch (e) {
    console.error("Telegram sendMessage error:", e);
    return false;
  }
}

function formatBookingDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("ru-RU", { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

/** Send booking notifications to all configured admin chat IDs */
export async function notifyNewBooking(booking: Booking): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  const s = db.getTelegramBotSettings();
  if (!s.enabled || !s.notify_new_booking || !s.admin_chat_ids.length) return;
  const text = [
    "🆕 <b>Новая запись</b>",
    "",
    `👤 ${booking.user_name}`,
    `📋 ${booking.service_name}`,
    `📅 ${formatBookingDate(booking.date_time)}`,
    `💰 ${booking.price} ₽`,
    booking.notes ? `\n📝 ${booking.notes}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  for (const chatId of s.admin_chat_ids) {
    await sendTelegramMessage(token, chatId, text);
  }
}

export async function notifyBookingCancelled(booking: Booking): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  const s = db.getTelegramBotSettings();
  if (!s.enabled || !s.notify_booking_cancelled || !s.admin_chat_ids.length) return;
  const text = [
    "❌ <b>Запись отменена</b>",
    "",
    `👤 ${booking.user_name}`,
    `📋 ${booking.service_name}`,
    `📅 ${formatBookingDate(booking.date_time)}`,
  ].join("\n");
  for (const chatId of s.admin_chat_ids) {
    await sendTelegramMessage(token, chatId, text);
  }
}

export async function notifyBookingConfirmed(booking: Booking): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  const s = db.getTelegramBotSettings();
  if (!s.enabled || !s.notify_booking_confirmed || !s.admin_chat_ids.length) return;
  const text = [
    "✅ <b>Запись подтверждена</b>",
    "",
    `👤 ${booking.user_name}`,
    `📋 ${booking.service_name}`,
    `📅 ${formatBookingDate(booking.date_time)}`,
  ].join("\n");
  for (const chatId of s.admin_chat_ids) {
    await sendTelegramMessage(token, chatId, text);
  }
}
