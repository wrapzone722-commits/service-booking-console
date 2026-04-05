# Service Booking — Веб-консоль

REST API и админ-панель для iOS-приложения Service Booking.

## Быстрый старт

```bash
cd web-console
npm install
npm start
```

- **API:** http://localhost:3000/api/v1
- **Админ-панель:** http://localhost:3000/admin

## OpenClaw ([openclaw.ai](https://openclaw.ai))

Интеграция для персонального ассистента на вашей стороне:

- В админке раздел **OpenClaw** (нужен пароль администратора) — живой JSON-манифест и скачивание `manifest.json`.
- **GET** `/admin/api/integration/openclaw` с заголовком `X-Admin-Key` — полный список admin-эндпоинтов и примеры `curl`.
- Статический навык: **`/openclaw/SKILL.md`** (переменные `SERVICE_BOOKING_ADMIN_URL`, `SERVICE_BOOKING_ADMIN_KEY`).

## Подключение iOS-приложения

1. **Запустите веб-консоль:** `npm start` (должно быть запущено до подключения)
2. **Симулятор iOS:** нажмите **«Подключиться к localhost»** на экране подключения
3. **Устройство в той же сети:** в разделе «Настройки» админки узнайте IP Mac (`ifconfig | grep inet`), введите `http://<IP>:3000/api/v1`

Порядок важен: сначала запустите веб-консоль, затем подключайте приложение.

## API (для iOS)

| Метод | Эндпоинт | Описание |
|-------|----------|----------|
| POST | `/api/v1/clients/register` | Регистрация устройства |
| GET | `/api/v1/services` | Список услуг |
| GET | `/api/v1/services/:id` | Детали услуги |
| GET | `/api/v1/bookings` | Записи клиента |
| POST | `/api/v1/bookings` | Создать запись |
| DELETE | `/api/v1/bookings/:id` | Отменить запись |
| GET | `/api/v1/posts` | Посты (боксы) |
| GET | `/api/v1/slots` | Слоты времени |
| GET/PUT | `/api/v1/profile` | Профиль |
| PUT | `/api/v1/profile/push_token` | Регистрация APNs device token для push |
| GET | `/api/v1/notifications` | Уведомления |
| PATCH | `/api/v1/notifications/:id/read` | Прочитано |
| GET | `/api/v1/image/preview?src=…&w=480` | Сжатое превью JPEG/WebP (экономия трафика в iOS); `src` — URL на том же хосте, что API, или из `IMAGE_PREVIEW_HOSTS` |

Все запросы (кроме `/clients/register`) — с заголовком `Authorization: Bearer <api_key>`.

## Push-уведомления (APNs)

Чтобы веб-консоль **отправляла** push при смене статуса записи или при отправке сообщения из админки, задайте переменные окружения:

| Переменная | Описание |
|------------|----------|
| `APNS_KEY_ID` | Key ID ключа APNs (Apple Developer → Keys) |
| `APNS_TEAM_ID` | Team ID (10 символов) |
| `APNS_BUNDLE_ID` | Bundle ID приложения, например `com.servicebooking.app` |
| `APNS_KEY_PATH` | Путь к файлу .p8 (приватный ключ APNs) |
| или `APNS_KEY` | Содержимое файла .p8 (строка) |
| `APNS_PRODUCTION` | `1` для продакшена (по умолчанию sandbox) |

Без этих переменных консоль работает как раньше; push просто не отправляются. Токен устройства приложение передаёт на `PUT /api/v1/profile/push_token`.

## Live Activity (виджет)

При переводе записи в статус **«В процессе»** в админ-панели:
- сохраняется `in_progress_started_at`
- на устройстве клиента автоматически запускается Live Activity
- при настроенных APNs клиенту уходит push «Услуга в процессе»

## Данные

- **БД:** SQLite (по умолчанию `web-console/data/service_booking.db`)
- При первом запуске создаются демо-услуги и посты

### Важно: как не потерять данные после деплоя

Если вы деплоите в Docker/на хостинг, где процесс/контейнер пересоздаётся, файл SQLite внутри
контейнера **не сохраняется**. Для сохранности данных используйте:

- **Переменную окружения** `DB_PATH` — путь к файлу SQLite на постоянном диске/volume.
  Пример: `DB_PATH=/data/service_booking.db`.
- **Volume/постоянный диск** примонтированный к `/data`.

#### Docker Compose (рекомендуется)

В папке `web-console` есть `docker-compose.yml`, который уже монтирует volume для `/data`:

```bash
cd web-console
docker compose up -d --build
```
