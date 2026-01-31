/**
 * Отправка SMS с кодом верификации через SMS.ru API.
 * Документация: https://sms.ru/api/send
 *
 * Настройка:
 * 1. Регистрация на https://sms.ru
 * 2. Получить api_id в личном кабинете
 * 3. В .env: SMS_API_KEY=<api_id>, SMS_SENDER=ServiceBooking (или имя отправителя)
 */

const SMS_API_KEY = process.env.SMS_API_KEY || "";
const SMS_SENDER = process.env.SMS_SENDER || "ServiceBooking";

export async function sendVerificationSms(phone: string, code: string): Promise<boolean> {
  if (!SMS_API_KEY) {
    console.warn("SMS_API_KEY не задан — SMS не отправлено. Код для", phone, ":", code);
    return false;
  }

  const normalized = phone.replace(/\D/g, "");
  if (normalized.length < 10) {
    console.warn("SMS: некорректный номер", phone);
    return false;
  }

  const text = `Код подтверждения ServiceBooking: ${code}. Действителен 15 мин.`;

  try {
    const params = new URLSearchParams({
      api_id: SMS_API_KEY,
      to: normalized,
      msg: text,
      json: "1",
    });
    if (SMS_SENDER) params.set("from", SMS_SENDER);

    const res = await fetch(`https://sms.ru/sms/send?${params.toString()}`, { method: "GET" });
    const data = (await res.json()) as { status: string; status_code?: number; sms?: Record<string, { status_code: number }> };

    if (!res.ok) {
      console.error("SMS.ru request failed:", res.status, data);
      return false;
    }

    const status = data.status === "OK" && data.status_code === 100;
    if (!status) {
      console.error("SMS.ru error:", data);
      return false;
    }

    console.log(`SMS verification code sent to ${normalized}`);
    return true;
  } catch (err) {
    console.error("Send verification SMS error:", err);
    return false;
  }
}
