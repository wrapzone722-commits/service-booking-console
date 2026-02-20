/**
 * HTML «Акт выполненных работ» (удобно для печати в браузере).
 * Используется как альтернатива PDF: GET /api/v1/bookings/:id/act?format=html
 */
import type { Account, Booking, User } from "@shared/api";
import * as db from "../db";

function escapeHtml(s: unknown): string {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "long", year: "numeric" });
}

function formatDateTime(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" }),
    time: d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }),
  };
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

export function buildActHtml(bookingId: string): string {
  const booking = db.getBooking(bookingId);
  if (!booking) throw new Error("Booking not found");
  if (booking.status !== "completed") throw new Error("Act is only available for completed bookings");

  const user: User | null = db.getUser(booking.user_id) ?? null;
  const account: Account | null = db.getFirstAccount();

  const orgName = account?.name ?? "Организация";
  const orgAddress = account?.address ?? "";
  const orgInn = account?.inn ?? "";
  const orgOgrn = account?.ogrn ?? "";
  const orgDirector = account?.director_name ?? "";
  const orgPhone = account?.phone ?? account?.phone_extra ?? "";

  const clientName = booking.user_name || (user ? `${user.first_name} ${user.last_name}`.trim() : "Клиент");
  const clientPhone = user?.phone ?? "";
  const clientEmail = user?.email ?? "";

  const { date, time } = formatDateTime(booking.date_time);
  const sum = Number(booking.price ?? 0) * 1;

  return `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Акт № ${escapeHtml(actNumber(booking))}</title>
  <style>
    :root {
      --fg: #111;
      --muted: #555;
      --border: #d9d9de;
      --bg: #ffffff;
      --chip: #f2f3f5;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: #f5f5f7;
      color: var(--fg);
      font: 14px/1.45 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Inter,Arial,sans-serif;
    }
    .page {
      max-width: 980px;
      margin: 24px auto;
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 14px;
      box-shadow: 0 12px 30px rgba(0,0,0,.06);
      overflow: hidden;
    }
    .toolbar {
      display: flex;
      gap: 10px;
      justify-content: flex-end;
      padding: 14px 18px;
      border-bottom: 1px solid var(--border);
      background: #fafafa;
    }
    .btn {
      appearance: none;
      border: 1px solid var(--border);
      background: #fff;
      padding: 8px 12px;
      border-radius: 10px;
      cursor: pointer;
      color: var(--fg);
      text-decoration: none;
      font-weight: 600;
      font-size: 13px;
    }
    .btn:hover { background: #f6f6f8; }
    .doc { padding: 28px 40px 36px; }
    h1 { margin: 0; font-size: 20px; letter-spacing: .2px; }
    .sub { margin-top: 6px; color: var(--muted); font-size: 12px; }
    .grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px;
      margin-top: 18px;
    }
    .card { border: 1px solid var(--border); border-radius: 12px; padding: 14px 16px; }
    .card h2 {
      margin: 0 0 10px 0;
      font-size: 13px;
      letter-spacing: .2px;
      text-transform: uppercase;
      color: var(--muted);
    }
    .row {
      display: grid;
      grid-template-columns: 160px 1fr;
      gap: 8px;
      padding: 6px 0;
      border-bottom: 1px dashed #ececf1;
    }
    .row:last-child { border-bottom: 0; }
    .label { color: var(--muted); }
    .value { font-weight: 600; }
    .chips { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 10px; }
    .chip {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 6px 10px;
      border-radius: 999px;
      background: var(--chip);
      color: var(--muted);
      font-size: 12px;
      font-weight: 600;
    }
    table { width: 100%; border-collapse: collapse; margin-top: 14px; }
    th, td { border-bottom: 1px solid #eee; padding: 10px 8px; text-align: left; font-size: 13px; }
    th { color: var(--muted); font-weight: 700; font-size: 12px; text-transform: uppercase; letter-spacing: .2px; }
    tfoot td { font-weight: 800; }
    .section { margin-top: 18px; border-top: 1px solid var(--border); padding-top: 16px; }
    .p { margin: 0; color: var(--muted); }
    .sign { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 26px; }
    .sign .line {
      border-top: 1px solid #222;
      margin-top: 34px;
      padding-top: 8px;
      font-size: 12px;
      color: var(--muted);
      text-align: center;
    }
    .foot { margin-top: 18px; font-size: 11px; color: #777; }
    @media print {
      body { background: #fff; }
      .page { box-shadow: none; border: 0; border-radius: 0; margin: 0; }
      .toolbar { display: none; }
      .doc { padding: 0; }
      @page { size: A4; margin: 18mm; }
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="toolbar">
      <button class="btn" onclick="window.print()">Печать</button>
    </div>
    <div class="doc">
      <h1>Акт выполненных работ</h1>
      <div class="sub">№ ${escapeHtml(actNumber(booking))} · ${escapeHtml(date)} ${escapeHtml(time)} · услуга: ${escapeHtml(booking.service_name)}</div>

      <div class="grid">
        <div class="card">
          <h2>Исполнитель</h2>
          <div class="row"><div class="label">Организация</div><div class="value">${escapeHtml(orgName)}</div></div>
          ${orgAddress ? `<div class="row"><div class="label">Адрес</div><div>${escapeHtml(orgAddress)}</div></div>` : ""}
          ${(orgInn || orgOgrn) ? `<div class="row"><div class="label">Реквизиты</div><div class="value">ИНН ${escapeHtml(orgInn)}${orgOgrn ? `, ОГРН ${escapeHtml(orgOgrn)}` : ""}</div></div>` : ""}
          ${orgPhone ? `<div class="row"><div class="label">Телефон</div><div class="value">${escapeHtml(orgPhone)}</div></div>` : ""}
          ${orgDirector ? `<div class="row"><div class="label">Руководитель</div><div class="value">${escapeHtml(orgDirector)}</div></div>` : ""}
        </div>
        <div class="card">
          <h2>Заказчик (клиент)</h2>
          <div class="row"><div class="label">ФИО</div><div class="value">${escapeHtml(clientName)}</div></div>
          ${clientPhone ? `<div class="row"><div class="label">Телефон</div><div class="value">${escapeHtml(clientPhone)}</div></div>` : ""}
          ${clientEmail ? `<div class="row"><div class="label">Email</div><div class="value">${escapeHtml(clientEmail)}</div></div>` : ""}
          <div class="chips">
            <div class="chip">Дата услуги: ${escapeHtml(formatDate(booking.date_time))}</div>
            <div class="chip">Длительность: ${escapeHtml(String(booking.duration ?? 0))} мин</div>
          </div>
        </div>
      </div>

      <div class="section">
        <p class="p">Настоящим подтверждается, что услуга оказана и принята, претензий по качеству и срокам не имеется.</p>

        <table>
          <thead>
            <tr>
              <th style="width: 48px;">№</th>
              <th>Наименование</th>
              <th style="width: 88px;">Ед.</th>
              <th style="width: 80px;">Кол-во</th>
              <th style="width: 120px;">Цена, ₽</th>
              <th style="width: 120px;">Сумма, ₽</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>1</td>
              <td>${escapeHtml(booking.service_name || "Услуга")}</td>
              <td>усл.</td>
              <td>1</td>
              <td>${escapeHtml(Number(booking.price ?? 0).toFixed(2))}</td>
              <td>${escapeHtml(sum.toFixed(2))}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td colspan="5">Итого</td>
              <td>${escapeHtml(sum.toFixed(2))}</td>
            </tr>
          </tfoot>
        </table>

        ${booking.notes ? `<div class="section"><p class="p"><b>Комментарий клиента:</b> ${escapeHtml(booking.notes)}</p></div>` : ""}

        <div class="sign">
          <div><div class="line">Исполнитель</div></div>
          <div><div class="line">Заказчик</div></div>
        </div>

        <div class="foot">Документ сформирован автоматически.</div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

