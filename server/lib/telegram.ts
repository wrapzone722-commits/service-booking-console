import type { Booking } from "@shared/api";
import * as db from "../db";

function replaceVars(text: string, vars: Record<string, string>): string {
  let out = text;
  for (const [k, v] of Object.entries(vars)) {
    out = out.replace(new RegExp(`\\{\\{${k}\\}\\}`, "g"), v ?? "");
  }
  return out;
}

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

async function sendToClientIfLinked(clientId: string, text: string): Promise<void> {
  const token = db.getTelegramBotToken();
  if (!token) return;
  const user = db.getUser(clientId);
  const chatId = user?.telegram_chat_id ? String(user.telegram_chat_id) : "";
  if (!chatId) return;
  await sendTelegramMessage(token, chatId, text);
}

export async function notifyClientBookingConfirmed(booking: Booking): Promise<void> {
  await sendToClientIfLinked(
    booking.user_id,
    [
      "✅ <b>Запись подтверждена</b>",
      "",
      `📋 ${booking.service_name}`,
      `📅 ${formatBookingDate(booking.date_time)}`,
      booking.notes ? `\n📝 ${booking.notes}` : "",
    ]
      .filter(Boolean)
      .join("\n")
  );
}

export async function notifyClientBookingCancelled(booking: Booking): Promise<void> {
  await sendToClientIfLinked(
    booking.user_id,
    ["❌ <b>Запись отменена</b>", "", `📋 ${booking.service_name}`, `📅 ${formatBookingDate(booking.date_time)}`].join("\n")
  );
}

export async function notifyClientBookingInProgress(booking: Booking): Promise<void> {
  await sendToClientIfLinked(
    booking.user_id,
    ["🚗 <b>Услуга в работе</b>", "", `📋 ${booking.service_name}`, "Мы начали выполнять вашу услугу."] .join("\n")
  );
}

export async function notifyClientBookingCompleted(booking: Booking): Promise<void> {
  await sendToClientIfLinked(
    booking.user_id,
    ["🏁 <b>Услуга завершена</b>", "", `📋 ${booking.service_name}`, "Ваш авто готов."] .join("\n")
  );
}

/** Send booking notifications to all configured admin chat IDs */
export async function notifyNewBooking(booking: Booking): Promise<void> {
  const token = db.getTelegramBotToken();
  if (!token) return;
  const s = db.getTelegramBotSettings();
  if (!s.enabled || !s.notify_new_booking || !s.admin_chat_ids.length) return;
  const vars = {
    user_name: booking.user_name ?? "",
    service_name: booking.service_name ?? "",
    date_time: formatBookingDate(booking.date_time),
    price: String(booking.price ?? ""),
    notes: booking.notes ?? "",
  };
  const text = s.template_new_booking?.trim()
    ? replaceVars(s.template_new_booking, vars)
    : [
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
  const token = db.getTelegramBotToken();
  if (!token) return;
  const s = db.getTelegramBotSettings();
  if (!s.enabled || !s.notify_booking_cancelled || !s.admin_chat_ids.length) return;
  const vars = {
    user_name: booking.user_name ?? "",
    service_name: booking.service_name ?? "",
    date_time: formatBookingDate(booking.date_time),
    price: String(booking.price ?? ""),
    notes: booking.notes ?? "",
  };
  const text = s.template_booking_cancelled?.trim()
    ? replaceVars(s.template_booking_cancelled, vars)
    : [
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

/** Send welcome message to user who sent /start */
export async function sendWelcomeMessage(botToken: string, chatId: string): Promise<boolean> {
  const s = db.getTelegramBotSettings();
  const text = s.welcome_message?.trim() || "👋 Добро пожаловать! Вы подключены к уведомлениям о записях.";
  return sendTelegramMessage(botToken, chatId, text);
}

export async function notifyBookingConfirmed(booking: Booking): Promise<void> {
  const token = db.getTelegramBotToken();
  if (!token) return;
  const s = db.getTelegramBotSettings();
  if (!s.enabled || !s.notify_booking_confirmed || !s.admin_chat_ids.length) return;
  const vars = {
    user_name: booking.user_name ?? "",
    service_name: booking.service_name ?? "",
    date_time: formatBookingDate(booking.date_time),
    price: String(booking.price ?? ""),
    notes: booking.notes ?? "",
  };
  const text = s.template_booking_confirmed?.trim()
    ? replaceVars(s.template_booking_confirmed, vars)
    : [
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
