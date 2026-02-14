/**
 * Генерация PDF «Акт выполненных работ» по завершённой записи.
 * Для корректной кириллицы поместите TTF в server/fonts/ (например PTSans-Regular.ttf).
 */
import path from "path";
import fs from "fs";
import type { Booking, User, Account } from "@shared/api";
import * as db from "../db";

const FONTS_DIR = path.join(process.cwd(), "server", "fonts");
const FALLBACK_FONT = "PTSans-Regular.ttf";

async function getPdfDocumentConstructor(): Promise<new (opts?: import("pdfkit").PDFDocumentOptions) => import("pdfkit").PDFKit.PDFDocument> {
  const mod = await import("pdfkit");
  return (mod.default ?? mod) as new (opts?: import("pdfkit").PDFDocumentOptions) => import("pdfkit").PDFKit.PDFDocument;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Формирует номер акта: дата + короткий id записи */
function actNumber(booking: Booking): string {
  const d = new Date(booking.date_time);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const shortId = booking._id.replace(/^bkg_/, "").slice(-6);
  return `${y}-${m}-${day}-${shortId}`;
}

/**
 * Генерирует PDF «Акт выполненных работ» для завершённой записи.
 * Возвращает буфер PDF. Бросает ошибку, если запись не завершена или данные отсутствуют.
 */
export async function buildActPdf(bookingId: string): Promise<Buffer> {
  const booking = db.getBooking(bookingId);
  if (!booking) throw new Error("Booking not found");
  if (booking.status !== "completed") throw new Error("Act is only available for completed bookings");

  const user = db.getUser(booking.user_id) ?? null;
  const account = db.getFirstAccount();

  const PDFDocument = await getPdfDocumentConstructor();
  const doc = new PDFDocument({ size: "A4", margin: 50, bufferPages: true });

  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));

  const fontPath = path.join(FONTS_DIR, FALLBACK_FONT);
  if (fs.existsSync(fontPath)) {
    doc.registerFont("Custom", fontPath);
    doc.font("Custom");
  } else {
    doc.font("Helvetica");
  }

  const orgName = account?.name ?? "Организация";
  const orgAddress = account?.address ?? "";
  const orgInn = account?.inn ?? "";
  const orgOgrn = account?.ogrn ?? "";
  const orgDirector = account?.director_name ?? "";
  const orgPhone = account?.phone ?? account?.phone_extra ?? "";
  const clientName = booking.user_name || (user ? `${user.first_name} ${user.last_name}`.trim() : "Клиент");
  const clientPhone = user?.phone ?? "";
  const clientEmail = user?.email ?? "";

  let y = 50;

  // Заголовок
  doc.fontSize(16).text("АКТ ВЫПОЛНЕННЫХ РАБОТ", 50, y, { align: "center", width: 500 });
  y += 28;

  doc.fontSize(10);
  doc.text(`№ ${actNumber(booking)}`, 50, y);
  y += 6;
  doc.text(`от ${formatDate(booking.date_time)} г.`, 50, y);
  y += 20;

  // Исполнитель
  doc.fontSize(11).text("Исполнитель:", 50, y);
  y += 6;
  doc.fontSize(10);
  doc.text(orgName, 50, y);
  y += 5;
  if (orgAddress) {
    doc.text(`Адрес: ${orgAddress}`, 50, y);
    y += 5;
  }
  if (orgInn) {
    doc.text(`ИНН ${orgInn}${orgOgrn ? `, ОГРН ${orgOgrn}` : ""}`, 50, y);
    y += 5;
  }
  if (orgPhone) {
    doc.text(`Тел.: ${orgPhone}`, 50, y);
    y += 5;
  }
  y += 12;

  // Заказчик
  doc.fontSize(11).text("Заказчик (клиент):", 50, y);
  y += 6;
  doc.fontSize(10);
  doc.text(`ФИО: ${clientName}`, 50, y);
  y += 5;
  if (clientPhone) {
    doc.text(`Телефон: ${clientPhone}`, 50, y);
    y += 5;
  }
  if (clientEmail) {
    doc.text(`E-mail: ${clientEmail}`, 50, y);
    y += 5;
  }
  y += 14;

  // Преамбула
  doc.text(
    "Нижеподписавшиеся Исполнитель и Заказчик составили настоящий акт о том, что Исполнитель оказал следующие услуги, а Заказчик их принял:",
    50,
    y,
    { width: 500, align: "left" }
  );
  y += 24;

  // Таблица работ
  const tableTop = y;
  const col1 = 50;
  const col2 = 280;
  const col3 = 340;
  const col4 = 400;
  const col5 = 480;
  const rowH = 18;

  doc.fontSize(9);
  if (fs.existsSync(fontPath)) doc.font("Custom");
  else doc.font("Helvetica");
  doc.text("№", col1, tableTop);
  doc.text("Наименование работы (услуги)", col1 + 30, tableTop);
  doc.text("Ед. изм.", col2, tableTop);
  doc.text("Кол-во", col3, tableTop);
  doc.text("Цена за ед., ₽", col4, tableTop);
  doc.text("Сумма, ₽", col5, tableTop);
  y = tableTop + rowH;

  doc.moveTo(50, y).lineTo(550, y).stroke();
  y += 4;

  const serviceName = booking.service_name || "Услуга";
  const qty = 1;
  const price = booking.price ?? 0;
  const sum = price * qty;

  if (fs.existsSync(fontPath)) doc.font("Custom");
  doc.text("1", col1, y);
  doc.text(serviceName, col1 + 30, y, { width: 240 });
  doc.text("усл.", col2, y);
  doc.text(String(qty), col3, y);
  doc.text(price.toFixed(2), col4, y);
  doc.text(sum.toFixed(2), col5, y);
  y += rowH + 8;

  doc.moveTo(50, y).lineTo(550, y).stroke();
  y += 6;
  doc.fontSize(10);
  doc.text(`Итого: ${sum.toFixed(2)} (${formatPriceWords(sum)}) руб.`, 350, y);
  y += 28;

  // Дата оказания услуги
  doc.text(`Дата оказания услуги: ${formatDateTime(booking.date_time)}`, 50, y);
  y += 20;

  // Подписи
  doc.fontSize(10);
  const sigY = y;
  doc.text("Исполнитель:", 50, sigY);
  doc.text("Заказчик:", 320, sigY);
  y += 6;
  if (orgDirector) {
    doc.text(orgDirector, 50, y);
  }
  doc.text(clientName, 320, y);
  y += 20;
  doc.text("_________________________", 50, y);
  doc.text("_________________________", 320, y);
  y += 6;
  doc.fontSize(8).fillColor("#666");
  doc.text("(подпись)", 50, y);
  doc.text("(подпись)", 320, y);
  y += 14;
  doc.text(
    "Документ сформирован в электронном виде. Подпись заказчика может быть проставлена при получении.",
    50,
    y,
    { width: 500 }
  );

  doc.end();

  return new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
}

