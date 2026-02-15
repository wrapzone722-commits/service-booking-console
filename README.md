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
- **Пароль по умолчанию:** `admin123`

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
| GET | `/api/v1/notifications` | Уведомления |
| PATCH | `/api/v1/notifications/:id/read` | Прочитано |

Все запросы (кроме `/clients/register`) — с заголовком `Authorization: Bearer <api_key>`.

## Live Activity (виджет)

При переводе записи в статус **«В процессе»** в админ-панели:
- сохраняется `in_progress_started_at`
- на устройстве клиента автоматически запускается Live Activity

## Данные

- **БД:** SQLite (`web-console/data/service_booking.db`)
- При первом запуске создаются демо-услуги и посты
