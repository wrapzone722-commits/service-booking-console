# Каких правок требуют проекты (консоль + iOS)

Краткая сводка: что уже сделано и **что ещё настроить** в **service-booking-console** и **iOS (AutoDetailHub)**.

---

## Уже сделано в консоли (бэкенд)

- **X-API-Key**: все клиентские маршруты принимают `X-API-Key` и `Authorization: Bearer api_key`.
- **Профиль**: GET/PUT `/api/v1/profile` с полями для iOS: `name`, `profile_photo_url`, `car_make`, `car_plate`, `telegram`, `promo_code`, `is_vip`.
- **Бронирования**: `start_iso`, определение клиента по api_key.
- **Уведомления**: GET/PATCH с X-API-Key.
- **Автомобили/аватар**: `profile_preview_url` и `profile_preview_thumbnail_url` (фото «01»).
- **Рейтинг**: `POST /api/v1/bookings/:id/rating` и алиас `POST /api/client/appointments/:id/rating` (тело: `rating`, `comment`).
- **Слоты**: в ответ добавлено поле `remaining_capacity` (1 или 0).

---

## Правки в iOS-проекте (AutoDetailHub)

### 1. Base URL

- Должен указывать на **v1 API**, например: `https://your-server.com/api/v1`.
- Все вызовы тогда делаются относительно этого base: `profile`, `bookings`, `clients/register`, `services`, `slots`, `cars/folders`, `notifications` и т.д.  
  То есть полный URL для профиля: `https://your-server.com/api/v1/profile`.

Проверить, что при подключении к мастерской (QR или ручной ввод) сохраняется именно такой base (с `/api/v1`), а не только хост.

### 2. Рейтинг записи

- Рейтинг на бэкенде уже добавлен (алиас `POST /api/client/appointments/:id/rating`). Путь в iOS менять не нужно.

### 3. Сервисы AuthService, VehicleService, AppointmentService

- В репозитории видны только вызовы этих сервисов, а не их реализация (могут быть в другом таргете/пакете).
- Для работы с текущим бэкендом они должны вызывать:
  - регистрация: `POST {base}/clients/register`;
  - профиль: `GET {base}/profile`, `PUT {base}/profile`;
  - услуги: `GET {base}/services`;
  - слоты: `GET {base}/slots?service_id=…&date=…&post_id=post_1`;
  - создание брони: `POST {base}/bookings` (тело: `service_id`, `date_time` или `start_iso`, при необходимости `post_id`, `notes`);
  - список бронирований: `GET {base}/bookings`;
  - папки авто/аватар: `GET {base}/cars/folders`;
  - уведомления: `GET {base}/notifications`, `PATCH {base}/notifications/:id/read`.
- Заголовок авторизации: **X-API-Key** с значением `api_key` из ответа регистрации (текущий APIClient уже так делает — менять не нужно).

Если в этих сервисах зашиты другие пути или префиксы (`/api/client/...` и т.п.), их нужно привести к перечисленным выше.

### 4. Ссылка «Открыть в браузере» (BookingConfirmationView)

- Сейчас к base URL добавляется `appointments` и query `id=…` — получается страница вида `…/api/v1/appointments?id=…`.
- На бэкенде консоли по умолчанию такой страницы может не быть (есть только API). Если нужна веб-страница с деталями записи, либо:
  - в консоли добавляется SPA-маршрут/страница типа `/appointments?id=…`, либо
  - в iOS ссылка ведёт на другой известный URL (например, админка на другом домене).  
  Без этого кнопка «открыть в браузере» может вести на 404.

---

## Что ещё настроить

### Консоль (бэкенд)

1. **Зависимости**  
   В корне проекта: `pnpm install` (или `npm install`). Убирает ошибку по `nodemailer` при сборке/typecheck.

2. **Переменные окружения (`.env`)**  
   Скопировать `.env.example` в `.env` и заполнить:
   - **API_BASE_URL** — полный URL API для QR и писем, например `https://your-domain.com/api/v1`.
   - **JWT_SECRET** — секрет для JWT (админка).
   - **PORT** — порт сервера (по умолчанию 3000).
   - По необходимости: **TELEGRAM_BOT_TOKEN**, **TELEGRAM_BOT_USERNAME** (уведомления в Telegram), **SMTP_*** (письма), **SMS_API_KEY** (SMS), **YANDEX_*** (OAuth).

3. **Данные в админке**  
   После запуска консоли: создать услуги, посты (посты мойки), при необходимости рабочие часы; в разделе «Автомобили» загрузить папки с фото (для выбора аватара в iOS).

4. **Деплой**  
   По необходимости: выставить в окружении продакшена **PORT**, **API_BASE_URL**, **JWT_SECRET**; при деплое через Docker см. `DEPLOY.md`.

### iOS (AutoDetailHub)

1. **Base URL при подключении**  
   При сканировании QR или ручном вводе мастерской должен сохраняться URL вида `https://your-server.com/api/v1` (с `/api/v1`), чтобы запросы `profile`, `bookings`, `clients/register` и т.д. шли на правильный хост.

2. **Ссылка «Открыть в браузере»**  
   Если в консоли нет страницы `/appointments?id=…`, кнопка в приложении может вести на 404. Либо добавить такой маршрут в SPA консоли, либо вести ссылку на другой известный URL (например, админка).

---

## Итог

| Где        | Что сделать |
|-----------|-------------|
| **Консоль** | `pnpm install`; настроить `.env` (API_BASE_URL, JWT_SECRET и др.); заполнить услуги/посты/автомобили в админке; при необходимости деплой (PORT, HTTPS). |
| **iOS**     | Убедиться, что base URL при подключении — `…/api/v1`; при необходимости поправить ссылку на веб-страницу записи. |

После этого консоль и iOS согласованы по API и готовы к совместной работе.
