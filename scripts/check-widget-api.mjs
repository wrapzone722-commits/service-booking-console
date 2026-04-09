/**
 * Проверка маршрутов виджета на локальном сервере.
 * Запуск: npm run check:widget-api
 * Другой порт: BASE=http://127.0.0.1:3001/api/v1 npm run check:widget-api
 */
const base = (process.env.BASE || 'http://127.0.0.1:3000/api/v1').replace(/\/$/, '');
const url = `${base}/web/health`;

const res = await fetch(url);
const text = await res.text();
console.log(`${res.status} ${url}`);
console.log(text);
if (res.status !== 200) {
  console.error('\nОжидался статус 200. Убедитесь, что сервер запущен из папки web-console: npm run dev');
  process.exit(1);
}
