/**
 * Сборка ESC/POS для термопринтера 57 мм (≈32 символа Font A, 203 dpi, 384 точки).
 * Кодировка: CP866 + таблица 17 — типично для китайских ESC/POS с кириллицей.
 */
import iconv from 'iconv-lite';

export const ESCPOS_LINE_CHARS = 32;

function escInit() {
  return Buffer.from([0x1b, 0x40]);
}

/** Выбор таблицы символов (17 = CP866 на многих моделях) */
function escCodeTable(n = 0x11) {
  return Buffer.from([0x1b, 0x74, n & 0xff]);
}

function escAlign(mode) {
  return Buffer.from([0x1b, 0x61, mode & 0xff]); // 0 L 1 C 2 R
}

function escBold(on) {
  return Buffer.from([0x1b, 0x45, on ? 1 : 0]);
}

function feedAndCut() {
  return Buffer.concat([Buffer.from([0x0a, 0x0a, 0x0a]), Buffer.from([0x1d, 0x56, 0x00])]);
}

function safeSlice(s, w) {
  const t = String(s ?? '').trim();
  return t.length <= w ? t : t.slice(0, w);
}

function encodeLine(str) {
  const line = safeSlice(str, ESCPOS_LINE_CHARS);
  return Buffer.concat([iconv.encode(line + '\n', 'cp866')]);
}

function wrapWords(str) {
  const words = String(str || '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ');
  const lines = [];
  let cur = '';
  for (const w of words) {
    if (!w) continue;
    if (!cur) cur = w;
    else if (cur.length + 1 + w.length <= ESCPOS_LINE_CHARS) cur += ' ' + w;
    else {
      lines.push(cur);
      cur = w;
      while (cur.length > ESCPOS_LINE_CHARS) {
        lines.push(cur.slice(0, ESCPOS_LINE_CHARS));
        cur = cur.slice(ESCPOS_LINE_CHARS);
      }
    }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [''];
}

function pushWrapped(chunks, text, prefix = '') {
  const full = prefix ? `${prefix}${text}` : text;
  for (const part of full.split('\n')) {
    for (const line of wrapWords(part)) {
      chunks.push(encodeLine(line));
    }
  }
}

const STATUS_RU = {
  pending: 'Ожидает',
  confirmed: 'Подтверждена',
  in_progress: 'В работе',
  completed: 'Завершена',
  cancelled: 'Отменена',
};

export function buildTestReceiptEscPos({ headerLine }) {
  const chunks = [escInit(), escCodeTable(0x11), escAlign(1), escBold(true)];
  chunks.push(encodeLine(safeSlice(headerLine, ESCPOS_LINE_CHARS)));
  chunks.push(escBold(false));
  chunks.push(encodeLine(''));
  chunks.push(escAlign(0));
  chunks.push(encodeLine('Тест ESC/POS'));
  chunks.push(encodeLine('LAN TCP порт 9100'));
  chunks.push(encodeLine('57mm CP866'));
  chunks.push(encodeLine(new Date().toLocaleString('ru-RU')));
  chunks.push(feedAndCut());
  return Buffer.concat(chunks);
}

export function buildBookingReceiptEscPos(row, { headerLine }) {
  const chunks = [escInit(), escCodeTable(0x11), escAlign(1), escBold(true)];
  chunks.push(encodeLine(safeSlice(headerLine, ESCPOS_LINE_CHARS)));
  chunks.push(escBold(false));
  chunks.push(encodeLine('Чек'));
  chunks.push(encodeLine(''));
  chunks.push(escAlign(0));
  const dash = '-'.repeat(ESCPOS_LINE_CHARS);
  chunks.push(encodeLine(dash));
  pushWrapped(chunks, row.service_name || '', 'Услуга: ');
  const dt = row.date_time ? new Date(row.date_time).toLocaleString('ru-RU') : '';
  chunks.push(encodeLine(safeSlice(`Дата: ${dt}`, ESCPOS_LINE_CHARS)));
  const st = STATUS_RU[row.status] || row.status;
  chunks.push(encodeLine(safeSlice(`Статус: ${st}`, ESCPOS_LINE_CHARS)));
  chunks.push(encodeLine(safeSlice(`Сумма: ${row.price} руб.`, ESCPOS_LINE_CHARS)));
  const name = `${row.first_name || ''} ${row.last_name || ''}`.trim();
  if (name) pushWrapped(chunks, name, 'Клиент: ');
  if (row.phone) pushWrapped(chunks, String(row.phone), 'Тел: ');
  chunks.push(encodeLine(dash));
  chunks.push(encodeLine('Спасибо!'));
  chunks.push(feedAndCut());
  return Buffer.concat(chunks);
}
