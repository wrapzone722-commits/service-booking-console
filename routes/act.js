/**
 * GET /bookings/:id/act - «Акт выполненных работ»
 * По умолчанию отдаёт HTML (удобно для печати). Для PDF: ?format=pdf
 */
import PDFDocument from 'pdfkit';
import { existsSync } from 'fs';
import { getDb } from '../db/index.js';

export async function getBookingAct(req, res) {
  const db = getDb();
  const bookingId = req.params.id;

  const row = db.prepare(`
    SELECT
      b.*,
      s.name as service_name,
      s.description as service_description,
      c.first_name,
      c.last_name,
      c.phone,
      c.email
    FROM bookings b
    JOIN services s ON s.id = b.service_id
    JOIN clients c ON c.id = b.user_id
    WHERE b.id = ? AND b.user_id = ?
    LIMIT 1
  `).get(bookingId, req.clientId);

  if (!row) {
    return res.status(404).json({ error: 'Запись не найдена' });
  }
  if (row.status !== 'completed') {
    return res.status(400).json({ error: 'Акт доступен только для завершённой записи' });
  }

  // API для iOS исторически отдавал PDF — оставляем PDF по умолчанию,
  // а HTML можно запросить через ?format=html
  return sendAct(row, bookingId, req, res, { defaultFormat: 'pdf' });
}

export async function getBookingActAdmin(req, res) {
  const db = getDb();
  const bookingId = req.params.id;

  const row = db.prepare(`
    SELECT
      b.*,
      s.name as service_name,
      s.description as service_description,
      c.first_name,
      c.last_name,
      c.phone,
      c.email
    FROM bookings b
    JOIN services s ON s.id = b.service_id
    JOIN clients c ON c.id = b.user_id
    WHERE b.id = ?
    LIMIT 1
  `).get(bookingId);

  if (!row) {
    return res.status(404).json({ error: 'Запись не найдена' });
  }
  if (row.status !== 'completed') {
    return res.status(400).json({ error: 'Акт доступен только для завершённой записи' });
  }

  // Для админки/браузера удобнее HTML (и есть кнопка «Печать»)
  return sendAct(row, bookingId, req, res, { defaultFormat: 'html' });
}

