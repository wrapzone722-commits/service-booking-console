import nodemailer from "nodemailer";

const SMTP_HOST = process.env.SMTP_HOST || "smtp.yandex.ru";
const SMTP_PORT = parseInt(process.env.SMTP_PORT || "465", 10);
const SMTP_SECURE = process.env.SMTP_SECURE !== "false";
const SMTP_USER = process.env.SMTP_USER || "wrapzone@yandex.ru";
const SMTP_PASS = process.env.SMTP_PASS || "";
const SMTP_FROM_NAME = process.env.SMTP_FROM_NAME || "ServiceBooking";
const SMTP_FROM_EMAIL = process.env.SMTP_FROM_EMAIL || "wrapzone@yandex.ru";

const from = `${SMTP_FROM_NAME} <${SMTP_FROM_EMAIL}>`;

/**
 * Отправка письма с кодом подтверждения на почту пользователя.
 * Письмо уходит от wrapzone@yandex.ru (или от SMTP_FROM_EMAIL из .env).
 */
export async function sendVerificationEmail(to: string, code: string): Promise<boolean> {
  if (!SMTP_PASS) {
    console.warn("SMTP_PASS не задан — письмо с кодом не отправлено. Код:", code);
    return false;
  }

  try {
    const transport = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    });

    await transport.sendMail({
      from,
      to,
      subject: "Код подтверждения — ServiceBooking",
      text: `Ваш код подтверждения: ${code}\n\nВведите его в форме на сайте. Код действителен 15 минут.`,
      html: `
        <p>Ваш код подтверждения: <strong>${code}</strong></p>
        <p>Введите его в форме на сайте. Код действителен 15 минут.</p>
        <p>— ServiceBooking</p>
      `.trim(),
    });

    console.log(`Verification email sent to ${to} from ${from}`);
    return true;
  } catch (err) {
    console.error("Send verification email error:", err);
    return false;
  }
}