/** Сумма прописью (упрощённо) */
function formatPriceWords(n: number): string {
  const int = Math.floor(n);
  const units = ["", "один", "два", "три", "четыре", "пять", "шесть", "семь", "восемь", "девять"];
  const teens = [
    "десять",
    "одиннадцать",
    "двенадцать",
    "тринадцать",
    "четырнадцать",
    "пятнадцать",
    "шестнадцать",
    "семнадцать",
    "восемнадцать",
    "девятнадцать",
  ];
  const tens = ["", "", "двадцать", "тридцать", "сорок", "пятьдесят", "шестьдесят", "семьдесят", "восемьдесят", "девяносто"];
  const hundreds = ["", "сто", "двести", "триста", "четыреста", "пятьсот", "шестьсот", "семьсот", "восемьсот", "девятьсот"];

  if (int === 0) return "ноль";
  if (int >= 1000000) return `${Math.floor(int / 1000000)} млн`;

  function tripleToWords(v: number): string {
    const h = Math.floor(v / 100);
    const t = Math.floor((v % 100) / 10);
    const u = v % 10;
    const parts: string[] = [];
    if (h > 0) parts.push(hundreds[h]);
    if (t === 1) parts.push(teens[u]);
    else {
      if (t > 0) parts.push(tens[t]);
      if (u > 0) parts.push(units[u]);
    }
    return parts.join(" ");
  }

  const thous = Math.floor(int / 1000);
  const rest = int % 1000;
  const parts: string[] = [];
  if (thous > 0) {
    let w = tripleToWords(thous);
    if (thous >= 5 && thous <= 20) w += " тысяч";
    else if (thous % 10 === 1 && thous % 100 !== 11) w += " тысяча";
    else if ([2, 3, 4].includes(thous % 10) && !(thous % 100 >= 12 && thous % 100 <= 14)) w += " тысячи";
    else w += " тысяч";
    parts.push(w);
  }
  if (rest > 0) parts.push(tripleToWords(rest));
  return parts.join(" ");
}