async function sendAct(row, bookingId, req, res, { defaultFormat }) {
  const fmt = String(req.query.format || '').toLowerCase();
  const accept = String(req.headers.accept || '').toLowerCase();

  let wantsPdf;
  if (fmt === 'pdf') wantsPdf = true;
  else if (fmt === 'html') wantsPdf = false;
  else if (accept.includes('application/pdf')) wantsPdf = true;
  else if (accept.includes('text/html')) wantsPdf = false;
  else wantsPdf = defaultFormat === 'pdf';

  if (wantsPdf) {
    const pdf = await renderActPdf(row);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="act-${bookingId}.pdf"`);
    return res.status(200).send(pdf);
  }

  const html = renderActHtml(row);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.status(200).send(html);
}

async function renderActPdf(row) {
  const doc = new PDFDocument({ size: 'A4', margin: 48 });

  const fontPath =
    process.env.ACT_FONT_PATH ||
    (existsSync('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf') ? '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf' : null) ||
    (existsSync('/usr/share/fonts/ttf-dejavu/DejaVuSans.ttf') ? '/usr/share/fonts/ttf-dejavu/DejaVuSans.ttf' : null) ||
    (existsSync('/System/Library/Fonts/Supplemental/Arial Unicode.ttf') ? '/System/Library/Fonts/Supplemental/Arial Unicode.ttf' : null) ||
    (existsSync('/Library/Fonts/Arial Unicode.ttf') ? '/Library/Fonts/Arial Unicode.ttf' : null);

  if (fontPath) {
    doc.font(fontPath);
  } else {
    // fallback: без кириллицы шрифт может отрисоваться некорректно
    doc.font('Helvetica');
  }

  const chunks = [];
  const result = new Promise((resolve, reject) => {
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  const actNo = (row.id || '').slice(0, 8).toUpperCase();
  const created = row.date_time ? new Date(row.date_time) : new Date();
  const createdLocal = toServiceLocal(created);
  const createdStr = createdLocal.toLocaleDateString('ru-RU', { timeZone: 'UTC' });

  const clientName = `${(row.first_name || '').trim()} ${(row.last_name || '').trim()}`.trim() || 'Клиент';
  const phone = (row.phone || '').trim();
  const email = (row.email || '').trim();

  doc.fontSize(16).text('Акт выполненных работ', { align: 'center' });
  doc.moveDown(0.5);
  doc.fontSize(10).text(`№ ${actNo} от ${createdStr}`, { align: 'center' });
  doc.moveDown(1.2);

  doc.fontSize(12).text('1. Услуга', { underline: true });
  doc.moveDown(0.5);
  doc.fontSize(11).text(`Наименование: ${row.service_name || ''}`);
  if (row.service_description) {
    doc.fontSize(10).fillColor('#444').text(`Описание: ${row.service_description}`);
    doc.fillColor('#000');
  }
  doc.fontSize(11).text(`Стоимость: ${formatMoney(row.price)} ₽`);
  doc.fontSize(11).text(`Длительность: ${row.duration || 0} мин`);
  doc.moveDown(1.2);

  doc.fontSize(12).text('2. Клиент', { underline: true });
  doc.moveDown(0.5);
  doc.fontSize(11).text(`ФИО: ${clientName}`);
  if (phone) doc.fontSize(11).text(`Телефон: ${phone}`);
  if (email) doc.fontSize(11).text(`Email: ${email}`);
  doc.moveDown(1.2);

  doc.fontSize(10).fillColor('#444')
    .text('Настоящим подтверждается, что услуга выполнена в полном объёме, претензий по качеству и срокам не имеется.');
  doc.fillColor('#000');
  doc.moveDown(2);

  doc.fontSize(11).text('Исполнитель: ____________________', { continued: true }).text('   Клиент: ____________________');
  doc.moveDown(1);
  doc.fontSize(9).fillColor('#666').text('Подписи', { align: 'center' });
  doc.fillColor('#000');

  doc.end();
  return result;
}

function formatMoney(v) {
  const n = Number(v || 0);
  if (!Number.isFinite(n)) return '0';
  return n % 1 === 0 ? String(Math.trunc(n)) : n.toFixed(2);
}

function renderActHtml(row) {
  const actNo = (row.id || '').slice(0, 8).toUpperCase();
  const dt = row.date_time ? new Date(row.date_time) : new Date();
  const local = toServiceLocal(dt);
  const dateStr = local.toLocaleDateString('ru-RU', { timeZone: 'UTC' });
  const timeStr = local.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });

  const clientName = `${(row.first_name || '').trim()} ${(row.last_name || '').trim()}`.trim() || 'Клиент';
  const phone = (row.phone || '').trim();
  const email = (row.email || '').trim();

  const serviceName = (row.service_name || '').trim();
  const serviceDesc = (row.service_description || '').trim();
  const price = `${formatMoney(row.price)} ₽`;
  const duration = `${row.duration || 0} мин`;

  const notes = (row.notes || '').trim();

  return `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Акт № ${escapeHtml(actNo)}</title>
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
      max-width: 900px;
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
    .doc {
      padding: 28px 40px 36px;
    }
    h1 {
      margin: 0;
      font-size: 20px;
      letter-spacing: .2px;
    }
    .sub {
      margin-top: 6px;
      color: var(--muted);
      font-size: 12px;
    }
    .grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px;
      margin-top: 18px;
    }
    .card {
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 14px 16px;
    }
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
    .section {
      margin-top: 18px;
      border-top: 1px solid var(--border);
      padding-top: 16px;
    }
    .p {
      margin: 0;
      color: var(--muted);
    }
    .sign {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
      margin-top: 26px;
    }
    .sign .line {
      border-top: 1px solid #222;
      margin-top: 34px;
      padding-top: 8px;
      font-size: 12px;
      color: var(--muted);
      text-align: center;
    }
    .foot {
      margin-top: 18px;
      font-size: 11px;
      color: #777;
    }
    @media screen and (max-width: 560px) {
      body { background: #fff; }
      .page {
        max-width: none;
        margin: 0;
        border: 0;
        border-radius: 0;
        box-shadow: none;
      }
      .toolbar {
        position: sticky;
        top: 0;
        z-index: 10;
        padding: 10px 12px;
      }
      .btn { padding: 10px 12px; border-radius: 12px; }
      .doc { padding: 16px 14px 20px; }
      .grid { grid-template-columns: 1fr; }
      .row { grid-template-columns: 1fr; gap: 4px; }
      .label { font-size: 12px; }
      .sign { grid-template-columns: 1fr; gap: 14px; }
    }
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
      <div class="sub">№ ${escapeHtml(actNo)} · ${escapeHtml(dateStr)} ${escapeHtml(timeStr)}</div>

      <div class="grid">
        <div class="card">
          <h2>Услуга</h2>
          <div class="row"><div class="label">Наименование</div><div class="value">${escapeHtml(serviceName)}</div></div>
          ${serviceDesc ? `<div class="row"><div class="label">Описание</div><div>${escapeHtml(serviceDesc)}</div></div>` : ''}
          <div class="chips">
            <div class="chip">Стоимость: ${escapeHtml(price)}</div>
            <div class="chip">Длительность: ${escapeHtml(duration)}</div>
          </div>
          ${notes ? `<div class="section"><p class="p"><b>Комментарий:</b> ${escapeHtml(notes)}</p></div>` : ''}
        </div>
        <div class="card">
          <h2>Клиент</h2>
          <div class="row"><div class="label">ФИО</div><div class="value">${escapeHtml(clientName)}</div></div>
          ${phone ? `<div class="row"><div class="label">Телефон</div><div class="value">${escapeHtml(phone)}</div></div>` : ''}
          ${email ? `<div class="row"><div class="label">Email</div><div class="value">${escapeHtml(email)}</div></div>` : ''}
        </div>
      </div>

      <div class="section">
        <p class="p">Настоящим подтверждается, что услуга выполнена в полном объёме, претензий по качеству и срокам не имеется.</p>

        <div class="sign">
          <div>
            <div class="line">Исполнитель</div>
          </div>
          <div>
            <div class="line">Клиент</div>
          </div>
        </div>

        <div class="foot">Документ сформирован автоматически.</div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

function escapeHtml(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function getServiceOffsetMinutes() {
  const raw = process.env.SERVICE_TZ_OFFSET_MINUTES;
  const n = raw == null ? NaN : Number(raw);
  if (Number.isFinite(n)) return n;
  // JS offset: minutes behind UTC (e.g. UTC+5 => -300). Нам нужен "минуты вперед" (e.g. +300).
  return -new Date().getTimezoneOffset();
}

function toServiceLocal(date) {
  const offsetMin = getServiceOffsetMinutes();
  return new Date(date.getTime() + offsetMin * 60 * 1000);
}

